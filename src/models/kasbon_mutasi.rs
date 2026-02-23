use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/* ===========================
   Kasbon Mutasi (Riwayat Pembayaran)
   Table: sbpv3.t_kasbon_mutasi
   =========================== */

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct KasbonMutasi {
    pub mutasi_id: Uuid,
    pub kasbon_id: Uuid,
    pub penggajian_id: Option<Uuid>,
    pub tipe_mutasi: String,       // potong_gaji | cicilan_manual | penyesuaian
    pub nominal_mutasi: i64,
    pub saldo_sebelum: i64,
    pub saldo_sesudah: i64,
    pub tanggal_mutasi: NaiveDate,
    pub catatan: Option<String>,
    pub created_at: DateTime<Utc>,
}

/* ===========================
   Request DTO
   =========================== */

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateMutasiRequest {
    pub tipe_mutasi: String,           // "potong_gaji" | "cicilan_manual" | "penyesuaian"
    pub nominal_mutasi: i64,
    pub penggajian_id: Option<Uuid>,
    pub tanggal_mutasi: Option<NaiveDate>,
    pub catatan: Option<String>,
}

/* ===========================
   Column helpers
   =========================== */

pub const MUTASI_COLUMNS: &str = r#"
    mutasi_id, kasbon_id, penggajian_id, tipe_mutasi,
    nominal_mutasi, saldo_sebelum, saldo_sesudah,
    tanggal_mutasi, catatan, created_at
"#;