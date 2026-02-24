use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/* ===========================
   Invoice (Tagihan)
   =========================== */

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Invoice {
    pub invoice_id: Uuid,
    pub nomor_invoice: String,

    pub jenis_tagihan: String,
    pub nama_pemilik: String,
    pub deskripsi: Option<String>,
    pub frekuensi: String,       // harian | mingguan | bulanan | tahunan | sekali
    pub periode: Option<String>,

    pub jumlah: i64,
    pub jumlah_dibayar: i64,

    pub tanggal_dibuat: NaiveDate,
    pub jatuh_tempo: NaiveDate,

    pub status: String, // belum_bayar | lunas | sebagian | terlambat | batal

    pub kontak_hp: Option<String>,
    pub kontak_email: Option<String>,

    pub nomor_id_meter: Option<String>,

    pub pemakaian: Option<f64>,
    pub satuan_pemakaian: Option<String>,
    pub harga_satuan: Option<f64>,

    pub reminder_aktif: bool,
    pub reminder_metode: Option<String>, // whatsapp | sms | email
    pub reminder_hari_before: Option<String>,
    pub reminder_berikutnya: Option<NaiveDate>,

    pub catatan: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateInvoiceRequest {
    pub invoice_id: Uuid,

    /// Opsional — kalau kosong backend auto-generate: INV-YYYY-NNN
    pub nomor_invoice: Option<String>,

    pub jenis_tagihan: String,
    pub nama_pemilik: String,
    pub deskripsi: Option<String>,
    pub frekuensi: String,
    pub periode: Option<String>,

    pub jumlah: i64,

    #[serde(default)]
    pub jumlah_dibayar: i64,

    pub tanggal_dibuat: Option<NaiveDate>,
    pub jatuh_tempo: NaiveDate,

    /// Default: "belum_bayar"
    pub status: Option<String>,

    pub kontak_hp: Option<String>,
    pub kontak_email: Option<String>,

    pub nomor_id_meter: Option<String>,

    pub pemakaian: Option<f64>,
    pub satuan_pemakaian: Option<String>,
    pub harga_satuan: Option<f64>,

    #[serde(default)]
    pub reminder_aktif: bool,
    pub reminder_metode: Option<String>,
    pub reminder_hari_before: Option<String>,
    pub reminder_berikutnya: Option<NaiveDate>,

    pub catatan: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInvoiceRequest {
    pub jenis_tagihan: Option<String>,
    pub nama_pemilik: Option<String>,
    pub deskripsi: Option<Option<String>>,
    pub frekuensi: Option<String>,
    pub periode: Option<Option<String>>,

    pub jumlah: Option<i64>,
    pub jumlah_dibayar: Option<i64>,

    pub tanggal_dibuat: Option<NaiveDate>,
    pub jatuh_tempo: Option<NaiveDate>,

    pub status: Option<String>,

    pub kontak_hp: Option<Option<String>>,
    pub kontak_email: Option<Option<String>>,

    pub nomor_id_meter: Option<Option<String>>,

    pub pemakaian: Option<Option<f64>>,
    pub satuan_pemakaian: Option<Option<String>>,
    pub harga_satuan: Option<Option<f64>>,

    pub reminder_aktif: Option<bool>,
    pub reminder_metode: Option<Option<String>>,
    pub reminder_hari_before: Option<Option<String>>,
    pub reminder_berikutnya: Option<Option<NaiveDate>>,

    pub catatan: Option<Option<String>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct InvoiceListQuery {
    pub q: Option<String>,
    pub frekuensi: Option<String>,
    pub status: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}