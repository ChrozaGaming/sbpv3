use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct KontrakKerja {
    pub kontrak_id: Uuid,
    pub pegawai_id: Uuid,
    pub vendor_id: Option<Uuid>,

    pub tipe_kontrak: String,        // Harian | Lepas | Borongan | PKWT | PKWTT
    pub jabatan: String,
    pub kategori_pekerja: String,    // Skill | Non-skill

    pub mulai_kontrak: NaiveDate,
    pub akhir_kontrak: Option<NaiveDate>,

    pub status_kontrak: String,      // aktif | selesai | putus

    pub upah_harian_default: Option<i64>,
    pub upah_mingguan_default: Option<i64>,
    pub upah_bulanan_default: Option<i64>,

    pub lokasi_penempatan_default: Option<String>,
    pub dokumen_kontrak_url: Option<String>,

    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateKontrakKerjaRequest {
    pub kontrak_id: Uuid,
    pub pegawai_id: Uuid,
    pub vendor_id: Option<Uuid>,

    pub tipe_kontrak: String,
    pub jabatan: String,
    pub kategori_pekerja: String,

    pub mulai_kontrak: NaiveDate,
    pub akhir_kontrak: Option<NaiveDate>,

    pub status_kontrak: String,

    pub upah_harian_default: Option<i64>,
    pub upah_mingguan_default: Option<i64>,
    pub upah_bulanan_default: Option<i64>,

    pub lokasi_penempatan_default: Option<String>,
    pub dokumen_kontrak_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateKontrakKerjaRequest {
    pub pegawai_id: Option<Uuid>,
    pub vendor_id: Option<Option<Uuid>>,

    pub tipe_kontrak: Option<String>,
    pub jabatan: Option<String>,
    pub kategori_pekerja: Option<String>,

    pub mulai_kontrak: Option<NaiveDate>,
    pub akhir_kontrak: Option<Option<NaiveDate>>,

    pub status_kontrak: Option<String>,

    pub upah_harian_default: Option<Option<i64>>,
    pub upah_mingguan_default: Option<Option<i64>>,
    pub upah_bulanan_default: Option<Option<i64>>,

    pub lokasi_penempatan_default: Option<Option<String>>,
    pub dokumen_kontrak_url: Option<Option<String>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ListQuery {
    pub q: Option<String>,
    pub pegawai_id: Option<Uuid>,
    pub vendor_id: Option<Uuid>,
    pub status: Option<String>, // aktif|selesai|putus
    pub tipe: Option<String>,   // Harian|...
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}
