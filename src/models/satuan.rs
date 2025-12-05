use serde::{Serialize, Deserialize};
use sqlx::FromRow;

#[derive(Debug, Serialize, FromRow)]
pub struct Satuan {
    pub id: i32,
    pub kode: String,
    pub nama: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateSatuanRequest {
    pub kode: String,
    pub nama: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateSatuanRequest {
    pub kode: String,
    pub nama: String,
}
