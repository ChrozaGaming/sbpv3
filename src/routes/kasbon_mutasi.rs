use actix_web::{get, post, web, HttpResponse, Responder};
use chrono::Utc;
use serde_json::json;
use uuid::Uuid;

use crate::models::kasbon::Kasbon;
use crate::models::kasbon_mutasi::{CreateMutasiRequest, KasbonMutasi, MUTASI_COLUMNS};
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

fn validate_tipe_mutasi(v: &str) -> Result<(), String> {
    let allowed = ["potong_gaji", "cicilan_manual", "penyesuaian"];
    if allowed.iter().any(|x| *x == v) {
        Ok(())
    } else {
        Err(format!(
            "tipe_mutasi tidak valid. Allowed: {}",
            allowed.join(", ")
        ))
    }
}

fn broadcast_kasbon(
    tx: &tokio::sync::broadcast::Sender<String>,
    event: &str,
    payload: serde_json::Value,
) {
    let msg = json!({
        "tipe": "kasbon",
        "event": event,
        "payload": payload
    });
    let _ = tx.send(msg.to_string());
}

/* ===========================
   Kasbon columns (self-contained)
   =========================== */

const KASBON_COLS: &str = r#"
    kasbon_id, pegawai_id, kontrak_id,
    tanggal_pengajuan, nominal_pengajuan, alasan,
    status_kasbon, disetujui_oleh, tanggal_persetujuan, nominal_disetujui,
    tanggal_cair, metode_pencairan, bukti_pencairan_url,
    metode_potong, jumlah_cicilan, saldo_kasbon,
    catatan, created_at, updated_at
"#;

/* ===========================
   GET /api/kasbon/{kasbon_id}/mutasi
   List semua mutasi untuk 1 kasbon (newest first)
   =========================== */

#[get("/kasbon/{kasbon_id}/mutasi")]
pub async fn list_mutasi(
    state: web::Data<AppState>,
    path: web::Path<Uuid>,
) -> impl Responder {
    let kasbon_id = path.into_inner();

    let sql = format!(
        "SELECT {} FROM sbpv3.t_kasbon_mutasi WHERE kasbon_id = $1 ORDER BY created_at DESC",
        MUTASI_COLUMNS
    );

    match sqlx::query_as::<_, KasbonMutasi>(&sql)
        .bind(kasbon_id)
        .fetch_all(&state.db)
        .await
    {
        Ok(rows) => ok_data(rows),
        Err(e) => {
            eprintln!("[kasbon_mutasi] list error: {e}");
            HttpResponse::InternalServerError().json(json!({
                "success": false,
                "message": format!("Gagal memuat mutasi: {e}")
            }))
        }
    }
}

/* ===========================
   POST /api/kasbon/{kasbon_id}/mutasi
   Buat mutasi baru — atomically update saldo kasbon.

   Body:
   {
     "tipe_mutasi": "cicilan_manual",   // atau "potong_gaji", "penyesuaian"
     "nominal_mutasi": 200000,
     "penggajian_id": null,             // UUID jika dari slip gaji
     "tanggal_mutasi": "2026-02-24",    // opsional, default hari ini
     "catatan": "Cicilan ke-3"          // opsional
   }

   Flow:
   1. Lock kasbon row (FOR UPDATE)
   2. Validasi: status != lunas, nominal <= saldo
   3. INSERT t_kasbon_mutasi
   4. UPDATE t_kasbon: saldo - nominal, status lunas jika saldo = 0
   5. COMMIT
   6. Broadcast WS
   =========================== */

#[post("/kasbon/{kasbon_id}/mutasi")]
pub async fn create_mutasi(
    state: web::Data<AppState>,
    path: web::Path<Uuid>,
    body: web::Json<CreateMutasiRequest>,
) -> impl Responder {
    let kasbon_id = path.into_inner();
    let req = body.into_inner();

    // --- Validasi input ---
    if let Err(msg) = validate_tipe_mutasi(&req.tipe_mutasi) {
        return bad_request(&msg);
    }
    if req.nominal_mutasi <= 0 {
        return bad_request("nominal_mutasi harus > 0");
    }

    // === START TRANSACTION ===
    let mut tx = match sqlx::Pool::begin(&state.db).await {
        Ok(tx) => tx,
        Err(e) => {
            eprintln!("[kasbon_mutasi] begin tx error: {e}");
            return HttpResponse::InternalServerError().json(json!({
                "success": false,
                "message": format!("Gagal memulai transaksi: {e}")
            }));
        }
    };

    // 1. Lock & baca kasbon
    let kasbon = match sqlx::query_as::<_, Kasbon>(&format!(
        "SELECT {} FROM sbpv3.t_kasbon WHERE kasbon_id = $1 FOR UPDATE",
        KASBON_COLS
    ))
        .bind(kasbon_id)
        .fetch_optional(&mut *tx)
        .await
    {
        Ok(Some(k)) => k,
        Ok(None) => {
            let _ = tx.rollback().await;
            return bad_request(&format!("Kasbon {} tidak ditemukan", kasbon_id));
        }
        Err(e) => {
            let _ = tx.rollback().await;
            return bad_request(&format!("Gagal baca kasbon: {e}"));
        }
    };

    // 2. Validasi bisnis
    if kasbon.status_kasbon == "lunas" {
        let _ = tx.rollback().await;
        return bad_request("Kasbon sudah lunas, tidak bisa dimutasi lagi.");
    }

    if req.nominal_mutasi > kasbon.saldo_kasbon {
        let _ = tx.rollback().await;
        return bad_request(&format!(
            "Nominal mutasi ({}) melebihi saldo kasbon ({})",
            req.nominal_mutasi, kasbon.saldo_kasbon
        ));
    }

    let saldo_sebelum = kasbon.saldo_kasbon;
    let saldo_sesudah = (saldo_sebelum - req.nominal_mutasi).max(0);
    let tanggal = req.tanggal_mutasi.unwrap_or_else(|| Utc::now().date_naive());
    let mutasi_id = Uuid::new_v4();

    // 3. INSERT mutasi record
    let insert_sql = format!(
        r#"
        INSERT INTO sbpv3.t_kasbon_mutasi
            (mutasi_id, kasbon_id, penggajian_id, tipe_mutasi,
             nominal_mutasi, saldo_sebelum, saldo_sesudah,
             tanggal_mutasi, catatan)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING {}
        "#,
        MUTASI_COLUMNS
    );

    let mutasi = match sqlx::query_as::<_, KasbonMutasi>(&insert_sql)
        .bind(mutasi_id)
        .bind(kasbon_id)
        .bind(req.penggajian_id)
        .bind(&req.tipe_mutasi)
        .bind(req.nominal_mutasi)
        .bind(saldo_sebelum)
        .bind(saldo_sesudah)
        .bind(tanggal)
        .bind(&req.catatan)
        .fetch_one(&mut *tx)
        .await
    {
        Ok(m) => m,
        Err(e) => {
            let _ = tx.rollback().await;
            eprintln!("[kasbon_mutasi] insert error: {e}");
            return bad_request(&format!("Gagal insert mutasi: {e}"));
        }
    };

    // 4. UPDATE kasbon saldo + status
    let new_status = if saldo_sesudah <= 0 { "lunas" } else { "dicairkan" };

    if let Err(e) = sqlx::query(
        "UPDATE sbpv3.t_kasbon SET saldo_kasbon = $1, status_kasbon = $2, updated_at = now() WHERE kasbon_id = $3",
    )
        .bind(saldo_sesudah)
        .bind(new_status)
        .bind(kasbon_id)
        .execute(&mut *tx)
        .await
    {
        let _ = tx.rollback().await;
        eprintln!("[kasbon_mutasi] update kasbon error: {e}");
        return bad_request(&format!("Gagal update saldo kasbon: {e}"));
    }

    // Fetch updated kasbon (masih dalam tx) untuk broadcast
    let updated_kasbon = sqlx::query_as::<_, Kasbon>(&format!(
        "SELECT {} FROM sbpv3.t_kasbon WHERE kasbon_id = $1",
        KASBON_COLS
    ))
        .bind(kasbon_id)
        .fetch_optional(&mut *tx)
        .await
        .ok()
        .flatten();

    // 5. COMMIT
    if let Err(e) = tx.commit().await {
        eprintln!("[kasbon_mutasi] commit error: {e}");
        return HttpResponse::InternalServerError().json(json!({
            "success": false,
            "message": format!("Gagal commit: {e}")
        }));
    }

    // 6. Broadcast kasbon update via WS
    if let Some(k) = updated_kasbon {
        broadcast_kasbon(&state.tx, "updated", json!(k));
    }

    HttpResponse::Created().json(json!({
        "success": true,
        "data": mutasi
    }))
}