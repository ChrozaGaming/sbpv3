use actix_web::{get, post, put, delete, web, HttpResponse};
use crate::{state::AppState, error::ApiError, models::surat_jalan::*};

/// GET /api/surat_jalan
#[get("/surat_jalan")]
pub async fn list_surat_jalan(
    state: web::Data<AppState>,
) -> Result<HttpResponse, ApiError> {
    let rows = sqlx::query_as::<_, SuratJalan>(
        r#"
        SELECT
            id,
            nomor,
            tujuan,
            alamat_tujuan,
            tanggal_kirim,
            status::TEXT AS status,
            catatan,
            created_at,
            updated_at
        FROM sbpv3.surat_jalan
        ORDER BY tanggal_kirim DESC, id DESC
        "#
    )
    .fetch_all(&state.db)
    .await?;

    Ok(HttpResponse::Ok().json(rows))
}

/// GET /api/surat_jalan/{id}
#[get("/surat_jalan/{id}")]
pub async fn get_surat_jalan(
    state: web::Data<AppState>,
    path: web::Path<i32>,
) -> Result<HttpResponse, ApiError> {
    let id = path.into_inner();

    let row = sqlx::query_as::<_, SuratJalan>(
        r#"
        SELECT
            id,
            nomor,
            tujuan,
            alamat_tujuan,
            tanggal_kirim,
            status::TEXT AS status,
            catatan,
            created_at,
            updated_at
        FROM sbpv3.surat_jalan
        WHERE id = $1
        "#
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?;

    match row {
        Some(sj) => Ok(HttpResponse::Ok().json(sj)),
        None => Err(ApiError::NotFound("Surat jalan tidak ditemukan".into())),
    }
}

/// POST /api/surat_jalan
#[post("/surat_jalan")]
pub async fn create_surat_jalan(
    state: web::Data<AppState>,
    payload: web::Json<CreateSuratJalanRequest>,
) -> Result<HttpResponse, ApiError> {
    let body = payload.into_inner();

    // cek nomor unik
    let existing: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)::bigint
        FROM sbpv3.surat_jalan
        WHERE nomor = $1
        "#
    )
    .bind(&body.nomor)
    .fetch_one(&state.db)
    .await?;

    if existing > 0 {
        return Err(ApiError::BadRequest("Nomor surat jalan sudah digunakan".into()));
    }

    let status_str = body.status.unwrap_or_else(|| "DIKIRIM".to_string());

    sqlx::query(
        r#"
        INSERT INTO sbpv3.surat_jalan
        (nomor, tujuan, alamat_tujuan, tanggal_kirim, status, catatan)
        VALUES ($1, $2, $3, $4, $5::sbpv3.status_surat_jalan, $6)
        "#
    )
    .bind(&body.nomor)
    .bind(&body.tujuan)
    .bind(&body.alamat_tujuan)
    .bind(body.tanggal_kirim)
    .bind(&status_str)
    .bind(&body.catatan)
    .execute(&state.db)
    .await?;

    Ok(HttpResponse::Created().json(serde_json::json!({
        "message": "Surat jalan dibuat"
    })))
}

/// PUT /api/surat_jalan/{id}
#[put("/surat_jalan/{id}")]
pub async fn update_surat_jalan(
    state: web::Data<AppState>,
    path: web::Path<i32>,
    payload: web::Json<UpdateSuratJalanRequest>,
) -> Result<HttpResponse, ApiError> {
    let id = path.into_inner();
    let body = payload.into_inner();

    let res = sqlx::query(
        r#"
        UPDATE sbpv3.surat_jalan
        SET tujuan = $1,
            alamat_tujuan = $2,
            tanggal_kirim = $3,
            status = $4::sbpv3.status_surat_jalan,
            catatan = $5,
            updated_at = NOW()
        WHERE id = $6
        "#
    )
    .bind(&body.tujuan)
    .bind(&body.alamat_tujuan)
    .bind(body.tanggal_kirim)
    .bind(&body.status)
    .bind(&body.catatan)
    .bind(id)
    .execute(&state.db)
    .await?;

    if res.rows_affected() == 0 {
        return Err(ApiError::NotFound("Surat jalan tidak ditemukan".into()));
    }

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "Surat jalan diperbarui"
    })))
}

/// DELETE /api/surat_jalan/{id}
#[delete("/surat_jalan/{id}")]
pub async fn delete_surat_jalan(
    state: web::Data<AppState>,
    path: web::Path<i32>,
) -> Result<HttpResponse, ApiError> {
    let id = path.into_inner();

    let res = sqlx::query(
        r#"
        DELETE FROM sbpv3.surat_jalan
        WHERE id = $1
        "#
    )
    .bind(id)
    .execute(&state.db)
    .await?;

    if res.rows_affected() == 0 {
        return Err(ApiError::NotFound("Surat jalan tidak ditemukan".into()));
    }

    Ok(HttpResponse::NoContent().finish())
}

/// GET /api/surat_jalan/{id}/items
#[get("/surat_jalan/{id}/items")]
pub async fn list_surat_jalan_items(
    state: web::Data<AppState>,
    path: web::Path<i32>,
) -> Result<HttpResponse, ApiError> {
    let surat_jalan_id = path.into_inner();

    let rows = sqlx::query_as::<_, SuratJalanItemWithDetail>(
        r#"
        SELECT
            i.id,
            i.surat_jalan_id,
            i.stok_id,
            i.qty,
            i.satuan_id,
            i.keterangan,
            s.kode AS stok_kode,
            s.nama AS stok_nama,
            sat.kode AS satuan_kode,
            sat.nama AS satuan_nama
        FROM sbpv3.surat_jalan_items i
        JOIN sbpv3.stok s ON s.id = i.stok_id
        JOIN sbpv3.satuan sat ON sat.id = i.satuan_id
        WHERE i.surat_jalan_id = $1
        ORDER BY i.id ASC
        "#
    )
    .bind(surat_jalan_id)
    .fetch_all(&state.db)
    .await?;

    Ok(HttpResponse::Ok().json(rows))
}

/// POST /api/surat_jalan/{id}/items
#[post("/surat_jalan/{id}/items")]
pub async fn create_surat_jalan_item(
    state: web::Data<AppState>,
    path: web::Path<i32>,
    payload: web::Json<CreateSuratJalanItemRequest>,
) -> Result<HttpResponse, ApiError> {
    let surat_jalan_id = path.into_inner();
    let body = payload.into_inner();

    // optional: cek header ada
    let exists: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)::bigint
        FROM sbpv3.surat_jalan
        WHERE id = $1
        "#
    )
    .bind(surat_jalan_id)
    .fetch_one(&state.db)
    .await?;

    if exists == 0 {
        return Err(ApiError::NotFound("Surat jalan tidak ditemukan".into()));
    }

    sqlx::query(
        r#"
        INSERT INTO sbpv3.surat_jalan_items
        (surat_jalan_id, stok_id, qty, satuan_id, keterangan)
        VALUES ($1, $2, $3, $4, $5)
        "#
    )
    .bind(surat_jalan_id)
    .bind(body.stok_id)
    .bind(body.qty)
    .bind(body.satuan_id)
    .bind(body.keterangan)
    .execute(&state.db)
    .await?;

    Ok(HttpResponse::Created().json(serde_json::json!({
        "message": "Item surat jalan dibuat"
    })))
}

/// GET /api/surat_jalan_items/{id}
#[get("/surat_jalan_items/{id}")]
pub async fn get_surat_jalan_item(
    state: web::Data<AppState>,
    path: web::Path<i32>,
) -> Result<HttpResponse, ApiError> {
    let id = path.into_inner();

    let row = sqlx::query_as::<_, SuratJalanItem>(
        r#"
        SELECT
            id,
            surat_jalan_id,
            stok_id,
            qty,
            satuan_id,
            keterangan
        FROM sbpv3.surat_jalan_items
        WHERE id = $1
        "#
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?;

    match row {
        Some(item) => Ok(HttpResponse::Ok().json(item)),
        None => Err(ApiError::NotFound("Item surat jalan tidak ditemukan".into())),
    }
}

/// PUT /api/surat_jalan_items/{id}
#[put("/surat_jalan_items/{id}")]
pub async fn update_surat_jalan_item(
    state: web::Data<AppState>,
    path: web::Path<i32>,
    payload: web::Json<UpdateSuratJalanItemRequest>,
) -> Result<HttpResponse, ApiError> {
    let id = path.into_inner();
    let body = payload.into_inner();

    let res = sqlx::query(
        r#"
        UPDATE sbpv3.surat_jalan_items
        SET stok_id = $1,
            qty = $2,
            satuan_id = $3,
            keterangan = $4
        WHERE id = $5
        "#
    )
    .bind(body.stok_id)
    .bind(body.qty)
    .bind(body.satuan_id)
    .bind(body.keterangan)
    .bind(id)
    .execute(&state.db)
    .await?;

    if res.rows_affected() == 0 {
        return Err(ApiError::NotFound("Item surat jalan tidak ditemukan".into()));
    }

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "Item surat jalan diperbarui"
    })))
}

/// DELETE /api/surat_jalan_items/{id}
#[delete("/surat_jalan_items/{id}")]
pub async fn delete_surat_jalan_item(
    state: web::Data<AppState>,
    path: web::Path<i32>,
) -> Result<HttpResponse, ApiError> {
    let id = path.into_inner();

    let res = sqlx::query(
        r#"
        DELETE FROM sbpv3.surat_jalan_items
        WHERE id = $1
        "#
    )
    .bind(id)
    .execute(&state.db)
    .await?;

    if res.rows_affected() == 0 {
        return Err(ApiError::NotFound("Item surat jalan tidak ditemukan".into()));
    }

    Ok(HttpResponse::NoContent().finish())
}
