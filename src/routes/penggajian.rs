use actix::{Actor, ActorContext, AsyncContext, StreamHandler};
use actix_web::{delete, get, post, put, web, Error, HttpRequest, HttpResponse, Responder};
use actix_web_actors::ws;
use chrono::Utc;
use serde_json::json;
use std::time::{Duration, Instant};
use tokio::sync::broadcast;
use tokio_stream::wrappers::{errors::BroadcastStreamRecvError, BroadcastStream};
use uuid::Uuid;

use crate::models::penggajian::{
    CreatePenggajianRequest, Penggajian, PenggajianListQuery, UpdatePenggajianRequest,
};
use crate::state::AppState;

/* ===========================
   Helpers
   =========================== */

fn bad_request(msg: &str) -> HttpResponse {
    HttpResponse::BadRequest().json(json!({
        "success": false,
        "message": msg
    }))
}

fn ok_data<T: serde::Serialize>(data: T) -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "success": true,
        "data": data
    }))
}

fn validate_text_enum(field: &str, value: &str, allowed: &[&str]) -> Result<(), String> {
    if allowed.iter().any(|x| *x == value) {
        Ok(())
    } else {
        Err(format!(
            "{} tidak valid. Allowed: {}",
            field,
            allowed.join(", ")
        ))
    }
}

fn validate_money(field: &str, v: i64) -> Result<(), String> {
    if v < 0 {
        Err(format!("{} tidak boleh < 0", field))
    } else {
        Ok(())
    }
}

fn validate_money_opt(field: &str, v: &Option<i64>) -> Result<(), String> {
    if let Some(x) = v {
        if *x < 0 {
            return Err(format!("{} tidak boleh < 0", field));
        }
    }
    Ok(())
}

fn opt_trim(v: Option<String>) -> Option<String> {
    v.map(|s| s.trim().to_string()).filter(|s| !s.is_empty())
}

fn broadcast_penggajian(tx: &broadcast::Sender<String>, event: &str, payload: serde_json::Value) {
    let msg = json!({
        "tipe": "penggajian",
        "event": event,
        "payload": payload
    })
        .to_string();
    let _ = tx.send(msg);
}

/* ===========================
   SQL column list (DRY)
   =========================== */

const PENGGAJIAN_COLS: &str = r#"
    penggajian_id, pegawai_id, kontrak_id,
    periode_mulai, periode_akhir, tipe_gaji,
    jumlah_hari_kerja, upah_per_hari,
    upah_pokok, uang_lembur,
    tunjangan_makan, tunjangan_transport, tunjangan_lain, bonus,
    total_pendapatan,
    potongan_kasbon, potongan_bpjs, potongan_pph21, potongan_lain,
    total_potongan,
    gaji_bersih,
    status_gaji, tanggal_bayar, metode_bayar, bukti_bayar_url,
    catatan, created_at, updated_at
"#;

/* ===========================
   Validation helper
   =========================== */

fn validate_penggajian_fields(
    tipe_gaji: &str,
    status_gaji: &str,
    metode_bayar: &Option<String>,
    upah_pokok: i64,
    uang_lembur: i64,
    tunjangan_makan: i64,
    tunjangan_transport: i64,
    tunjangan_lain: i64,
    bonus: i64,
    potongan_kasbon: i64,
    potongan_bpjs: i64,
    potongan_pph21: i64,
    potongan_lain: i64,
    jumlah_hari_kerja: &Option<i32>,
    upah_per_hari: &Option<i64>,
    periode_mulai: chrono::NaiveDate,
    periode_akhir: chrono::NaiveDate,
) -> Result<(), String> {
    // Enum validations
    validate_text_enum("tipe_gaji", tipe_gaji, &["harian", "mingguan", "bulanan"])?;
    validate_text_enum("status_gaji", status_gaji, &["draft", "disetujui", "dibayar"])?;

    if let Some(ref mb) = metode_bayar {
        validate_text_enum("metode_bayar", mb, &["tunai", "transfer"])?;
    }

    // Periode validation
    if periode_akhir < periode_mulai {
        return Err("periode_akhir tidak boleh sebelum periode_mulai".to_string());
    }

    // Money validations (semua harus >= 0)
    validate_money("upah_pokok", upah_pokok)?;
    validate_money("uang_lembur", uang_lembur)?;
    validate_money("tunjangan_makan", tunjangan_makan)?;
    validate_money("tunjangan_transport", tunjangan_transport)?;
    validate_money("tunjangan_lain", tunjangan_lain)?;
    validate_money("bonus", bonus)?;
    validate_money("potongan_kasbon", potongan_kasbon)?;
    validate_money("potongan_bpjs", potongan_bpjs)?;
    validate_money("potongan_pph21", potongan_pph21)?;
    validate_money("potongan_lain", potongan_lain)?;
    validate_money_opt("upah_per_hari", upah_per_hari)?;

    // Hari kerja validation
    if let Some(jhk) = jumlah_hari_kerja {
        if *jhk < 0 {
            return Err("jumlah_hari_kerja tidak boleh < 0".to_string());
        }
    }

    Ok(())
}

/// Hitung total pendapatan, total potongan, gaji bersih
fn compute_totals(
    upah_pokok: i64,
    uang_lembur: i64,
    tunjangan_makan: i64,
    tunjangan_transport: i64,
    tunjangan_lain: i64,
    bonus: i64,
    potongan_kasbon: i64,
    potongan_bpjs: i64,
    potongan_pph21: i64,
    potongan_lain: i64,
) -> (i64, i64, i64) {
    let total_pendapatan =
        upah_pokok + uang_lembur + tunjangan_makan + tunjangan_transport + tunjangan_lain + bonus;
    let total_potongan = potongan_kasbon + potongan_bpjs + potongan_pph21 + potongan_lain;
    let gaji_bersih = total_pendapatan - total_potongan;
    (total_pendapatan, total_potongan, gaji_bersih)
}

/* ===========================
   REST: /api/penggajian
   =========================== */

#[get("/penggajian")]
pub async fn list_penggajian(
    state: web::Data<AppState>,
    q: web::Query<PenggajianListQuery>,
) -> impl Responder {
    let limit: i64 = q.limit.unwrap_or(50).clamp(1, 200);
    let offset: i64 = q.offset.unwrap_or(0).max(0);
    let pegawai_id = q.pegawai_id;
    let status: Option<&str> = q.status.as_deref().map(str::trim).filter(|s| !s.is_empty());
    let tipe: Option<&str> = q.tipe.as_deref().map(str::trim).filter(|s| !s.is_empty());
    let qtext = q.q.clone().unwrap_or_default().trim().to_lowercase();
    let qlike: Option<String> = if qtext.is_empty() {
        None
    } else {
        Some(format!("%{}%", qtext))
    };

    let sql = format!(
        r#"
        SELECT {}
        FROM sbpv3.t_penggajian
        WHERE
          ($1::uuid IS NULL OR pegawai_id = $1::uuid)
          AND ($2::text IS NULL OR status_gaji = $2::text)
          AND ($3::text IS NULL OR tipe_gaji = $3::text)
          AND (
            $4::text IS NULL
            OR LOWER(penggajian_id::text) LIKE $4::text
            OR LOWER(pegawai_id::text) LIKE $4::text
            OR LOWER(tipe_gaji) LIKE $4::text
            OR LOWER(status_gaji) LIKE $4::text
            OR LOWER(COALESCE(metode_bayar, '')) LIKE $4::text
            OR LOWER(COALESCE(catatan, '')) LIKE $4::text
          )
        ORDER BY periode_akhir DESC, updated_at DESC
        LIMIT $5 OFFSET $6
        "#,
        PENGGAJIAN_COLS
    );

    let rows = match sqlx::query_as::<_, Penggajian>(&sql)
        .bind(pegawai_id)
        .bind(status)
        .bind(tipe)
        .bind(qlike.as_deref())
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.db)
        .await
    {
        Ok(r) => r,
        Err(e) => {
            return HttpResponse::InternalServerError().json(json!({
                "success": false,
                "message": format!("DB error: {}", e)
            }))
        }
    };

    ok_data(rows)
}

#[get("/penggajian/{penggajian_id}")]
pub async fn get_penggajian(
    state: web::Data<AppState>,
    path: web::Path<Uuid>,
) -> impl Responder {
    let penggajian_id = path.into_inner();

    let sql = format!(
        "SELECT {} FROM sbpv3.t_penggajian WHERE penggajian_id = $1",
        PENGGAJIAN_COLS
    );

    let row = match sqlx::query_as::<_, Penggajian>(&sql)
        .bind(penggajian_id)
        .fetch_optional(&state.db)
        .await
    {
        Ok(r) => r,
        Err(e) => {
            return HttpResponse::InternalServerError().json(json!({
                "success": false,
                "message": format!("DB error: {}", e)
            }))
        }
    };

    match row {
        Some(r) => ok_data(r),
        None => HttpResponse::NotFound().json(json!({
            "success": false,
            "message": "Slip gaji tidak ditemukan"
        })),
    }
}

#[post("/penggajian")]
pub async fn create_penggajian(
    state: web::Data<AppState>,
    body: web::Json<CreatePenggajianRequest>,
) -> impl Responder {
    let b = body.into_inner();

    // Validate
    if let Err(msg) = validate_penggajian_fields(
        &b.tipe_gaji,
        &b.status_gaji,
        &b.metode_bayar,
        b.upah_pokok,
        b.uang_lembur,
        b.tunjangan_makan,
        b.tunjangan_transport,
        b.tunjangan_lain,
        b.bonus,
        b.potongan_kasbon,
        b.potongan_bpjs,
        b.potongan_pph21,
        b.potongan_lain,
        &b.jumlah_hari_kerja,
        &b.upah_per_hari,
        b.periode_mulai,
        b.periode_akhir,
    ) {
        return bad_request(&msg);
    }

    if b.status_gaji == "dibayar" && b.tanggal_bayar.is_none() {
        return bad_request("tanggal_bayar wajib diisi jika status = dibayar");
    }

    // Server-side recalculation (source of truth)
    let (total_pendapatan, total_potongan, gaji_bersih) = compute_totals(
        b.upah_pokok,
        b.uang_lembur,
        b.tunjangan_makan,
        b.tunjangan_transport,
        b.tunjangan_lain,
        b.bonus,
        b.potongan_kasbon,
        b.potongan_bpjs,
        b.potongan_pph21,
        b.potongan_lain,
    );

    let now = Utc::now();

    let inserted = match sqlx::query_as::<_, Penggajian>(&format!(
        r#"
        INSERT INTO sbpv3.t_penggajian (
            penggajian_id, pegawai_id, kontrak_id,
            periode_mulai, periode_akhir, tipe_gaji,
            jumlah_hari_kerja, upah_per_hari,
            upah_pokok, uang_lembur,
            tunjangan_makan, tunjangan_transport, tunjangan_lain, bonus,
            total_pendapatan,
            potongan_kasbon, potongan_bpjs, potongan_pph21, potongan_lain,
            total_potongan,
            gaji_bersih,
            status_gaji, tanggal_bayar, metode_bayar, bukti_bayar_url,
            catatan, created_at, updated_at
        )
        VALUES (
            $1,$2,$3,
            $4,$5,$6,
            $7,$8,
            $9,$10,
            $11,$12,$13,$14,
            $15,
            $16,$17,$18,$19,
            $20,
            $21,
            $22,$23,$24,$25,
            $26,$27,$28
        )
        RETURNING {}
        "#,
        PENGGAJIAN_COLS
    ))
        .bind(b.penggajian_id)
        .bind(b.pegawai_id)
        .bind(b.kontrak_id)
        .bind(b.periode_mulai)
        .bind(b.periode_akhir)
        .bind(b.tipe_gaji.trim().to_string())
        .bind(b.jumlah_hari_kerja)
        .bind(b.upah_per_hari)
        .bind(b.upah_pokok)
        .bind(b.uang_lembur)
        .bind(b.tunjangan_makan)
        .bind(b.tunjangan_transport)
        .bind(b.tunjangan_lain)
        .bind(b.bonus)
        .bind(total_pendapatan)
        .bind(b.potongan_kasbon)
        .bind(b.potongan_bpjs)
        .bind(b.potongan_pph21)
        .bind(b.potongan_lain)
        .bind(total_potongan)
        .bind(gaji_bersih)
        .bind(b.status_gaji.trim().to_string())
        .bind(b.tanggal_bayar)
        .bind(opt_trim(b.metode_bayar))
        .bind(opt_trim(b.bukti_bayar_url))
        .bind(opt_trim(b.catatan))
        .bind(now)
        .bind(now)
        .fetch_one(&state.db)
        .await
    {
        Ok(r) => r,
        Err(e) => {
            let msg = format!("{}", e).to_lowercase();
            if msg.contains("duplicate") {
                return bad_request("Penggajian ID sudah ada (duplicate)");
            }
            if msg.contains("foreign key") || msg.contains("fk") {
                return bad_request("pegawai_id atau kontrak_id tidak valid (FK error)");
            }
            return HttpResponse::InternalServerError().json(json!({
                "success": false,
                "message": format!("DB error: {}", e)
            }));
        }
    };

    // Jika ada potongan kasbon dan status dibayar, auto-mark cicilan terbayar
    if inserted.status_gaji == "dibayar" && inserted.potongan_kasbon > 0 {
        let _ = auto_mark_cicilan_from_payroll(&state.db, &state.tx, &inserted).await;
    }

    broadcast_penggajian(&state.tx, "created", json!(inserted));
    ok_data(inserted)
}

#[put("/penggajian/{penggajian_id}")]
pub async fn update_penggajian(
    state: web::Data<AppState>,
    path: web::Path<Uuid>,
    body: web::Json<UpdatePenggajianRequest>,
) -> impl Responder {
    let penggajian_id = path.into_inner();
    let b = body.into_inner();

    // Fetch existing
    let sql = format!(
        "SELECT {} FROM sbpv3.t_penggajian WHERE penggajian_id = $1",
        PENGGAJIAN_COLS
    );
    let existing = match sqlx::query_as::<_, Penggajian>(&sql)
        .bind(penggajian_id)
        .fetch_optional(&state.db)
        .await
    {
        Ok(r) => r,
        Err(e) => {
            return HttpResponse::InternalServerError().json(json!({
                "success": false,
                "message": format!("DB error: {}", e)
            }))
        }
    };

    let mut row = match existing {
        Some(r) => r,
        None => {
            return HttpResponse::NotFound().json(json!({
                "success": false,
                "message": "Slip gaji tidak ditemukan"
            }))
        }
    };

    let old_status = row.status_gaji.clone();

    // Merge patch
    if let Some(v) = b.pegawai_id {
        row.pegawai_id = v;
    }
    if let Some(v) = b.kontrak_id {
        row.kontrak_id = v;
    }
    if let Some(v) = b.periode_mulai {
        row.periode_mulai = v;
    }
    if let Some(v) = b.periode_akhir {
        row.periode_akhir = v;
    }
    if let Some(v) = b.tipe_gaji {
        row.tipe_gaji = v;
    }
    if let Some(v) = b.jumlah_hari_kerja {
        row.jumlah_hari_kerja = v;
    }
    if let Some(v) = b.upah_per_hari {
        row.upah_per_hari = v;
    }
    if let Some(v) = b.upah_pokok {
        row.upah_pokok = v;
    }
    if let Some(v) = b.uang_lembur {
        row.uang_lembur = v;
    }
    if let Some(v) = b.tunjangan_makan {
        row.tunjangan_makan = v;
    }
    if let Some(v) = b.tunjangan_transport {
        row.tunjangan_transport = v;
    }
    if let Some(v) = b.tunjangan_lain {
        row.tunjangan_lain = v;
    }
    if let Some(v) = b.bonus {
        row.bonus = v;
    }
    if let Some(v) = b.potongan_kasbon {
        row.potongan_kasbon = v;
    }
    if let Some(v) = b.potongan_bpjs {
        row.potongan_bpjs = v;
    }
    if let Some(v) = b.potongan_pph21 {
        row.potongan_pph21 = v;
    }
    if let Some(v) = b.potongan_lain {
        row.potongan_lain = v;
    }
    if let Some(v) = b.status_gaji {
        row.status_gaji = v;
    }
    if let Some(v) = b.tanggal_bayar {
        row.tanggal_bayar = v;
    }
    if let Some(v) = b.metode_bayar {
        row.metode_bayar = v;
    }
    if let Some(v) = b.bukti_bayar_url {
        row.bukti_bayar_url = v;
    }
    if let Some(v) = b.catatan {
        row.catatan = v;
    }

    // Ignore client-sent totals, recalculate server-side
    if b.total_pendapatan.is_some() || b.total_potongan.is_some() || b.gaji_bersih.is_some() {
        // silently ignore, we recalculate below
    }

    // Validate after merge
    if let Err(msg) = validate_penggajian_fields(
        &row.tipe_gaji,
        &row.status_gaji,
        &row.metode_bayar,
        row.upah_pokok,
        row.uang_lembur,
        row.tunjangan_makan,
        row.tunjangan_transport,
        row.tunjangan_lain,
        row.bonus,
        row.potongan_kasbon,
        row.potongan_bpjs,
        row.potongan_pph21,
        row.potongan_lain,
        &row.jumlah_hari_kerja,
        &row.upah_per_hari,
        row.periode_mulai,
        row.periode_akhir,
    ) {
        return bad_request(&msg);
    }

    if row.status_gaji == "dibayar" && row.tanggal_bayar.is_none() {
        return bad_request("tanggal_bayar wajib diisi jika status = dibayar");
    }

    // Recalculate totals
    let (total_pendapatan, total_potongan, gaji_bersih) = compute_totals(
        row.upah_pokok,
        row.uang_lembur,
        row.tunjangan_makan,
        row.tunjangan_transport,
        row.tunjangan_lain,
        row.bonus,
        row.potongan_kasbon,
        row.potongan_bpjs,
        row.potongan_pph21,
        row.potongan_lain,
    );

    let now = Utc::now();

    let updated = match sqlx::query_as::<_, Penggajian>(&format!(
        r#"
        UPDATE sbpv3.t_penggajian
        SET
            pegawai_id = $2,
            kontrak_id = $3,
            periode_mulai = $4,
            periode_akhir = $5,
            tipe_gaji = $6,
            jumlah_hari_kerja = $7,
            upah_per_hari = $8,
            upah_pokok = $9,
            uang_lembur = $10,
            tunjangan_makan = $11,
            tunjangan_transport = $12,
            tunjangan_lain = $13,
            bonus = $14,
            total_pendapatan = $15,
            potongan_kasbon = $16,
            potongan_bpjs = $17,
            potongan_pph21 = $18,
            potongan_lain = $19,
            total_potongan = $20,
            gaji_bersih = $21,
            status_gaji = $22,
            tanggal_bayar = $23,
            metode_bayar = $24,
            bukti_bayar_url = $25,
            catatan = $26,
            updated_at = $27
        WHERE penggajian_id = $1
        RETURNING {}
        "#,
        PENGGAJIAN_COLS
    ))
        .bind(penggajian_id)
        .bind(row.pegawai_id)
        .bind(row.kontrak_id)
        .bind(row.periode_mulai)
        .bind(row.periode_akhir)
        .bind(row.tipe_gaji.trim().to_string())
        .bind(row.jumlah_hari_kerja)
        .bind(row.upah_per_hari)
        .bind(row.upah_pokok)
        .bind(row.uang_lembur)
        .bind(row.tunjangan_makan)
        .bind(row.tunjangan_transport)
        .bind(row.tunjangan_lain)
        .bind(row.bonus)
        .bind(total_pendapatan)
        .bind(row.potongan_kasbon)
        .bind(row.potongan_bpjs)
        .bind(row.potongan_pph21)
        .bind(row.potongan_lain)
        .bind(total_potongan)
        .bind(gaji_bersih)
        .bind(row.status_gaji.trim().to_string())
        .bind(row.tanggal_bayar)
        .bind(opt_trim(row.metode_bayar.clone()))
        .bind(opt_trim(row.bukti_bayar_url.clone()))
        .bind(opt_trim(row.catatan.clone()))
        .bind(now)
        .fetch_one(&state.db)
        .await
    {
        Ok(r) => r,
        Err(e) => {
            return HttpResponse::InternalServerError().json(json!({
                "success": false,
                "message": format!("DB error: {}", e)
            }))
        }
    };

    // Auto-mark cicilan ketika status baru dibayar (transisi)
    if old_status != "dibayar"
        && updated.status_gaji == "dibayar"
        && updated.potongan_kasbon > 0
    {
        let _ = auto_mark_cicilan_from_payroll(&state.db, &state.tx, &updated).await;
    }

    broadcast_penggajian(&state.tx, "updated", json!(updated));
    ok_data(updated)
}

#[delete("/penggajian/{penggajian_id}")]
pub async fn delete_penggajian(
    state: web::Data<AppState>,
    path: web::Path<Uuid>,
) -> impl Responder {
    let penggajian_id = path.into_inner();

    let sql = format!(
        "DELETE FROM sbpv3.t_penggajian WHERE penggajian_id = $1 RETURNING {}",
        PENGGAJIAN_COLS
    );

    let deleted = match sqlx::query_as::<_, Penggajian>(&sql)
        .bind(penggajian_id)
        .fetch_optional(&state.db)
        .await
    {
        Ok(r) => r,
        Err(e) => {
            return HttpResponse::InternalServerError().json(json!({
                "success": false,
                "message": format!("DB error: {}", e)
            }))
        }
    };

    match deleted {
        Some(r) => {
            broadcast_penggajian(
                &state.tx,
                "deleted",
                json!({ "penggajian_id": r.penggajian_id }),
            );
            ok_data(r)
        }
        None => HttpResponse::NotFound().json(json!({
            "success": false,
            "message": "Slip gaji tidak ditemukan"
        })),
    }
}

/* ===========================
   Internal: auto-mark cicilan terbayar dari penggajian
   =========================== */

/// Ketika slip gaji dibayar dan ada potongan_kasbon > 0,
/// cari cicilan terjadwal milik pegawai ini dan tandai terbayar
/// sampai total potongan terpenuhi.
async fn auto_mark_cicilan_from_payroll(
    db: &sqlx::PgPool,
    tx: &broadcast::Sender<String>,
    slip: &Penggajian,
) -> Result<(), sqlx::Error> {
    if slip.potongan_kasbon <= 0 {
        return Ok(());
    }

    // Ambil cicilan terjadwal milik pegawai, urut jatuh tempo ASC
    let cicilans: Vec<crate::models::kasbon::KasbonCicilan> = sqlx::query_as(
        r#"
        SELECT
            c.cicilan_id, c.kasbon_id,
            c.cicilan_ke, c.nominal_cicilan,
            c.tanggal_jatuh_tempo, c.tanggal_bayar,
            c.status_cicilan,
            c.dipotong_dari, c.penggajian_id,
            c.catatan, c.created_at, c.updated_at
        FROM sbpv3.t_kasbon_cicilan c
        JOIN sbpv3.t_kasbon k ON k.kasbon_id = c.kasbon_id
        WHERE k.pegawai_id = $1
          AND c.status_cicilan = 'terjadwal'
        ORDER BY c.tanggal_jatuh_tempo ASC, c.cicilan_ke ASC
        "#,
    )
        .bind(slip.pegawai_id)
        .fetch_all(db)
        .await?;

    let mut sisa_potong = slip.potongan_kasbon;
    let now = Utc::now();
    let today = Utc::now().date_naive();

    let dipotong_dari = match slip.tipe_gaji.as_str() {
        "harian" => "gaji_harian",
        "mingguan" => "gaji_mingguan",
        "bulanan" => "gaji_bulanan",
        _ => "gaji_bulanan",
    };

    for cic in cicilans {
        if sisa_potong <= 0 {
            break;
        }

        if cic.nominal_cicilan <= sisa_potong {
            // Bayar penuh cicilan ini
            let _ = sqlx::query(
                r#"
                UPDATE sbpv3.t_kasbon_cicilan
                SET status_cicilan = 'terbayar',
                    tanggal_bayar = $2,
                    dipotong_dari = $3,
                    penggajian_id = $4,
                    updated_at = $5
                WHERE cicilan_id = $1
                "#,
            )
                .bind(cic.cicilan_id)
                .bind(today)
                .bind(dipotong_dari.to_string())
                .bind(Some(slip.penggajian_id))
                .bind(now)
                .execute(db)
                .await?;

            sisa_potong -= cic.nominal_cicilan;

            // Recalculate saldo kasbon
            let _ = recalculate_kasbon_saldo(db, tx, cic.kasbon_id).await;
        }
    }

    Ok(())
}

/// Recalculate saldo kasbon setelah cicilan terbayar
async fn recalculate_kasbon_saldo(
    db: &sqlx::PgPool,
    tx: &broadcast::Sender<String>,
    kasbon_id: Uuid,
) -> Result<(), sqlx::Error> {
    let terbayar: i64 = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COALESCE(SUM(nominal_cicilan), 0)
        FROM sbpv3.t_kasbon_cicilan
        WHERE kasbon_id = $1 AND status_cicilan = 'terbayar'
        "#,
    )
        .bind(kasbon_id)
        .fetch_one(db)
        .await?;

    // Ambil kasbon
    let kasbon: Option<crate::models::kasbon::Kasbon> = sqlx::query_as(
        r#"
        SELECT
            kasbon_id, pegawai_id, kontrak_id,
            tanggal_pengajuan, nominal_pengajuan, alasan,
            status_kasbon, disetujui_oleh, tanggal_persetujuan, nominal_disetujui,
            tanggal_cair, metode_pencairan, bukti_pencairan_url,
            metode_potong, jumlah_cicilan, saldo_kasbon,
            catatan, created_at, updated_at
        FROM sbpv3.t_kasbon WHERE kasbon_id = $1
        "#,
    )
        .bind(kasbon_id)
        .fetch_optional(db)
        .await?;

    if let Some(k) = kasbon {
        let total = k.nominal_disetujui.unwrap_or(k.nominal_pengajuan);
        let new_saldo = (total - terbayar).max(0);
        let new_status = if new_saldo == 0 && k.status_kasbon == "dicairkan" {
            "lunas"
        } else {
            &k.status_kasbon
        };

        let _ = sqlx::query(
            r#"
            UPDATE sbpv3.t_kasbon
            SET saldo_kasbon = $2, status_kasbon = $3, updated_at = $4
            WHERE kasbon_id = $1
            "#,
        )
            .bind(kasbon_id)
            .bind(new_saldo)
            .bind(new_status.to_string())
            .bind(Utc::now())
            .execute(db)
            .await?;

        // Broadcast kasbon update via WS
        let kasbon_msg = json!({
            "tipe": "kasbon",
            "event": "updated",
            "payload": {
                "kasbon_id": kasbon_id,
                "saldo_kasbon": new_saldo,
                "status_kasbon": new_status
            }
        })
            .to_string();
        let _ = tx.send(kasbon_msg);
    }

    Ok(())
}

/* ===========================
   WS: /ws/penggajian
   =========================== */

const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(5);
const CLIENT_TIMEOUT: Duration = Duration::from_secs(30);

pub struct PenggajianWs {
    hb: Instant,
    rx: broadcast::Receiver<String>,
}

impl PenggajianWs {
    pub fn new(rx: broadcast::Receiver<String>) -> Self {
        Self {
            hb: Instant::now(),
            rx,
        }
    }

    fn start_heartbeat(&self, ctx: &mut ws::WebsocketContext<Self>) {
        ctx.run_interval(HEARTBEAT_INTERVAL, |act, ctx| {
            if Instant::now().duration_since(act.hb) > CLIENT_TIMEOUT {
                ctx.stop();
                return;
            }
            ctx.ping(b"ping");
        });
    }
}

impl Actor for PenggajianWs {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        self.start_heartbeat(ctx);
        let stream = BroadcastStream::new(self.rx.resubscribe());
        ctx.add_stream(stream);
    }
}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for PenggajianWs {
    fn handle(
        &mut self,
        item: Result<ws::Message, ws::ProtocolError>,
        ctx: &mut Self::Context,
    ) {
        match item {
            Ok(ws::Message::Ping(msg)) => {
                self.hb = Instant::now();
                ctx.pong(&msg);
            }
            Ok(ws::Message::Pong(_)) => {
                self.hb = Instant::now();
            }
            Ok(ws::Message::Text(_)) => {}
            Ok(ws::Message::Close(reason)) => {
                ctx.close(reason);
                ctx.stop();
            }
            Ok(ws::Message::Binary(_)) => {}
            Ok(ws::Message::Continuation(_)) => {}
            Ok(ws::Message::Nop) => {}
            Err(_) => ctx.stop(),
        }
    }
}

impl StreamHandler<Result<String, BroadcastStreamRecvError>> for PenggajianWs {
    fn handle(
        &mut self,
        item: Result<String, BroadcastStreamRecvError>,
        ctx: &mut Self::Context,
    ) {
        if let Ok(text) = item {
            let should_send = match serde_json::from_str::<serde_json::Value>(&text) {
                Ok(v) => v.get("tipe").and_then(|x| x.as_str()) == Some("penggajian"),
                Err(_) => false,
            };
            if should_send {
                ctx.text(text);
            }
        }
    }
}

#[get("/ws/penggajian")]
pub async fn ws_penggajian_handler(
    req: HttpRequest,
    stream: web::Payload,
    state: web::Data<AppState>,
) -> Result<HttpResponse, Error> {
    let rx = state.tx.subscribe();
    ws::start(PenggajianWs::new(rx), &req, stream)
}