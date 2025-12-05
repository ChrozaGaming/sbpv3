// src/routes/product.rs

use actix_web::{delete, get, post, put, web, HttpResponse};
use sqlx::PgPool;

use crate::{
    error::ApiError,
    models::product::{
        CreateProductRequest,
        ListQuery,
        ProductPublic,
        ProductRow,
        SearchQuery,
        UpdateProductRequest,
    },
    state::AppState,
};

/// Helper: validasi string kategori & satuan agar tidak bikin error ENUM di Postgres
fn is_valid_kategori(k: &str) -> bool {
    matches!(k, "Alat" | "Material" | "Consumable")
}

fn is_valid_satuan(s: &str) -> bool {
    matches!(
        s,
        "kg"
            | "kgset"
            | "liter"
            | "literset"
            | "pail"
            | "galon5liter"
            | "galon10liter"
            | "pcs"
            | "lonjor"
            | "sak"
            | "unit"
            | "drum"
    )
}

/// GET /api/product
#[get("/product")]
pub async fn list_products(
    state: web::Data<AppState>,
    query: web::Query<ListQuery>,
) -> Result<HttpResponse, ApiError> {
    let pool: &PgPool = &state.db;

    let mut sql = String::from(
        r#"
        SELECT
            id,
            kode,
            nama,
            brand,
            kategori::text AS kategori,
            satuan::text   AS satuan,
            harga_idr,
            created_at,
            updated_at
        FROM sbpv3.product
        "#,
    );
    let mut conditions: Vec<String> = Vec::new();

    if query.brand.is_some() {
        conditions.push("brand ILIKE $1".to_string());
    }
    if query.kategori.is_some() {
        let idx = if query.brand.is_some() { 2 } else { 1 };
        conditions.push(format!("kategori::text = ${}", idx));
    }

    if !conditions.is_empty() {
        sql.push_str(" WHERE ");
        sql.push_str(&conditions.join(" AND "));
    }

    sql.push_str(" ORDER BY created_at DESC");

    let mut q = sqlx::query_as::<_, ProductRow>(&sql);

    if let Some(brand) = &query.brand {
        q = q.bind(format!("%{}%", brand));
    }
    if let Some(kat) = &query.kategori {
        q = q.bind(kat);
    }

    let rows = q.fetch_all(pool).await?;
    let data: Vec<ProductPublic> = rows.into_iter().map(ProductPublic::from).collect();

    Ok(HttpResponse::Ok().json(data))
}

/// GET /api/product/{id}
/// Pakai regex supaya hanya angka → tidak bentrok dengan /product/search
#[get("/product/{id:\\d+}")]
pub async fn get_product(
    state: web::Data<AppState>,
    path: web::Path<i32>,
) -> Result<HttpResponse, ApiError> {
    let id = path.into_inner();

    let row = sqlx::query_as::<_, ProductRow>(
        r#"
        SELECT
            id,
            kode,
            nama,
            brand,
            kategori::text AS kategori,
            satuan::text   AS satuan,
            harga_idr,
            created_at,
            updated_at
        FROM sbpv3.product
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?;

    let row = match row {
        Some(r) => r,
        None => {
            return Err(ApiError::NotFound(format!(
                "Product id {} tidak ditemukan",
                id
            )))
        }
    };

    Ok(HttpResponse::Ok().json(ProductPublic::from(row)))
}

/// POST /api/product
#[post("/product")]
pub async fn create_product(
    state: web::Data<AppState>,
    payload: web::Json<CreateProductRequest>,
) -> Result<HttpResponse, ApiError> {
    let p = payload.into_inner();

    if p.harga_idr <= 0 {
        return Err(ApiError::BadRequest(
            "harga_idr harus > 0 (rupiah)".to_string(),
        ));
    }
    if !is_valid_kategori(&p.kategori) {
        return Err(ApiError::BadRequest(format!(
            "kategori tidak valid: {} (harus Alat / Material / Consumable)",
            p.kategori
        )));
    }
    if !is_valid_satuan(&p.satuan) {
        return Err(ApiError::BadRequest(format!(
            "satuan tidak valid: {}",
            p.satuan
        )));
    }

    let row_result = sqlx::query_as::<_, ProductRow>(
        r#"
        INSERT INTO sbpv3.product (kode, nama, brand, kategori, satuan, harga_idr)
        VALUES (
            $1,
            $2,
            $3,
            $4::sbpv3."kategori_produk",
            $5::sbpv3."satuan_produk",
            $6
        )
        RETURNING
            id,
            kode,
            nama,
            brand,
            kategori::text AS kategori,
            satuan::text   AS satuan,
            harga_idr,
            created_at,
            updated_at
        "#,
    )
    .bind(&p.kode)
    .bind(&p.nama)
    .bind(&p.brand)
    .bind(&p.kategori)
    .bind(&p.satuan)
    .bind(p.harga_idr)
    .fetch_one(&state.db)
    .await;

    let row = match row_result {
        Ok(row) => row,
        Err(e) => {
            if let sqlx::Error::Database(db_err) = &e {
                if db_err.constraint() == Some("product_kode_unique") {
                    return Err(ApiError::BadRequest(
                        "Kode produk sudah terdaftar".to_string(),
                    ));
                }
            }
            return Err(ApiError::from(e));
        }
    };

    let public = ProductPublic::from(row);

    let msg = serde_json::json!({
        "event": "product_created",
        "data": public,
    })
    .to_string();
    let _ = state.tx.send(msg);

    Ok(HttpResponse::Created().json(public))
}

/// PUT /api/product/{id}
#[put("/product/{id:\\d+}")]
pub async fn update_product(
    state: web::Data<AppState>,
    path: web::Path<i32>,
    payload: web::Json<UpdateProductRequest>,
) -> Result<HttpResponse, ApiError> {
    let id = path.into_inner();
    let p = payload.into_inner();

    if let Some(harga) = p.harga_idr {
        if harga <= 0 {
            return Err(ApiError::BadRequest(
                "harga_idr harus > 0 (rupiah)".to_string(),
            ));
        }
    }

    if let Some(ref kat) = p.kategori {
        if !is_valid_kategori(kat) {
            return Err(ApiError::BadRequest(format!(
                "kategori tidak valid: {} (harus Alat / Material / Consumable)",
                kat
            )));
        }
    }
    if let Some(ref sat) = p.satuan {
        if !is_valid_satuan(sat) {
            return Err(ApiError::BadRequest(format!(
                "satuan tidak valid: {}",
                sat
            )));
        }
    }

    let row_opt = sqlx::query_as::<_, ProductRow>(
        r#"
        UPDATE sbpv3.product
        SET
            nama       = COALESCE($2, nama),
            brand      = COALESCE($3, brand),
            kategori   = COALESCE($4::sbpv3."kategori_produk", kategori),
            satuan     = COALESCE($5::sbpv3."satuan_produk", satuan),
            harga_idr  = COALESCE($6, harga_idr),
            updated_at = now()
        WHERE id = $1
        RETURNING
            id,
            kode,
            nama,
            brand,
            kategori::text AS kategori,
            satuan::text   AS satuan,
            harga_idr,
            created_at,
            updated_at
        "#,
    )
    .bind(id)
    .bind(p.nama.as_deref())
    .bind(p.brand.as_deref())
    .bind(p.kategori.as_deref())
    .bind(p.satuan.as_deref())
    .bind(p.harga_idr)
    .fetch_optional(&state.db)
    .await?;

    let row = match row_opt {
        Some(r) => r,
        None => {
          return Err(ApiError::NotFound(format!(
              "Product id {} tidak ditemukan",
              id
          )))
        }
    };

    let public = ProductPublic::from(row);

    let msg = serde_json::json!({
        "event": "product_updated",
        "data": public,
    })
    .to_string();
    let _ = state.tx.send(msg);

    Ok(HttpResponse::Ok().json(public))
}

/// DELETE /api/product/{id}
#[delete("/product/{id:\\d+}")]
pub async fn delete_product(
    state: web::Data<AppState>,
    path: web::Path<i32>,
) -> Result<HttpResponse, ApiError> {
    let id = path.into_inner();

    let row_opt = sqlx::query_as::<_, ProductRow>(
        r#"
        DELETE FROM sbpv3.product
        WHERE id = $1
        RETURNING
            id,
            kode,
            nama,
            brand,
            kategori::text AS kategori,
            satuan::text   AS satuan,
            harga_idr,
            created_at,
            updated_at
        "#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?;

    let row = match row_opt {
        Some(r) => r,
        None => {
            return Err(ApiError::NotFound(format!(
                "Product id {} tidak ditemukan",
                id
            )))
        }
    };

    let public = ProductPublic::from(row);

    let msg = serde_json::json!({
        "event": "product_deleted",
        "data": { "id": public.id, "kode": public.kode }
    })
    .to_string();
    let _ = state.tx.send(msg);

    Ok(HttpResponse::Ok().json(public))
}

/// GET /api/product/search?q=PRD&limit=10
/// - Kalau q kosong → balikin semua product (dibatasi limit)
/// - Kalau q ada → prefix match kode/nama (case-insensitive)
#[get("/product/search")]
pub async fn search_product(
    state: web::Data<AppState>,
    query: web::Query<SearchQuery>,
) -> Result<HttpResponse, ApiError> {
    let q_raw = query.q.trim().to_uppercase();

    // kalau q kosong → pattern "%" (semua product)
    let pattern = if q_raw.is_empty() {
        "%".to_string()
    } else {
        format!("{}%", q_raw)
    };

    let limit = query.limit.unwrap_or(50).clamp(1, 100);

    let rows = sqlx::query_as::<_, ProductRow>(
        r#"
        SELECT
            id,
            kode,
            nama,
            brand,
            kategori::text AS kategori,
            satuan::text   AS satuan,
            harga_idr,
            created_at,
            updated_at
        FROM sbpv3.product
        WHERE UPPER(kode) LIKE $1
           OR UPPER(nama) LIKE $1
        ORDER BY kode ASC
        LIMIT $2
        "#,
    )
    .bind(pattern)
    .bind(limit)
    .fetch_all(&state.db)
    .await?;

    let data: Vec<ProductPublic> = rows.into_iter().map(ProductPublic::from).collect();
    Ok(HttpResponse::Ok().json(data))
}

/// GET /api/product/by-kode/{kode}
#[get("/product/by-kode/{kode}")]
pub async fn get_product_by_kode(
    state: web::Data<AppState>,
    path: web::Path<String>,
) -> Result<HttpResponse, ApiError> {
    let kode = path.into_inner();
    let kode_upper = kode.to_uppercase();

    let row = sqlx::query_as::<_, ProductRow>(
        r#"
        SELECT
            id,
            kode,
            nama,
            brand,
            kategori::text AS kategori,
            satuan::text   AS satuan,
            harga_idr,
            created_at,
            updated_at
        FROM sbpv3.product
        WHERE UPPER(kode) = $1
        "#,
    )
    .bind(kode_upper)
    .fetch_optional(&state.db)
    .await?;

    let row = match row {
        Some(r) => r,
        None => {
            return Err(ApiError::NotFound(format!(
                "Product dengan kode {} tidak ditemukan",
                kode
            )))
        }
    };

    Ok(HttpResponse::Ok().json(ProductPublic::from(row)))
}
