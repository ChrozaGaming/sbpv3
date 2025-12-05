use chrono::{NaiveDate, NaiveDateTime};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Serialize, FromRow)]
pub struct Stock {
    pub id: i32,
    pub kode: String,
    pub nama: String,
    pub brand: String,          // NEW
    pub kategori: String,
    pub sub_kategori_id: i32,
    pub harga_idr: i32,         // NEW
    pub stok_masuk: i32,
    pub stok_keluar: i32,
    pub stok_sisa: i32,
    pub satuan_id: i32,
    pub lokasi: String,
    pub tanggal_entry: NaiveDate,
    pub tanggal_masuk: Option<NaiveDate>,
    pub tanggal_keluar: Option<NaiveDate>,
    pub keterangan: Option<String>,
    pub created_at: Option<NaiveDateTime>,
    pub updated_at: Option<NaiveDateTime>,

    // join ke satuan
    pub satuan_kode: String,
    pub satuan_nama: String,
}

#[derive(Debug, Serialize, FromRow)]
pub struct StockMovement {
    pub id: i32,
    pub stok_id: i32,
    pub jenis: String,          // enum sbpv3.jenis_pergerakan (di-select sebagai TEXT)
    pub qty: i32,
    pub satuan_id: i32,
    pub sumber_tujuan: Option<String>,
    pub keterangan: Option<String>,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CreateMovementRequest {
    pub stok_id: i32,
    /// "MASUK" atau "KELUAR"
    pub jenis: String,
    pub qty: i32,
    pub sumber_tujuan: Option<String>,
    pub keterangan: Option<String>,
}

// ===== STOK =====

#[derive(Debug, Deserialize)]
pub struct CreateStokRequest {
    pub kode: String,
    pub nama: String,
    pub brand: String,          // NEW
    pub kategori: String,
    pub sub_kategori_id: i32,
    pub harga_idr: i32,         // NEW
    pub stok_masuk: Option<i32>,
    pub stok_keluar: Option<i32>,
    pub stok_sisa: Option<i32>,
    pub satuan_id: i32,
    pub lokasi: String,
    pub tanggal_entry: NaiveDate,
    pub tanggal_masuk: Option<NaiveDate>,
    pub tanggal_keluar: Option<NaiveDate>,
    pub keterangan: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateStokRequest {
    pub nama: String,
    pub brand: String,          // NEW
    pub kategori: String,
    pub sub_kategori_id: i32,
    pub harga_idr: i32,         // NEW
    pub stok_masuk: i32,
    pub stok_keluar: i32,
    pub stok_sisa: i32,
    pub satuan_id: i32,
    pub lokasi: String,
    pub tanggal_entry: NaiveDate,
    pub tanggal_masuk: Option<NaiveDate>,
    pub tanggal_keluar: Option<NaiveDate>,
    pub keterangan: Option<String>,
}

/// ===== Tambah stok (batch-in) dari halaman /tambahstok =====
/// Payload yang dikirim page.tsx:
/// {
///   "tanggal": "2025-11-22",
///   "lokasi": "Gudang A",
///   "jenis_pemasukan": "pembelian_po" | "retur_barang",
///   "items": [
///     { "product_id": 1, "product_kode": "PRD001", "qty": 10, "satuan": "kg" },
///     ...
///   ]
/// }
#[derive(Debug, Deserialize)]
pub struct BatchStockInItemRequest {
    pub product_id: i32,
    pub product_kode: String,
    pub qty: i32,
    pub satuan: String, // dari FE; akan di-crosscheck dengan data product.satuan
}

#[derive(Debug, Deserialize)]
pub struct BatchStockInRequest {
    pub tanggal: NaiveDate,
    pub lokasi: String,
    /// "pembelian_po" atau "retur_barang"
    pub jenis_pemasukan: String,
    pub items: Vec<BatchStockInItemRequest>,
}
