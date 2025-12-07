// src/routes/suratjalan.rs

use actix_web::{delete, get, post, web, HttpResponse};
use sqlx;

use crate::{error::ApiError, models::suratjalan::*, state::AppState};

/// GET /api/surat-jalan
/// List surat jalan dengan search + sort + pagination
#[get("/surat-jalan")]
pub async fn list_surat_jalan(
    state: web::Data<AppState>,
    query: web::Query<ListSuratJalanQuery>,
) -> Result<HttpResponse, ApiError> {
    let q = query.into_inner();

    let page = q.page.unwrap_or(1).max(1);
    let limit = q.limit.unwrap_or(10).max(1);
    let offset = (page - 1) * limit;

    // field yang boleh dipakai untuk SEARCH (ILIKE)
    let allowed_search_fields = ["nomor_surat", "no_po", "tujuan", "keterangan_proyek"];

    // field yang boleh dipakai untuk SORT (ORDER BY)
    let allowed_sort_fields = [
        "id",
        "nomor_surat",
        "no_po",
        "tujuan",
        "keterangan_proyek",
        "tanggal",
    ];

    let field_safe = q
        .field
        .as_deref()
        .filter(|f| allowed_search_fields.contains(f))
        .unwrap_or("nomor_surat");

    let sort_safe = q
        .sort
        .as_deref()
        .filter(|f| allowed_sort_fields.contains(f))
        .unwrap_or("id");

    let order = q.order.as_deref().unwrap_or("DESC").to_uppercase();
    let order_safe = if order == "ASC" { "ASC" } else { "DESC" };

    let search = q.search.unwrap_or_default().trim().to_string();
    let has_search = !search.is_empty();
    let like_pattern = format!("%{}%", search);

    println!(
        "📦 [list_surat_jalan] page={} limit={} search='{}' field='{}' sort='{}' order='{}'",
        page, limit, search, field_safe, sort_safe, order_safe
    );

    // ---------- Hitung total ----------
    let total_items: i64 = if has_search {
        // hanya kolom string yang boleh di-ILIKE (sudah dibatasi di allowed_search_fields)
        let sql = format!(
            r#"
            SELECT COUNT(*) AS total
            FROM sbpv3.surat_jalan sj
            WHERE sj.{} ILIKE $1
            "#,
            field_safe
        );

        sqlx::query_scalar::<_, i64>(&sql)
            .bind(&like_pattern)
            .fetch_one(&state.db)
            .await?
    } else {
        let sql = r#"
            SELECT COUNT(*) AS total
            FROM sbpv3.surat_jalan
        "#;

        sqlx::query_scalar::<_, i64>(sql)
            .fetch_one(&state.db)
            .await?
    };

    let total_pages = if total_items == 0 {
        1
    } else {
        (total_items as f64 / limit as f64).ceil() as i64
    };

    // ---------- Ambil data ----------
    // Catatan penting:
    // created_at & updated_at di DB adalah TIMESTAMPTZ,
    // tapi di struct kita pakai NaiveDateTime.
    // Supaya tidak terjadi decode error di sqlx, kita CAST ke TIMESTAMP (tanpa TZ).
    let rows: Vec<SuratJalanListRow> = if has_search {
        let sql = format!(
            r#"
            SELECT 
                sj.id,
                sj.tujuan,
                sj.nomor_surat,
                sj.tanggal,
                sj.nomor_kendaraan,
                sj.no_po,
                sj.keterangan_proyek,
                (sj.created_at AT TIME ZONE 'UTC')::timestamp AS created_at,
                (sj.updated_at AT TIME ZONE 'UTC')::timestamp AS updated_at,
                COALESCE(
                    (
                        SELECT COUNT(*)
                        FROM sbpv3.surat_jalan_detail d
                        WHERE d.surat_jalan_id = sj.id
                    ),
                    0
                ) AS jumlah_barang
            FROM sbpv3.surat_jalan sj
            WHERE sj.{} ILIKE $1
            ORDER BY sj.{} {}
            LIMIT $2 OFFSET $3
            "#,
            field_safe, sort_safe, order_safe
        );

        sqlx::query_as::<_, SuratJalanListRow>(&sql)
            .bind(&like_pattern)
            .bind(limit)
            .bind(offset)
            .fetch_all(&state.db)
            .await?
    } else {
        let sql = format!(
            r#"
            SELECT 
                sj.id,
                sj.tujuan,
                sj.nomor_surat,
                sj.tanggal,
                sj.nomor_kendaraan,
                sj.no_po,
                sj.keterangan_proyek,
                (sj.created_at AT TIME ZONE 'UTC')::timestamp AS created_at,
                (sj.updated_at AT TIME ZONE 'UTC')::timestamp AS updated_at,
                COALESCE(
                    (
                        SELECT COUNT(*)
                        FROM sbpv3.surat_jalan_detail d
                        WHERE d.surat_jalan_id = sj.id
                    ),
                    0
                ) AS jumlah_barang
            FROM sbpv3.surat_jalan sj
            ORDER BY sj.{} {}
            LIMIT $1 OFFSET $2
            "#,
            sort_safe, order_safe
        );

        sqlx::query_as::<_, SuratJalanListRow>(&sql)
            .bind(limit)
            .bind(offset)
            .fetch_all(&state.db)
            .await?
    };

    let resp = ListSuratJalanResponse {
        data: rows,
        pagination: PaginationMeta {
            total_pages,
            current_page: page,
            total_items,
        },
    };

    Ok(HttpResponse::Ok().json(resp))
}

/// GET /api/surat-jalan/{id}
/// Ambil header + detail barang untuk 1 Surat Jalan
#[get("/surat-jalan/{id}")]
pub async fn get_surat_jalan(
    state: web::Data<AppState>,
    path: web::Path<i64>,
) -> Result<HttpResponse, ApiError> {
    let id = path.into_inner();

    // Sama seperti list: created_at & updated_at di-cast supaya aman ke NaiveDateTime
    let header = sqlx::query_as::<_, SuratJalanHeader>(
        r#"
        SELECT 
            id,
            tujuan,
            nomor_surat,
            tanggal,
            nomor_kendaraan,
            no_po,
            keterangan_proyek,
            (created_at AT TIME ZONE 'UTC')::timestamp AS created_at,
            (updated_at AT TIME ZONE 'UTC')::timestamp AS updated_at
        FROM sbpv3.surat_jalan
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?;

    let header = match header {
        Some(h) => h,
        None => return Err(ApiError::NotFound("Surat jalan tidak ditemukan".into())),
    };

    // ✅ CAST quantity & weight agar cocok dengan i32 & f64
    let items = sqlx::query_as::<_, SuratJalanDetailRow>(
        r#"
        SELECT 
            id,
            surat_jalan_id,
            no_urut,
            quantity::INT4       AS quantity,
            unit,
            weight::DOUBLE PRECISION AS weight,
            kode_barang,
            nama_barang
        FROM sbpv3.surat_jalan_detail
        WHERE surat_jalan_id = $1
        ORDER BY no_urut ASC
        "#,
    )
    .bind(id)
    .fetch_all(&state.db)
    .await?;

    let resp = SuratJalanWithDetails { header, items };

    Ok(HttpResponse::Ok().json(resp))
}

/// POST /api/surat-jalan
/// Insert header + detail, update stok (stok_keluar + stok_sisa),
/// insert stok_movements, dan broadcast event WebSocket.
#[post("/surat-jalan")]
pub async fn create_surat_jalan(
    state: web::Data<AppState>,
    payload: web::Json<CreateSuratJalanRequest>,
) -> Result<HttpResponse, ApiError> {
    let body = payload.into_inner();

    if body.tujuan.trim().is_empty() {
        return Err(ApiError::BadRequest("Tujuan wajib diisi".into()));
    }

    if body.nomor_surat.trim().is_empty() {
        return Err(ApiError::BadRequest("Nomor Surat wajib diisi".into()));
    }

    if body.barang.is_empty() {
        return Err(ApiError::BadRequest(
            "Minimal satu barang harus ditambahkan".into(),
        ));
    }

    let mut tx = state.db.begin().await?;

    // Cek unik nomor_surat
    let existing: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)::bigint
        FROM sbpv3.surat_jalan
        WHERE nomor_surat = $1
        "#,
    )
    .bind(&body.nomor_surat)
    .fetch_one(&mut *tx)
    .await?;

    if existing > 0 {
        return Err(ApiError::BadRequest("Nomor Surat sudah digunakan".into()));
    }

    // Insert header surat_jalan
    let header_row = sqlx::query!(
        r#"
        INSERT INTO sbpv3.surat_jalan
            (tujuan, nomor_surat, tanggal, nomor_kendaraan, no_po, keterangan_proyek, created_at, updated_at)
        VALUES
            ($1, $2, $3, $4, $5, $6,
             (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'),
             (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'))
        RETURNING id
        "#,
        body.tujuan,
        body.nomor_surat,
        body.tanggal,
        body.nomor_kendaraan,
        body.no_po,
        body.keterangan_proyek,
    )
    .fetch_one(&mut *tx)
    .await?;

    let surat_jalan_id = header_row.id;
    let mut no_urut: i32 = 1;

    // Kumpulan event movement untuk dikirim via WebSocket setelah commit
    let mut movement_events: Vec<serde_json::Value> = Vec::new();

    // Insert detail + update stok + insert stok_movements
    for item in &body.barang {
        if item.jumlah <= 0 {
            return Err(ApiError::BadRequest(format!(
                "Jumlah untuk barang {} harus lebih dari 0",
                item.kode
            )));
        }

        // ✅ Detail: cast quantity & weight agar tidak butuh bigdecimal
        sqlx::query!(
            r#"
            INSERT INTO sbpv3.surat_jalan_detail
                (surat_jalan_id, no_urut, quantity, unit, weight, kode_barang, nama_barang)
            VALUES
                ($1, $2, $3::INT4, $4, $5::DOUBLE PRECISION, $6, $7)
            "#,
            surat_jalan_id,
            no_urut,
            item.jumlah,
            item.satuan,
            item.berat,
            item.kode,
            item.nama,
        )
        .execute(&mut *tx)
        .await?;

        // Ambil stok by kode (lock FOR UPDATE supaya aman di concurrent write)
        let stok_row = sqlx::query!(
            r#"
            SELECT id, stok_sisa, stok_keluar, satuan_id
            FROM sbpv3.stok
            WHERE kode = $1
            FOR UPDATE
            "#,
            item.kode,
        )
        .fetch_optional(&mut *tx)
        .await?;

        let stok = match stok_row {
            Some(s) => s,
            None => {
                return Err(ApiError::BadRequest(format!(
                    "Stok dengan kode '{}' tidak ditemukan",
                    item.kode
                )));
            }
        };

        // hitung stok_sisa baru
        let new_sisa = stok.stok_sisa - item.jumlah;
        if new_sisa < 0 {
            return Err(ApiError::BadRequest(format!(
                "Stok tidak cukup untuk barang '{}' (stok_sisa={}, diminta={})",
                item.kode, stok.stok_sisa, item.jumlah
            )));
        }

        let new_keluar = stok.stok_keluar + item.jumlah;

        // Update stok: stok_keluar + stok_sisa + tanggal_keluar
        sqlx::query!(
            r#"
            UPDATE sbpv3.stok
            SET
                stok_keluar = $1,
                stok_sisa   = $2,
                tanggal_keluar = $3,
                updated_at = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta')
            WHERE id = $4
            "#,
            new_keluar,
            new_sisa,
            body.tanggal,
            stok.id,
        )
        .execute(&mut *tx)
        .await?;

        // Insert movement KELUAR ke stok_movements
        sqlx::query!(
            r#"
            INSERT INTO sbpv3.stok_movements
                (stok_id, jenis, qty, satuan_id, sumber_tujuan, keterangan, created_at)
            VALUES (
                $1,
                'KELUAR'::sbpv3.jenis_pergerakan,
                $2,
                $3,
                $4,
                $5,
                (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta')
            )
            "#,
            stok.id,
            item.jumlah,
            stok.satuan_id,
            body.tujuan,
            format!("Surat Jalan {}", body.nomor_surat),
        )
        .execute(&mut *tx)
        .await?;

        // Simpan payload event movement agar bisa di-broadcast setelah commit
        movement_events.push(serde_json::json!({
            "event": "movement_created",
            "stok_id": stok.id,
            "jenis": "KELUAR",
            "qty": item.jumlah,
            "stok_sisa_baru": new_sisa,
            "sumber_tujuan": body.tujuan,
            "keterangan": format!("Surat Jalan {}", body.nomor_surat),
            "kode_barang": item.kode,
            "nama_barang": item.nama,
            "surat_jalan_id": surat_jalan_id,
        }));

        no_urut += 1;
    }

    tx.commit().await?;

    // Broadcast event ringkas surat_jalan_created
    let sj_event = serde_json::json!({
        "event": "surat_jalan_created",
        "id": surat_jalan_id,
        "nomor_surat": body.nomor_surat,
        "tanggal": body.tanggal,
        "tujuan": body.tujuan,
        "jumlah_barang": body.barang.len(),
    });
    let _ = state.tx.send(sj_event.to_string());

    // Broadcast juga setiap movement_created supaya panel log stok bisa real-time
    for ev in movement_events {
        let _ = state.tx.send(ev.to_string());
    }

    Ok(HttpResponse::Created().json(serde_json::json!({
        "message": "Surat jalan berhasil dibuat",
        "id": surat_jalan_id
    })))
}

/// DELETE /api/surat-jalan/{id}
/// Pulihkan stok + hapus header & detail
#[delete("/surat-jalan/{id}")]
pub async fn delete_surat_jalan(
    state: web::Data<AppState>,
    path: web::Path<i64>,
) -> Result<HttpResponse, ApiError> {
    let id = path.into_inner();

    let mut tx = state.db.begin().await?;

    // Pastikan header ada
    let exists: Option<(i64,)> = sqlx::query_as(
        r#"
        SELECT id
        FROM sbpv3.surat_jalan
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(&mut *tx)
    .await?;

    if exists.is_none() {
        return Err(ApiError::NotFound("Surat jalan tidak ditemukan".into()));
    }

    // Ambil detail untuk memulihkan stok
    // ✅ CAST quantity -> INT4 supaya tidak butuh NUMERIC/bigdecimal
    let details = sqlx::query!(
        r#"
        SELECT 
            kode_barang, 
            quantity::INT4 AS quantity
        FROM sbpv3.surat_jalan_detail
        WHERE surat_jalan_id = $1
        "#,
        id
    )
    .fetch_all(&mut *tx)
    .await?;

    // Kembalikan stok
    for d in &details {
        sqlx::query!(
            r#"
            UPDATE sbpv3.stok
            SET
                stok_keluar = stok_keluar - $1,
                stok_sisa   = stok_sisa   + $1,
                updated_at = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta')
            WHERE kode = $2
            "#,
            d.quantity,
            d.kode_barang,
        )
        .execute(&mut *tx)
        .await?;
    }

    // Hapus detail
    sqlx::query!(
        r#"
        DELETE FROM sbpv3.surat_jalan_detail
        WHERE surat_jalan_id = $1
        "#,
        id
    )
    .execute(&mut *tx)
    .await?;

    // Hapus header
    sqlx::query!(
        r#"
        DELETE FROM sbpv3.surat_jalan
        WHERE id = $1
        "#,
        id
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "Surat jalan berhasil dihapus dan stok dipulihkan"
    })))
}
