use chrono::{NaiveDate, NaiveDateTime};
use serde::{Serialize, Deserialize};
use sqlx::FromRow;

#[derive(Debug, Serialize, FromRow)]
pub struct SuratJalan {
    pub id: i32,
    pub nomor: String,
    pub tujuan: String,
    pub alamat_tujuan: Option<String>,
    pub tanggal_kirim: NaiveDate,
    pub status: String,
    pub catatan: Option<String>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CreateSuratJalanRequest {
    pub nomor: String,
    pub tujuan: String,
    pub alamat_tujuan: Option<String>,
    pub tanggal_kirim: NaiveDate,
    /// Optional; kalau None akan pakai default 'DIKIRIM'
    pub status: Option<String>,
    pub catatan: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateSuratJalanRequest {
    pub tujuan: String,
    pub alamat_tujuan: Option<String>,
    pub tanggal_kirim: NaiveDate,
    pub status: String,
    pub catatan: Option<String>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct SuratJalanItem {
    pub id: i32,
    pub surat_jalan_id: i32,
    pub stok_id: i32,
    pub qty: i32,
    pub satuan_id: i32,
    pub keterangan: Option<String>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct SuratJalanItemWithDetail {
    pub id: i32,
    pub surat_jalan_id: i32,
    pub stok_id: i32,
    pub qty: i32,
    pub satuan_id: i32,
    pub keterangan: Option<String>,

    pub stok_kode: String,
    pub stok_nama: String,
    pub satuan_kode: String,
    pub satuan_nama: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateSuratJalanItemRequest {
    pub stok_id: i32,
    pub qty: i32,
    pub satuan_id: i32,
    pub keterangan: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateSuratJalanItemRequest {
    pub stok_id: i32,
    pub qty: i32,
    pub satuan_id: i32,
    pub keterangan: Option<String>,
}
