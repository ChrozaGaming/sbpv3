use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/* ===========================
   Kasbon (Cash Advance)
   =========================== */

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Kasbon {
    pub kasbon_id: Uuid,
    pub pegawai_id: Uuid,
    pub kontrak_id: Option<Uuid>,

    pub tanggal_pengajuan: NaiveDate,
    pub nominal_pengajuan: i64,
    pub alasan: Option<String>,

    pub status_kasbon: String, // diajukan | disetujui | ditolak | dicairkan | lunas
    pub disetujui_oleh: Option<String>,
    pub tanggal_persetujuan: Option<NaiveDate>,
    pub nominal_disetujui: Option<i64>,

    pub tanggal_cair: Option<NaiveDate>,
    pub metode_pencairan: Option<String>, // tunai | transfer
    pub bukti_pencairan_url: Option<String>,

    pub metode_potong: String, // potong_gaji | cicilan
    pub jumlah_cicilan: i32,   // legacy — selalu 0 untuk kasbon baru
    pub saldo_kasbon: i64,

    pub catatan: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateKasbonRequest {
    pub kasbon_id: Uuid,
    pub pegawai_id: Uuid,
    pub kontrak_id: Option<Uuid>,

    pub tanggal_pengajuan: NaiveDate,
    pub nominal_pengajuan: i64,
    pub alasan: Option<String>,

    pub status_kasbon: String,
    pub disetujui_oleh: Option<String>,
    pub tanggal_persetujuan: Option<NaiveDate>,
    pub nominal_disetujui: Option<i64>,

    pub tanggal_cair: Option<NaiveDate>,
    pub metode_pencairan: Option<String>,
    pub bukti_pencairan_url: Option<String>,

    pub metode_potong: String,

    /// Tidak wajib diisi — default 0, tidak ada lagi konsep "berapa kali cicil"
    #[serde(default)]
    pub jumlah_cicilan: i32,

    /// Opsional: saldo awal saat dicairkan. Kalau tidak diisi, backend auto-set.
    pub saldo_kasbon: Option<i64>,

    pub catatan: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateKasbonRequest {
    pub pegawai_id: Option<Uuid>,
    pub kontrak_id: Option<Option<Uuid>>,

    pub tanggal_pengajuan: Option<NaiveDate>,
    pub nominal_pengajuan: Option<i64>,
    pub alasan: Option<Option<String>>,

    pub status_kasbon: Option<String>,
    pub disetujui_oleh: Option<Option<String>>,
    pub tanggal_persetujuan: Option<Option<NaiveDate>>,
    pub nominal_disetujui: Option<Option<i64>>,

    pub tanggal_cair: Option<Option<NaiveDate>>,
    pub metode_pencairan: Option<Option<String>>,
    pub bukti_pencairan_url: Option<Option<String>>,

    pub metode_potong: Option<String>,
    pub jumlah_cicilan: Option<i32>,
    pub saldo_kasbon: Option<i64>,

    pub catatan: Option<Option<String>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct KasbonListQuery {
    pub q: Option<String>,
    pub pegawai_id: Option<Uuid>,
    pub status: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

/* ===========================
   Kasbon Cicilan — LEGACY
   Struct tetap ada supaya code lama tidak error,
   tapi tidak dipakai lagi oleh route.
   Pembayaran sekarang via t_kasbon_mutasi.
   =========================== */

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct KasbonCicilan {
    pub cicilan_id: Uuid,
    pub kasbon_id: Uuid,

    pub cicilan_ke: i32,
    pub nominal_cicilan: i64,

    pub tanggal_jatuh_tempo: NaiveDate,
    pub tanggal_bayar: Option<NaiveDate>,

    pub status_cicilan: String,

    pub dipotong_dari: Option<String>,
    pub penggajian_id: Option<Uuid>,

    pub catatan: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCicilanRequest {
    pub tanggal_bayar: Option<Option<NaiveDate>>,
    pub status_cicilan: Option<String>,
    pub dipotong_dari: Option<Option<String>>,
    pub penggajian_id: Option<Option<Uuid>>,
    pub catatan: Option<Option<String>>,
}