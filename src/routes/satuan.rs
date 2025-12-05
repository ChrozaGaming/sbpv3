use actix_web::{get, post, put, delete, web, HttpResponse};
use crate::{state::AppState, error::ApiError, models::satuan::*};

/// GET /api/satuan
#[get("/satuan")]
pub async fn list_satuan(state: web::Data<AppState>) -> Result<HttpResponse, ApiError> {
    let rows = sqlx::query_as::<_, Satuan>(
        r#"
        SELECT id, kode, nama
        FROM sbpv3.satuan
        ORDER BY kode ASC
        "#
    )
    .fetch_all(&state.db)
    .await?;

    Ok(HttpResponse::Ok().json(rows))
}

/// GET /api/satuan/{id}
#[get("/satuan/{id}")]
pub async fn get_satuan(
    state: web::Data<AppState>,
    path: web::Path<i32>,
) -> Result<HttpResponse, ApiError> {
    let id = path.into_inner();

    let row = sqlx::query_as::<_, Satuan>(
        r#"
        SELECT id, kode, nama
        FROM sbpv3.satuan
        WHERE id = $1
        "#
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?;

    match row {
        Some(s) => Ok(HttpResponse::Ok().json(s)),
        None => Err(ApiError::NotFound("Satuan tidak ditemukan".into())),
    }
}

/// POST /api/satuan
#[post("/satuan")]
pub async fn create_satuan(
    state: web::Data<AppState>,
    payload: web::Json<CreateSatuanRequest>,
) -> Result<HttpResponse, ApiError> {
    let body = payload.into_inner();

    // cek kode unik
    let existing: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)::bigint
        FROM sbpv3.satuan
        WHERE kode = $1
        "#
    )
    .bind(&body.kode)
    .fetch_one(&state.db)
    .await?;

    if existing > 0 {
        return Err(ApiError::BadRequest("Kode satuan sudah digunakan".into()));
    }

    sqlx::query(
        r#"
        INSERT INTO sbpv3.satuan (kode, nama)
        VALUES ($1, $2)
        "#
    )
    .bind(&body.kode)
    .bind(&body.nama)
    .execute(&state.db)
    .await?;

    Ok(HttpResponse::Created().json(serde_json::json!({
        "message": "Satuan dibuat"
    })))
}

/// PUT /api/satuan/{id}
#[put("/satuan/{id}")]
pub async fn update_satuan(
    state: web::Data<AppState>,
    path: web::Path<i32>,
    payload: web::Json<UpdateSatuanRequest>,
) -> Result<HttpResponse, ApiError> {
    let id = path.into_inner();
    let body = payload.into_inner();

    // cek kode unik (tidak boleh sama dengan milik ID lain)
    let existing: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)::bigint
        FROM sbpv3.satuan
        WHERE kode = $1 AND id <> $2
        "#
    )
    .bind(&body.kode)
    .bind(id)
    .fetch_one(&state.db)
    .await?;

    if existing > 0 {
        return Err(ApiError::BadRequest("Kode satuan sudah digunakan oleh record lain".into()));
    }

    let res = sqlx::query(
        r#"
        UPDATE sbpv3.satuan
        SET kode = $1,
            nama = $2
        WHERE id = $3
        "#
    )
    .bind(&body.kode)
    .bind(&body.nama)
    .bind(id)
    .execute(&state.db)
    .await?;

    if res.rows_affected() == 0 {
        return Err(ApiError::NotFound("Satuan tidak ditemukan".into()));
    }

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "Satuan diperbarui"
    })))
}

/// DELETE /api/satuan/{id}
#[delete("/satuan/{id}")]
pub async fn delete_satuan(
    state: web::Data<AppState>,
    path: web::Path<i32>,
) -> Result<HttpResponse, ApiError> {
    let id = path.into_inner();

    let res = sqlx::query(
        r#"
        DELETE FROM sbpv3.satuan
        WHERE id = $1
        "#
    )
    .bind(id)
    .execute(&state.db)
    .await?;

    if res.rows_affected() == 0 {
        return Err(ApiError::NotFound("Satuan tidak ditemukan".into()));
    }

    Ok(HttpResponse::NoContent().finish())
}
