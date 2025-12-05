use actix_web::{post, web, HttpResponse};
use chrono::NaiveDate;
use serde::Deserialize;

use crate::{error::ApiError, state::AppState};

/// Payload JSON untuk POST /api/retur
///
/// Contoh body:
/// {
///   "stok_id": 1,
///   "quantity": 5,
///   "tanggal": "2025-11-21",
///   "alasan": "Barang rusak",
///   "user_id": 10
/// }
#[derive(Debug, Deserialize)]
pub struct ReturRequest {
    pub stok_id: i32,
    pub quantity: i32,
    pub tanggal: NaiveDate,
    pub alasan: String,
    pub user_id: i32,
}

#[post("/retur")]
pub async fn create_retur(
    state: web::Data<AppState>,
    body: web::Json<ReturRequest>,
) -> Result<HttpResponse, ApiError> {
    let pool = &state.db;
    let payload = body.into_inner();

    // 1) Insert ke tabel retur
    sqlx::query(
        r#"
        INSERT INTO sbpv3.retur_barang (stok_id, quantity, tanggal, alasan, created_by)
        VALUES ($1, $2, $3, $4, $5)
        "#,
    )
    .bind(payload.stok_id)
    .bind(payload.quantity)
    .bind(payload.tanggal)
    .bind(&payload.alasan)
    .bind(payload.user_id)
    .execute(pool)
    .await?;

    // 2) Update stok (konsep: retur = barang masuk kembali ke gudang)
    sqlx::query(
        r#"
        UPDATE sbpv3.stok
        SET stok_masuk    = stok_masuk + $1,
            stok_sisa     = stok_sisa  + $1,
            tanggal_masuk = $2,
            updated_at    = NOW()
        WHERE id = $3
        "#,
    )
    .bind(payload.quantity)
    .bind(payload.tanggal)
    .bind(payload.stok_id)
    .execute(pool)
    .await?;

    // (Opsional) Broadcast ke WebSocket kalau mau realtime dashboard retur
    // let msg = serde_json::json!({
    //     "event": "retur_created",
    //     "data": {
    //         "stok_id": payload.stok_id,
    //         "quantity": payload.quantity,
    //         "tanggal": payload.tanggal,
    //         "alasan": payload.alasan,
    //         "user_id": payload.user_id,
    //     }
    // }).to_string();
    // let _ = state.tx.send(msg);

    Ok(HttpResponse::Created().finish())
}
