// src/models/product.rs

use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// Enum mapping ke sbpv3."kategori_produk" ('Alat', 'Material', 'Consumable')
///
/// Pastikan di Postgres ada:
///   CREATE TYPE sbpv3."kategori_produk" AS ENUM ('Alat','Material','Consumable');
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "kategori_produk")]
pub enum KategoriProduk {
    #[serde(rename = "Alat")]
    #[sqlx(rename = "Alat")]
    Alat,
    #[serde(rename = "Material")]
    #[sqlx(rename = "Material")]
    Material,
    #[serde(rename = "Consumable")]
    #[sqlx(rename = "Consumable")]
    Consumable,
}

/// Enum mapping ke sbpv3."satuan_produk"
/// ('kg','kgset','liter','literset','pail','galon5liter','galon10liter','pcs','lonjor','sak','unit','drum')
///
/// Pastikan di Postgres ada:
///   CREATE TYPE sbpv3."satuan_produk" AS ENUM (...);
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "satuan_produk")]
pub enum SatuanProduk {
    #[serde(rename = "kg")]
    #[sqlx(rename = "kg")]
    Kg,
    #[serde(rename = "kgset")]
    #[sqlx(rename = "kgset")]
    KgSet,
    #[serde(rename = "liter")]
    #[sqlx(rename = "liter")]
    Liter,
    #[serde(rename = "literset")]
    #[sqlx(rename = "literset")]
    LiterSet,
    #[serde(rename = "pail")]
    #[sqlx(rename = "pail")]
    Pail,
    #[serde(rename = "galon5liter")]
    #[sqlx(rename = "galon5liter")]
    Galon5Liter,
    #[serde(rename = "galon10liter")]
    #[sqlx(rename = "galon10liter")]
    Galon10Liter,
    #[serde(rename = "pcs")]
    #[sqlx(rename = "pcs")]
    Pcs,
    #[serde(rename = "lonjor")]
    #[sqlx(rename = "lonjor")]
    Lonjor,
    #[serde(rename = "sak")]
    #[sqlx(rename = "sak")]
    Sak,
    #[serde(rename = "unit")]
    #[sqlx(rename = "unit")]
    Unit,
    #[serde(rename = "drum")]
    #[sqlx(rename = "drum")]
    Drum,
}

/// Row persis seperti di tabel sbpv3.product
///
/// IMPORTANT:
/// Query di routes HARUS pakai:
///   kategori::text AS kategori,
///   satuan::text   AS satuan
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ProductRow {
    pub id: i32,
    pub kode: String,
    pub nama: String,
    pub brand: String,
    pub kategori: String,
    pub satuan: String,
    pub harga_idr: i32,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

/// Optional query param untuk filter list product
#[derive(Debug, Deserialize)]
pub struct ListQuery {
    pub brand: Option<String>,
    pub kategori: Option<String>,
}

/// Query untuk autocomplete / search
#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    pub q: String,
    pub limit: Option<i64>,
}

/// Bentuk JSON untuk dikirim ke frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductPublic {
    pub id: i32,
    pub kode: String,
    pub nama: String,
    pub brand: String,
    pub kategori: String,
    pub satuan: String,
    pub harga_idr: i32,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

impl From<ProductRow> for ProductPublic {
    fn from(row: ProductRow) -> Self {
        Self {
            id: row.id,
            kode: row.kode,
            nama: row.nama,
            brand: row.brand,
            kategori: row.kategori,
            satuan: row.satuan,
            harga_idr: row.harga_idr,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}

/// Payload untuk POST /api/product
#[derive(Debug, Deserialize)]
pub struct CreateProductRequest {
    pub kode: String,
    pub nama: String,
    pub brand: String,
    pub kategori: String, // FE kirim "Alat" / "Material" / "Consumable"
    pub satuan: String,   // FE kirim "kg", "kgset", dll
    pub harga_idr: i32,
}

/// Payload untuk PUT /api/product/{id} (partial update)
#[derive(Debug, Deserialize)]
pub struct UpdateProductRequest {
    pub nama: Option<String>,
    pub brand: Option<String>,
    pub kategori: Option<String>,
    pub satuan: Option<String>,
    pub harga_idr: Option<i32>,
}
