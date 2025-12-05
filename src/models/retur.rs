use chrono::NaiveDate;
use serde::Deserialize;

#[derive(Deserialize, Debug)]
pub struct ReturRequest {
    pub stok_id: i32,
    pub quantity: i32,
    pub tanggal: NaiveDate,
    pub alasan: String,
    pub user_id: i32,
}
