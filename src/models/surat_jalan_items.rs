use serde::{Deserialize, Serialize};
use sqlx::FromRow;

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
