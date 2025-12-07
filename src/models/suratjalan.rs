// src/models/suratjalan.rs

use chrono::{NaiveDate, NaiveDateTime};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// Row untuk list Surat Jalan (header + jumlah barang)
#[derive(Debug, Serialize, FromRow)]
pub struct SuratJalanListRow {
    pub id: i64,
    pub tujuan: String,
    pub nomor_surat: String,
    pub tanggal: NaiveDate,
    pub nomor_kendaraan: Option<String>,
    pub no_po: Option<String>,
    pub keterangan_proyek: Option<String>,
    pub created_at: Option<NaiveDateTime>,
    pub updated_at: Option<NaiveDateTime>,
    pub jumlah_barang: i64,
}

/// Header Surat Jalan (detail view)
#[derive(Debug, Serialize, FromRow)]
pub struct SuratJalanHeader {
    pub id: i64,
    pub tujuan: String,
    pub nomor_surat: String,
    pub tanggal: NaiveDate,
    pub nomor_kendaraan: Option<String>,
    pub no_po: Option<String>,
    pub keterangan_proyek: Option<String>,
    pub created_at: Option<NaiveDateTime>,
    pub updated_at: Option<NaiveDateTime>,
}

/// Detail baris-baris barang dalam Surat Jalan
#[derive(Debug, Serialize, FromRow)]
pub struct SuratJalanDetailRow {
    pub id: i64,
    pub surat_jalan_id: i64,
    pub no_urut: i32,
    pub quantity: i32,
    pub unit: String,
    pub weight: Option<f64>,
    pub kode_barang: String,
    pub nama_barang: String,
}

/// Response detail: header + list barang
#[derive(Debug, Serialize)]
pub struct SuratJalanWithDetails {
    pub header: SuratJalanHeader,
    pub items: Vec<SuratJalanDetailRow>,
}

/// Payload barang dari FE saat create Surat Jalan
#[derive(Debug, Deserialize)]
pub struct SuratJalanBarangRequest {
    pub kode: String,
    pub nama: String,
    pub jumlah: i32,
    pub satuan: String,
    pub berat: Option<f64>,
}

/// Payload create Surat Jalan dari FE
///
/// FE mengirim:
/// {
///   "tujuan": "...",
///   "nomorSurat": "...",
///   "tanggal": "2025-12-05",
///   "nomorKendaraan": "...",
///   "noPo": "...",
///   "keteranganProyek": "...",
///   "barang": [ { kode, nama, jumlah, satuan, berat }, ... ]
/// }
#[derive(Debug, Deserialize)]
pub struct CreateSuratJalanRequest {
    pub tujuan: String,

    #[serde(rename = "nomorSurat")]
    pub nomor_surat: String,

    pub tanggal: NaiveDate,

    #[serde(rename = "nomorKendaraan")]
    pub nomor_kendaraan: Option<String>,

    #[serde(rename = "noPo")]
    pub no_po: Option<String>,

    #[serde(rename = "keteranganProyek")]
    pub keterangan_proyek: Option<String>,

    pub barang: Vec<SuratJalanBarangRequest>,
}

/// Query string untuk list surat jalan (search, sort, pagination)
#[derive(Debug, Deserialize)]
pub struct ListSuratJalanQuery {
    pub search: Option<String>,
    pub field: Option<String>,
    pub sort: Option<String>,
    pub order: Option<String>,
    pub page: Option<i64>,
    pub limit: Option<i64>,
}

/// Struktur pagination untuk response list
#[derive(Debug, Serialize)]
pub struct PaginationMeta {
    pub total_pages: i64,
    pub current_page: i64,
    pub total_items: i64,
}

/// Response list surat jalan: data + pagination
#[derive(Debug, Serialize)]
pub struct ListSuratJalanResponse {
    pub data: Vec<SuratJalanListRow>,
    pub pagination: PaginationMeta,
}
