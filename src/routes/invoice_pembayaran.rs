use actix_web::{get, post, web, HttpResponse, Responder};
use chrono::Utc;
use serde_json::json;
use tokio::sync::broadcast;
use uuid::Uuid;

use crate::models::invoice::Invoice;
use crate::models::invoice_pembayaran::{
    CreatePembayaranRequest, InvoicePembayaran, PembayaranListQuery,
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

fn opt_trim(v: Option<String>) -> Option<String> {
    v.map(|s| s.trim().to_string()).filter(|s| !s.is_empty())
}

fn broadcast_event(tx: &broadcast::Sender<String>, tipe: &str, event: &str, payload: serde_json::Value) {
    let msg = json!({
        "tipe": tipe,
        "event": event,
        "payload": payload
    })
        .to_string();
    let _ = tx.send(msg);
}

/* ===========================
   SQL column lists
   =========================== */

const PEMBAYARAN_COLS: &str = r#"
    pembayaran_id, invoice_id,
    nominal, sisa_setelah_bayar,
    metode_bayar, referensi, bukti_url, dibayar_oleh,
    tanggal_bayar, catatan, created_at
"#;

const INVOICE_COLS: &str = r#"
    invoice_id, nomor_invoice,
    jenis_tagihan, nama_pemilik, deskripsi, frekuensi, periode,
    jumlah, jumlah_dibayar,
    tanggal_dibuat, jatuh_tempo,
    status,
    kontak_hp, kontak_email,
    nomor_id_meter,
    pemakaian, satuan_pemakaian, harga_satuan,
    reminder_aktif, reminder_metode, reminder_hari_before, reminder_berikutnya,
    catatan, created_at, updated_at
"#;

/* ===========================
   GET /api/invoice/{invoice_id}/pembayaran
   Riwayat pembayaran per invoice
   =========================== */

#[get("/invoice/{invoice_id}/pembayaran")]
pub async fn list_pembayaran(
    state: web::Data<AppState>,
    path: web::Path<Uuid>,
    q: web::Query<PembayaranListQuery>,
) -> impl Responder {
    let invoice_id = path.into_inner();
    let limit: i64 = q.limit.unwrap_or(50).clamp(1, 200);
    let offset: i64 = q.offset.unwrap_or(0).max(0);

    let sql = format!(
        r#"
        SELECT {}
        FROM sbpv3.t_invoice_pembayaran
        WHERE invoice_id = $1
        ORDER BY tanggal_bayar DESC, created_at DESC
        LIMIT $2 OFFSET $3
        "#,
        PEMBAYARAN_COLS
    );

    let rows = match sqlx::query_as::<_, InvoicePembayaran>(&sql)
        .bind(invoice_id)
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

/* ===========================
   POST /api/invoice/{invoice_id}/pembayaran
   Bayar invoice — auto update jumlah_dibayar & status
   =========================== */

#[post("/invoice/{invoice_id}/pembayaran")]
pub async fn create_pembayaran(
    state: web::Data<AppState>,
    path: web::Path<Uuid>,
    body: web::Json<CreatePembayaranRequest>,
) -> impl Responder {
    let invoice_id = path.into_inner();
    let b = body.into_inner();

    // ── Validasi nominal ──
    if b.nominal <= 0 {
        return bad_request("nominal harus > 0");
    }

    // ── Validasi metode_bayar ──
    let metode = b
        .metode_bayar
        .as_deref()
        .unwrap_or("tunai")
        .trim()
        .to_lowercase();
    if let Err(msg) = validate_text_enum(
        "metode_bayar",
        &metode,
        &["tunai", "transfer", "qris", "potong_gaji", "lainnya"],
    ) {
        return bad_request(&msg);
    }

    // ── Fetch invoice ──
    let inv_sql = format!(
        "SELECT {} FROM sbpv3.t_invoice WHERE invoice_id = $1",
        INVOICE_COLS
    );
    let invoice = match sqlx::query_as::<_, Invoice>(&inv_sql)
        .bind(invoice_id)
        .fetch_optional(&state.db)
        .await
    {
        Ok(Some(r)) => r,
        Ok(None) => {
            return HttpResponse::NotFound().json(json!({
                "success": false,
                "message": "Invoice tidak ditemukan"
            }))
        }
        Err(e) => {
            return HttpResponse::InternalServerError().json(json!({
                "success": false,
                "message": format!("DB error: {}", e)
            }))
        }
    };

    // ── Cek apakah sudah lunas ──
    if invoice.status == "lunas" {
        return bad_request("Invoice sudah lunas, tidak bisa bayar lagi");
    }
    if invoice.status == "batal" {
        return bad_request("Invoice sudah dibatalkan");
    }

    // ── Hitung sisa ──
    let sisa_sebelum = invoice.jumlah - invoice.jumlah_dibayar;
    if sisa_sebelum <= 0 {
        return bad_request("Invoice sudah lunas (sisa = 0)");
    }

    // Clamp nominal agar tidak melebihi sisa
    let nominal_final = b.nominal.min(sisa_sebelum);
    let jumlah_dibayar_baru = invoice.jumlah_dibayar + nominal_final;
    let sisa_setelah = invoice.jumlah - jumlah_dibayar_baru;

    // ── Tentukan status baru ──
    let status_baru = if sisa_setelah <= 0 {
        "lunas"
    } else {
        "sebagian"
    };

    let now = Utc::now();
    let tanggal_bayar = b.tanggal_bayar.unwrap_or_else(|| now.date_naive());

    // ── Begin: INSERT pembayaran ──
    let ins_sql = format!(
        r#"
        INSERT INTO sbpv3.t_invoice_pembayaran (
            pembayaran_id, invoice_id,
            nominal, sisa_setelah_bayar,
            metode_bayar, referensi, bukti_url, dibayar_oleh,
            tanggal_bayar, catatan, created_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        RETURNING {}
        "#,
        PEMBAYARAN_COLS
    );

    let pembayaran = match sqlx::query_as::<_, InvoicePembayaran>(&ins_sql)
        .bind(b.pembayaran_id)          // $1
        .bind(invoice_id)               // $2
        .bind(nominal_final)            // $3
        .bind(sisa_setelah)             // $4
        .bind(&metode)                  // $5
        .bind(opt_trim(b.referensi))    // $6
        .bind(opt_trim(b.bukti_url))    // $7
        .bind(opt_trim(b.dibayar_oleh)) // $8
        .bind(tanggal_bayar)            // $9
        .bind(opt_trim(b.catatan))      // $10
        .bind(now)                      // $11
        .fetch_one(&state.db)
        .await
    {
        Ok(r) => r,
        Err(e) => {
            let msg = format!("{}", e).to_lowercase();
            if msg.contains("duplicate") {
                return bad_request("pembayaran_id sudah ada (duplicate)");
            }
            return HttpResponse::InternalServerError().json(json!({
                "success": false,
                "message": format!("DB error insert pembayaran: {}", e)
            }));
        }
    };

    // ── Update invoice: jumlah_dibayar + status ──
    let upd_sql = format!(
        r#"
        UPDATE sbpv3.t_invoice
        SET jumlah_dibayar = $2,
            status = $3,
            updated_at = $4
        WHERE invoice_id = $1
        RETURNING {}
        "#,
        INVOICE_COLS
    );

    let updated_invoice = match sqlx::query_as::<_, Invoice>(&upd_sql)
        .bind(invoice_id)
        .bind(jumlah_dibayar_baru)
        .bind(status_baru)
        .bind(now)
        .fetch_one(&state.db)
        .await
    {
        Ok(r) => r,
        Err(e) => {
            return HttpResponse::InternalServerError().json(json!({
                "success": false,
                "message": format!("DB error update invoice: {}", e)
            }))
        }
    };

    // ── Broadcast WS ──
    // 1) pembayaran baru
    broadcast_event(
        &state.tx,
        "invoice_pembayaran",
        "created",
        json!(pembayaran),
    );
    // 2) invoice updated (supaya list page langsung update)
    broadcast_event(
        &state.tx,
        "invoice",
        "updated",
        json!(updated_invoice),
    );

    HttpResponse::Created().json(json!({
        "success": true,
        "data": {
            "pembayaran": pembayaran,
            "invoice": updated_invoice
        }
    }))
}