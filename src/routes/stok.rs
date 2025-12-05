use actix_web::{get, post, put, delete, web, HttpResponse};
use crate::{error::ApiError, models::stok::*, state::AppState};

/// GET /api/stok
/// List semua stock dengan join satuan
#[get("/stok")]
pub async fn list_stok(state: web::Data<AppState>) -> Result<HttpResponse, ApiError> {
    let stocks = sqlx::query_as::<_, Stock>(
        r#"
        SELECT 
            s.id,
            s.kode,
            s.nama,
            s.brand,
            s.kategori,
            s.sub_kategori_id,
            s.harga_idr,
            s.stok_masuk,
            s.stok_keluar,
            s.stok_sisa,
            s.satuan_id,
            s.lokasi,
            s.tanggal_entry,
            s.tanggal_masuk,
            s.tanggal_keluar,
            s.keterangan,
            s.created_at,
            s.updated_at,
            sat.kode AS satuan_kode,
            sat.nama AS satuan_nama
        FROM sbpv3.stok s
        JOIN sbpv3.satuan sat ON sat.id = s.satuan_id
        ORDER BY s.kode ASC
        "#
    )
    .fetch_all(&state.db)
    .await?;

    Ok(HttpResponse::Ok().json(stocks))
}

/// GET /api/stok/{id}
#[get("/stok/{id}")]
pub async fn get_stok(
    state: web::Data<AppState>,
    path: web::Path<i32>,
) -> Result<HttpResponse, ApiError> {
    let id = path.into_inner();

    let row = sqlx::query_as::<_, Stock>(
        r#"
        SELECT 
            s.id,
            s.kode,
            s.nama,
            s.brand,
            s.kategori,
            s.sub_kategori_id,
            s.harga_idr,
            s.stok_masuk,
            s.stok_keluar,
            s.stok_sisa,
            s.satuan_id,
            s.lokasi,
            s.tanggal_entry,
            s.tanggal_masuk,
            s.tanggal_keluar,
            s.keterangan,
            s.created_at,
            s.updated_at,
            sat.kode AS satuan_kode,
            sat.nama AS satuan_nama
        FROM sbpv3.stok s
        JOIN sbpv3.satuan sat ON sat.id = s.satuan_id
        WHERE s.id = $1
        "#
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?;

    match row {
        Some(stok) => Ok(HttpResponse::Ok().json(stok)),
        None => Err(ApiError::NotFound("Stok tidak ditemukan".into())),
    }
}

/// POST /api/stok
#[post("/stok")]
pub async fn create_stok(
    state: web::Data<AppState>,
    payload: web::Json<CreateStokRequest>,
) -> Result<HttpResponse, ApiError> {
    let body = payload.into_inner();

    // cek kode unik
    let existing: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)::bigint
        FROM sbpv3.stok
        WHERE kode = $1
        "#
    )
    .bind(&body.kode)
    .fetch_one(&state.db)
    .await?;

    if existing > 0 {
        return Err(ApiError::BadRequest("Kode stok sudah digunakan".into()));
    }

    let stok_masuk = body.stok_masuk.unwrap_or(0);
    let stok_keluar = body.stok_keluar.unwrap_or(0);
    let stok_sisa = body.stok_sisa.unwrap_or(stok_masuk - stok_keluar);

    sqlx::query(
        r#"
        INSERT INTO sbpv3.stok
        (kode, nama, brand, kategori, sub_kategori_id, harga_idr,
         stok_masuk, stok_keluar, stok_sisa,
         satuan_id, lokasi, tanggal_entry, tanggal_masuk, tanggal_keluar, keterangan)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        "#
    )
    .bind(&body.kode)
    .bind(&body.nama)
    .bind(&body.brand)
    .bind(&body.kategori)
    .bind(body.sub_kategori_id)
    .bind(body.harga_idr)
    .bind(stok_masuk)
    .bind(stok_keluar)
    .bind(stok_sisa)
    .bind(body.satuan_id)
    .bind(&body.lokasi)
    .bind(body.tanggal_entry)
    .bind(body.tanggal_masuk)
    .bind(body.tanggal_keluar)
    .bind(body.keterangan)
    .execute(&state.db)
    .await?;

    // 🔔 Broadcast event stok_created
    let event = serde_json::json!({
        "event": "stok_created",
        "kode": body.kode,
        "nama": body.nama,
        "brand": body.brand,
        "harga_idr": body.harga_idr,
        "stok_sisa": stok_sisa,
    });
    let _ = state.tx.send(event.to_string());

    Ok(HttpResponse::Created().json(serde_json::json!({
        "message": "Stok dibuat"
    })))
}

/// PUT /api/stok/{id}
#[put("/stok/{id}")]
pub async fn update_stok(
    state: web::Data<AppState>,
    path: web::Path<i32>,
    payload: web::Json<UpdateStokRequest>,
) -> Result<HttpResponse, ApiError> {
    let id = path.into_inner();
    let body = payload.into_inner();

    let res = sqlx::query(
        r#"
        UPDATE sbpv3.stok
        SET nama = $1,
            brand = $2,
            kategori = $3,
            sub_kategori_id = $4,
            harga_idr = $5,
            stok_masuk = $6,
            stok_keluar = $7,
            stok_sisa = $8,
            satuan_id = $9,
            lokasi = $10,
            tanggal_entry = $11,
            tanggal_masuk = $12,
            tanggal_keluar = $13,
            keterangan = $14,
            updated_at = NOW()
        WHERE id = $15
        "#
    )
    .bind(&body.nama)
    .bind(&body.brand)
    .bind(&body.kategori)
    .bind(body.sub_kategori_id)
    .bind(body.harga_idr)
    .bind(body.stok_masuk)
    .bind(body.stok_keluar)
    .bind(body.stok_sisa)
    .bind(body.satuan_id)
    .bind(&body.lokasi)
    .bind(body.tanggal_entry)
    .bind(body.tanggal_masuk)
    .bind(body.tanggal_keluar)
    .bind(body.keterangan)
    .bind(id)
    .execute(&state.db)
    .await?;

    if res.rows_affected() == 0 {
        return Err(ApiError::NotFound("Stok tidak ditemukan".into()));
    }

    // 🔔 Broadcast event stok_updated
    let event = serde_json::json!({
        "event": "stok_updated",
        "stok_id": id,
        "stok_sisa": body.stok_sisa,
        "harga_idr": body.harga_idr,
    });
    let _ = state.tx.send(event.to_string());

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "Stok diperbarui"
    })))
}

/// DELETE /api/stok/{id}
#[delete("/stok/{id}")]
pub async fn delete_stok(
    state: web::Data<AppState>,
    path: web::Path<i32>,
) -> Result<HttpResponse, ApiError> {
    let id = path.into_inner();

    let res = sqlx::query(
        r#"
        DELETE FROM sbpv3.stok
        WHERE id = $1
        "#
    )
    .bind(id)
    .execute(&state.db)
    .await?;

    if res.rows_affected() == 0 {
        return Err(ApiError::NotFound("Stok tidak ditemukan".into()));
    }

    // 🔔 Broadcast event stok_deleted
    let event = serde_json::json!({
        "event": "stok_deleted",
        "stok_id": id,
    });
    let _ = state.tx.send(event.to_string());

    Ok(HttpResponse::NoContent().finish())
}

/// GET /api/stok/low
/// Ambil item yang stok_sisa < threshold
#[get("/stok/low")]
pub async fn list_low_stok(state: web::Data<AppState>) -> Result<HttpResponse, ApiError> {
    let stocks = sqlx::query_as::<_, Stock>(
        r#"
        SELECT 
            s.id,
            s.kode,
            s.nama,
            s.brand,
            s.kategori,
            s.sub_kategori_id,
            s.harga_idr,
            s.stok_masuk,
            s.stok_keluar,
            s.stok_sisa,
            s.satuan_id,
            s.lokasi,
            s.tanggal_entry,
            s.tanggal_masuk,
            s.tanggal_keluar,
            s.keterangan,
            s.created_at,
            s.updated_at,
            sat.kode AS satuan_kode,
            sat.nama AS satuan_nama
        FROM sbpv3.stok s
        JOIN sbpv3.satuan sat ON sat.id = s.satuan_id
        WHERE s.stok_sisa < 50
        ORDER BY s.stok_sisa ASC
        "#
    )
    .fetch_all(&state.db)
    .await?;

    Ok(HttpResponse::Ok().json(stocks))
}

/// GET /api/stok/movements/recent
/// Log pergerakan stok terbaru (limit 20)
#[get("/stok/movements/recent")]
pub async fn list_recent_movements(
    state: web::Data<AppState>,
) -> Result<HttpResponse, ApiError> {
    let rows = sqlx::query_as::<_, StockMovement>(
        r#"
        SELECT
            m.id,
            m.stok_id,
            m.jenis::TEXT,
            m.qty,
            m.satuan_id,
            m.sumber_tujuan,
            m.keterangan,
            m.created_at
        FROM sbpv3.stok_movements m
        ORDER BY m.created_at DESC
        LIMIT 20
        "#
    )
    .fetch_all(&state.db)
    .await?;

    Ok(HttpResponse::Ok().json(rows))
}

/// POST /api/stok/movements
#[post("/stok/movements")]
pub async fn create_movement(
    state: web::Data<AppState>,
    payload: web::Json<CreateMovementRequest>,
) -> Result<HttpResponse, ApiError> {
    let req = payload.into_inner();

    // validasi jenis
    let jenis_upper = req.jenis.to_uppercase();
    if jenis_upper != "MASUK" && jenis_upper != "KELUAR" {
        return Err(ApiError::BadRequest(
            "jenis harus 'MASUK' atau 'KELUAR'".into(),
        ));
    }

    // Ambil satuan_id dari stok
    let stok_row = sqlx::query!(
        r#"
        SELECT id, stok_sisa, satuan_id 
        FROM sbpv3.stok 
        WHERE id = $1
        "#,
        req.stok_id
    )
    .fetch_optional(&state.db)
    .await?;

    let stok = match stok_row {
        Some(s) => s,
        None => return Err(ApiError::NotFound("Stok tidak ditemukan".into())),
    };

    // hitung stok_sisa baru
    let new_sisa = if jenis_upper == "MASUK" {
        stok.stok_sisa + req.qty
    } else {
        stok.stok_sisa - req.qty
    };

    if new_sisa < 0 {
        return Err(ApiError::BadRequest(
            "Stok tidak mencukupi untuk KELUAR".into(),
        ));
    }

    // dalam transaction: insert movement + update stok
    let mut tx = state.db.begin().await?;

    sqlx::query(
        r#"
        INSERT INTO sbpv3.stok_movements
        (stok_id, jenis, qty, satuan_id, sumber_tujuan, keterangan)
        VALUES ($1, $2::sbpv3.jenis_pergerakan, $3, $4, $5, $6)
        "#
    )
    .bind(req.stok_id)
    .bind(jenis_upper.as_str())  // kirim sebagai TEXT, di-cast di SQL
    .bind(req.qty)
    .bind(stok.satuan_id)
    .bind(req.sumber_tujuan.clone())
    .bind(req.keterangan.clone())
    .execute(&mut *tx)
    .await?;

    sqlx::query!(
        r#"
        UPDATE sbpv3.stok
        SET stok_sisa = $1,
            updated_at = NOW()
        WHERE id = $2
        "#,
        new_sisa,
        req.stok_id
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    let event = serde_json::json!({
        "event": "movement_created",
        "stok_id": req.stok_id,
        "jenis": jenis_upper,
        "qty": req.qty,
        "stok_sisa_baru": new_sisa,
        "sumber_tujuan": req.sumber_tujuan,
        "keterangan": req.keterangan,
    });
    let _ = state.tx.send(event.to_string());

    Ok(HttpResponse::Ok().json(event))
}

/// POST /api/stock-movements/batch-in
/// Dipakai oleh page /tambahstok:
/// - Ambil master product
/// - Mapping ke satuan_id
/// - Upsert ke sbpv3.stok (per kode+lokasi+satuan)
/// - Insert sbpv3.stok_movements jenis MASUK + jenis_pemasukan (PEMBELIAN_PO/RETUR_BARANG)
/// - Broadcast event WebSocket "batch_stock_in"
#[post("/stock-movements/batch-in")]
pub async fn batch_stock_in(
    state: web::Data<AppState>,
    payload: web::Json<BatchStockInRequest>,
) -> Result<HttpResponse, ApiError> {
    let body = payload.into_inner();

    if body.items.is_empty() {
        return Err(ApiError::BadRequest(
            "items tidak boleh kosong".into(),
        ));
    }

    let jenis_pemasukan_lower = body.jenis_pemasukan.to_lowercase();
    if jenis_pemasukan_lower != "pembelian_po" && jenis_pemasukan_lower != "retur_barang" {
        return Err(ApiError::BadRequest(
            "jenis_pemasukan harus 'pembelian_po' atau 'retur_barang'".into(),
        ));
    }

    let jenis_pemasukan_db: String = match jenis_pemasukan_lower.as_str() {
        "pembelian_po" => "PEMBELIAN_PO".to_string(),
        "retur_barang" => "RETUR_BARANG".to_string(),
        _ => unreachable!(),
    };

    let lokasi = body.lokasi.clone();
    let tanggal = body.tanggal;

    let mut tx = state.db.begin().await?;

    let mut movement_items: Vec<serde_json::Value> = Vec::new();

    for item in body.items {
        // abaikan qty <= 0
        if item.qty <= 0 {
            continue;
        }

        // Ambil master product (sekalian ambil enum kategori & satuan sebagai TEXT)
        let p = sqlx::query!(
            r#"
            SELECT 
                p.id,
                p.kode,
                p.nama,
                p.brand,
                p.kategori::TEXT as "kategori!",
                p.satuan::TEXT as "satuan!",
                p.harga_idr
            FROM sbpv3.product p
            WHERE p.id = $1 AND p.kode = $2
            "#,
            item.product_id,
            item.product_kode,
        )
        .fetch_optional(&mut *tx)
        .await?;

                let p = match p {
            Some(row) => row,
            None => {
                return Err(ApiError::BadRequest(format!(
                    "Produk dengan id={} dan kode={} tidak ditemukan",
                    item.product_id, item.product_kode
                )));
            }
        };

        // ✅ VALIDASI: satuan dari FE vs satuan master product
        if !item.satuan.is_empty()
            && item.satuan.to_lowercase() != p.satuan.to_lowercase()
        {
            return Err(ApiError::BadRequest(format!(
                "Satuan item untuk produk {} tidak sesuai master (FE='{}', DB='{}')",
                p.kode, item.satuan, p.satuan
            )));
        }

        // Ambil satuan_id berdasarkan kode satuan (diasumsikan sama dengan enum product.satuan)
        let satuan = sqlx::query!(
            r#"
            SELECT id 
            FROM sbpv3.satuan
            WHERE kode = $1
            "#,
            p.satuan
        )
        .fetch_optional(&mut *tx)
        .await?;

        let satuan = match satuan {
            Some(s) => s,
            None => {
                return Err(ApiError::BadRequest(format!(
                    "Satuan dengan kode '{}' tidak ditemukan di tabel sbpv3.satuan",
                    p.satuan
                )));
            }
        };

        // Cek apakah stok untuk (kode+lokasi+satuan) sudah ada
        let stok_row = sqlx::query!(
            r#"
            SELECT 
                id, stok_masuk, stok_sisa
            FROM sbpv3.stok
            WHERE kode = $1
              AND lokasi = $2
              AND satuan_id = $3
            FOR UPDATE
            "#,
            p.kode,
            lokasi,
            satuan.id,
        )
        .fetch_optional(&mut *tx)
        .await?;

        let qty_i32 = item.qty;

        let stok_id: i32;
        let stok_sisa_baru: i32;

        if let Some(stok) = stok_row {
            let stok_masuk_baru = stok.stok_masuk + qty_i32;
            let stok_sisa_new = stok.stok_sisa + qty_i32;

            sqlx::query!(
                r#"
                UPDATE sbpv3.stok
                SET stok_masuk = $1,
                    stok_sisa = $2,
                    tanggal_masuk = $3,
                    updated_at = NOW()
                WHERE id = $4
                "#,
                stok_masuk_baru,
                stok_sisa_new,
                tanggal,
                stok.id,
            )
            .execute(&mut *tx)
            .await?;

            stok_id = stok.id;
            stok_sisa_baru = stok_sisa_new;
        } else {
            // sub_kategori_id sementara 0 (bisa diganti nanti)
            let row = sqlx::query!(
                r#"
                INSERT INTO sbpv3.stok
                    (kode, nama, brand, kategori, sub_kategori_id, harga_idr,
                     stok_masuk, stok_keluar, stok_sisa,
                     satuan_id, lokasi, tanggal_entry, tanggal_masuk, tanggal_keluar, keterangan)
                VALUES ($1,$2,$3,$4,$5,$6,$7,0,$8,$9,$10,$11,$12,NULL,NULL)
                RETURNING id, stok_sisa
                "#,
                p.kode,
                p.nama,
                p.brand,
                p.kategori,
                0_i32,
                p.harga_idr,
                qty_i32,
                qty_i32,
                satuan.id,
                lokasi,
                tanggal,
                tanggal
            )
            .fetch_one(&mut *tx)
            .await?;

            stok_id = row.id;
            stok_sisa_baru = row.stok_sisa;
        }

        // Insert movement MASUK + jenis_pemasukan
        sqlx::query(
            r#"
            INSERT INTO sbpv3.stok_movements
                (stok_id, jenis, qty, satuan_id, sumber_tujuan, keterangan, jenis_pemasukan)
            VALUES ($1, 'MASUK'::sbpv3.jenis_pergerakan, $2, $3, NULL, NULL, $4::sbpv3.jenis_pemasukan)
            "#
        )
        .bind(stok_id)
        .bind(qty_i32)
        .bind(satuan.id)
        .bind(jenis_pemasukan_db.as_str())
        .execute(&mut *tx)
        .await?;

        movement_items.push(serde_json::json!({
            "stok_id": stok_id,
            "product_id": p.id,
            "product_kode": p.kode,
            "nama": p.nama,
            "brand": p.brand,
            "qty": qty_i32,
            "satuan": p.satuan,
            "stok_sisa_baru": stok_sisa_baru,
            "harga_idr": p.harga_idr,
            "nilai_total": (p.harga_idr as i64) * (qty_i32 as i64),
        }));
    }

    tx.commit().await?;

    // Hitung total nilai stok masuk
    let mut total_nilai: i64 = 0;
    for it in &movement_items {
        if let Some(v) = it.get("nilai_total").and_then(|v| v.as_i64()) {
            total_nilai += v;
        }
    }

    let event = serde_json::json!({
        "event": "batch_stock_in",
        "lokasi": lokasi,
        "tanggal": tanggal,
        "jenis_pemasukan": jenis_pemasukan_db,
        "total_nilai": total_nilai,
        "items": movement_items,
    });

    let _ = state.tx.send(event.to_string());

    Ok(HttpResponse::Ok().json(event))
}
