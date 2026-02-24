use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/* ===========================
   Invoice Pembayaran (Riwayat Bayar)
   =========================== */

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct InvoicePembayaran {
    pub pembayaran_id: Uuid,
    pub invoice_id: Uuid,

    pub nominal: i64,
    pub sisa_setelah_bayar: i64,

    pub metode_bayar: String, // tunai | transfer | qris | potong_gaji | lainnya
    pub referensi: Option<String>,
    pub bukti_url: Option<String>,
    pub dibayar_oleh: Option<String>,

    pub tanggal_bayar: NaiveDate,
    pub catatan: Option<String>,

    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePembayaranRequest {
    pub pembayaran_id: Uuid,

    /// Jumlah yang dibayar kali ini — harus > 0
    pub nominal: i64,

    /// Default "tunai"
    pub metode_bayar: Option<String>,

    /// No referensi transfer, kwitansi, dsb
    pub referensi: Option<String>,
    pub bukti_url: Option<String>,
    pub dibayar_oleh: Option<String>,

    pub tanggal_bayar: Option<NaiveDate>,
    pub catatan: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PembayaranListQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}