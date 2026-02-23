use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Penggajian {
    pub penggajian_id: Uuid,
    pub pegawai_id: Uuid,
    pub kontrak_id: Option<Uuid>,

    pub periode_mulai: NaiveDate,
    pub periode_akhir: NaiveDate,
    pub tipe_gaji: String, // harian | mingguan | bulanan

    pub jumlah_hari_kerja: Option<i32>,
    pub upah_per_hari: Option<i64>,

    // Pendapatan
    pub upah_pokok: i64,
    pub uang_lembur: i64,
    pub tunjangan_makan: i64,
    pub tunjangan_transport: i64,
    pub tunjangan_lain: i64,
    pub bonus: i64,

    pub total_pendapatan: i64,

    // Potongan
    pub potongan_kasbon: i64,
    pub potongan_bpjs: i64,
    pub potongan_pph21: i64,
    pub potongan_lain: i64,

    pub total_potongan: i64,

    // Netto
    pub gaji_bersih: i64,

    // Status & pembayaran
    pub status_gaji: String, // draft | disetujui | dibayar
    pub tanggal_bayar: Option<NaiveDate>,
    pub metode_bayar: Option<String>, // tunai | transfer
    pub bukti_bayar_url: Option<String>,

    pub catatan: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePenggajianRequest {
    pub penggajian_id: Uuid,
    pub pegawai_id: Uuid,
    pub kontrak_id: Option<Uuid>,

    pub periode_mulai: NaiveDate,
    pub periode_akhir: NaiveDate,
    pub tipe_gaji: String,

    pub jumlah_hari_kerja: Option<i32>,
    pub upah_per_hari: Option<i64>,

    pub upah_pokok: i64,
    pub uang_lembur: i64,
    pub tunjangan_makan: i64,
    pub tunjangan_transport: i64,
    pub tunjangan_lain: i64,
    pub bonus: i64,

    pub total_pendapatan: i64,

    pub potongan_kasbon: i64,
    pub potongan_bpjs: i64,
    pub potongan_pph21: i64,
    pub potongan_lain: i64,

    pub total_potongan: i64,
    pub gaji_bersih: i64,

    pub status_gaji: String,
    pub tanggal_bayar: Option<NaiveDate>,
    pub metode_bayar: Option<String>,
    pub bukti_bayar_url: Option<String>,

    pub catatan: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdatePenggajianRequest {
    pub pegawai_id: Option<Uuid>,
    pub kontrak_id: Option<Option<Uuid>>,

    pub periode_mulai: Option<NaiveDate>,
    pub periode_akhir: Option<NaiveDate>,
    pub tipe_gaji: Option<String>,

    pub jumlah_hari_kerja: Option<Option<i32>>,
    pub upah_per_hari: Option<Option<i64>>,

    pub upah_pokok: Option<i64>,
    pub uang_lembur: Option<i64>,
    pub tunjangan_makan: Option<i64>,
    pub tunjangan_transport: Option<i64>,
    pub tunjangan_lain: Option<i64>,
    pub bonus: Option<i64>,

    pub total_pendapatan: Option<i64>,

    pub potongan_kasbon: Option<i64>,
    pub potongan_bpjs: Option<i64>,
    pub potongan_pph21: Option<i64>,
    pub potongan_lain: Option<i64>,

    pub total_potongan: Option<i64>,
    pub gaji_bersih: Option<i64>,

    pub status_gaji: Option<String>,
    pub tanggal_bayar: Option<Option<NaiveDate>>,
    pub metode_bayar: Option<Option<String>>,
    pub bukti_bayar_url: Option<Option<String>>,

    pub catatan: Option<Option<String>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PenggajianListQuery {
    pub q: Option<String>,
    pub pegawai_id: Option<Uuid>,
    pub status: Option<String>,
    pub tipe: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}