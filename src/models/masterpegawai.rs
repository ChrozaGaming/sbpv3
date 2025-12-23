// src/models/masterpegawai.rs
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct MasterPegawai {
    pub pegawai_id: Uuid,

    // Identitas
    pub nik: String,
    pub no_kk: Option<String>,
    pub nama_lengkap: String,
    pub nama_panggilan: Option<String>,
    pub jenis_kelamin: String, // "L" / "P"
    pub tempat_lahir: Option<String>,
    pub tanggal_lahir: Option<NaiveDate>,
    pub agama: Option<String>,

    // Status & Pendidikan
    pub status_perkawinan: String,   // "Belum Kawin" | "Kawin" | "Cerai"
    pub pendidikan_terakhir: String, // "SD" ... "S3" | "Lainnya"

    // Kontak
    pub no_hp: String,
    pub email: Option<String>,

    // Alamat KTP
    pub alamat_ktp: String,
    pub kelurahan_ktp: Option<String>,
    pub kecamatan_ktp: Option<String>,
    pub kota_kab_ktp: String,
    pub provinsi_ktp: String,
    pub kode_pos_ktp: Option<String>,

    // Alamat Domisili
    pub alamat_domisili: Option<String>,
    pub kelurahan_domisili: Option<String>,
    pub kecamatan_domisili: Option<String>,
    pub kota_kab_domisili: Option<String>,
    pub provinsi_domisili: Option<String>,
    pub kode_pos_domisili: Option<String>,

    // Kontak Darurat
    pub kontak_darurat_nama: Option<String>,
    pub kontak_darurat_hubungan: Option<String>,
    pub kontak_darurat_no_hp: Option<String>,

    // Legal & Kepesertaan
    pub npwp: Option<String>,
    pub bpjs_kesehatan: Option<String>,
    pub bpjs_ketenagakerjaan: Option<String>,

    // Bank
    pub bank_nama: String,
    pub bank_no_rekening: String,
    pub bank_nama_pemilik: String,

    // Lainnya
    pub foto_url: Option<String>,
    pub status_aktif: String, // "aktif" | "nonaktif"
    pub tanggal_masuk: Option<NaiveDate>,
    pub catatan: Option<String>,

    // Audit
    pub dibuat_pada: DateTime<Utc>,
    pub diubah_pada: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateMasterPegawaiRequest {
    // Identitas
    pub nik: String,
    pub no_kk: Option<String>,
    pub nama_lengkap: String,
    pub nama_panggilan: Option<String>,
    pub jenis_kelamin: String,
    pub tempat_lahir: Option<String>,
    pub tanggal_lahir: Option<NaiveDate>,
    pub agama: Option<String>,

    // Status & Pendidikan
    pub status_perkawinan: String,
    pub pendidikan_terakhir: String,

    // Kontak
    pub no_hp: String,
    pub email: Option<String>,

    // Alamat KTP
    pub alamat_ktp: String,
    pub kelurahan_ktp: Option<String>,
    pub kecamatan_ktp: Option<String>,
    pub kota_kab_ktp: String,
    pub provinsi_ktp: String,
    pub kode_pos_ktp: Option<String>,

    // Alamat Domisili
    pub alamat_domisili: Option<String>,
    pub kelurahan_domisili: Option<String>,
    pub kecamatan_domisili: Option<String>,
    pub kota_kab_domisili: Option<String>,
    pub provinsi_domisili: Option<String>,
    pub kode_pos_domisili: Option<String>,

    // Kontak Darurat
    pub kontak_darurat_nama: Option<String>,
    pub kontak_darurat_hubungan: Option<String>,
    pub kontak_darurat_no_hp: Option<String>,

    // Legal & Kepesertaan
    pub npwp: Option<String>,
    pub bpjs_kesehatan: Option<String>,
    pub bpjs_ketenagakerjaan: Option<String>,

    // Bank
    pub bank_nama: String,
    pub bank_no_rekening: String,
    pub bank_nama_pemilik: String,

    // Lainnya
    pub foto_url: Option<String>,
    pub status_aktif: String,
    pub tanggal_masuk: Option<NaiveDate>,
    pub catatan: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateMasterPegawaiRequest {
    // semua optional supaya bisa PATCH-like via PUT
    pub nik: Option<String>,
    pub no_kk: Option<String>,
    pub nama_lengkap: Option<String>,
    pub nama_panggilan: Option<String>,
    pub jenis_kelamin: Option<String>,
    pub tempat_lahir: Option<String>,
    pub tanggal_lahir: Option<NaiveDate>,
    pub agama: Option<String>,

    pub status_perkawinan: Option<String>,
    pub pendidikan_terakhir: Option<String>,

    pub no_hp: Option<String>,
    pub email: Option<String>,

    pub alamat_ktp: Option<String>,
    pub kelurahan_ktp: Option<String>,
    pub kecamatan_ktp: Option<String>,
    pub kota_kab_ktp: Option<String>,
    pub provinsi_ktp: Option<String>,
    pub kode_pos_ktp: Option<String>,

    pub alamat_domisili: Option<String>,
    pub kelurahan_domisili: Option<String>,
    pub kecamatan_domisili: Option<String>,
    pub kota_kab_domisili: Option<String>,
    pub provinsi_domisili: Option<String>,
    pub kode_pos_domisili: Option<String>,

    pub kontak_darurat_nama: Option<String>,
    pub kontak_darurat_hubungan: Option<String>,
    pub kontak_darurat_no_hp: Option<String>,

    pub npwp: Option<String>,
    pub bpjs_kesehatan: Option<String>,
    pub bpjs_ketenagakerjaan: Option<String>,

    pub bank_nama: Option<String>,
    pub bank_no_rekening: Option<String>,
    pub bank_nama_pemilik: Option<String>,

    pub foto_url: Option<String>,
    pub status_aktif: Option<String>,
    pub tanggal_masuk: Option<NaiveDate>,
    pub catatan: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ListQuery {
    pub q: Option<String>,        // search
    pub status: Option<String>,   // "aktif" | "nonaktif"
    pub page: Option<i64>,        // default 1
    pub limit: Option<i64>,       // default 20
}

impl MasterPegawai {
    pub async fn insert(db: &PgPool, req: CreateMasterPegawaiRequest) -> Result<MasterPegawai, sqlx::Error> {
        // NOTE: kolom dibuat_pada/diubah_pada default via DB
        let row = sqlx::query_as::<_, MasterPegawai>(
            r#"
            INSERT INTO sbpv3.master_pegawai_lapangan (
                nik, no_kk, nama_lengkap, nama_panggilan, jenis_kelamin, tempat_lahir, tanggal_lahir, agama,
                status_perkawinan, pendidikan_terakhir,
                no_hp, email,
                alamat_ktp, kelurahan_ktp, kecamatan_ktp, kota_kab_ktp, provinsi_ktp, kode_pos_ktp,
                alamat_domisili, kelurahan_domisili, kecamatan_domisili, kota_kab_domisili, provinsi_domisili, kode_pos_domisili,
                kontak_darurat_nama, kontak_darurat_hubungan, kontak_darurat_no_hp,
                npwp, bpjs_kesehatan, bpjs_ketenagakerjaan,
                bank_nama, bank_no_rekening, bank_nama_pemilik,
                foto_url, status_aktif, tanggal_masuk, catatan
            )
            VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,
                $9,$10,
                $11,$12,
                $13,$14,$15,$16,$17,$18,
                $19,$20,$21,$22,$23,$24,
                $25,$26,$27,
                $28,$29,$30,
                $31,$32,$33,
                $34,$35,$36,$37
            )
            RETURNING *
            "#
        )
            .bind(req.nik)
            .bind(req.no_kk)
            .bind(req.nama_lengkap)
            .bind(req.nama_panggilan)
            .bind(req.jenis_kelamin)
            .bind(req.tempat_lahir)
            .bind(req.tanggal_lahir)
            .bind(req.agama)
            .bind(req.status_perkawinan)
            .bind(req.pendidikan_terakhir)
            .bind(req.no_hp)
            .bind(req.email)
            .bind(req.alamat_ktp)
            .bind(req.kelurahan_ktp)
            .bind(req.kecamatan_ktp)
            .bind(req.kota_kab_ktp)
            .bind(req.provinsi_ktp)
            .bind(req.kode_pos_ktp)
            .bind(req.alamat_domisili)
            .bind(req.kelurahan_domisili)
            .bind(req.kecamatan_domisili)
            .bind(req.kota_kab_domisili)
            .bind(req.provinsi_domisili)
            .bind(req.kode_pos_domisili)
            .bind(req.kontak_darurat_nama)
            .bind(req.kontak_darurat_hubungan)
            .bind(req.kontak_darurat_no_hp)
            .bind(req.npwp)
            .bind(req.bpjs_kesehatan)
            .bind(req.bpjs_ketenagakerjaan)
            .bind(req.bank_nama)
            .bind(req.bank_no_rekening)
            .bind(req.bank_nama_pemilik)
            .bind(req.foto_url)
            .bind(req.status_aktif)
            .bind(req.tanggal_masuk)
            .bind(req.catatan)
            .fetch_one(db)
            .await?;

        Ok(row)
    }

    pub async fn get_by_id(db: &PgPool, id: Uuid) -> Result<Option<MasterPegawai>, sqlx::Error> {
        let row = sqlx::query_as::<_, MasterPegawai>(
            r#"SELECT * FROM sbpv3.master_pegawai_lapangan WHERE pegawai_id = $1"#,
        )
            .bind(id)
            .fetch_optional(db)
            .await?;

        Ok(row)
    }

    pub async fn get_by_nik(db: &PgPool, nik: &str) -> Result<Option<MasterPegawai>, sqlx::Error> {
        let row = sqlx::query_as::<_, MasterPegawai>(
            r#"SELECT * FROM sbpv3.master_pegawai_lapangan WHERE nik = $1"#,
        )
            .bind(nik)
            .fetch_optional(db)
            .await?;

        Ok(row)
    }

    pub async fn list(db: &PgPool, q: ListQuery) -> Result<Vec<MasterPegawai>, sqlx::Error> {
        let page = q.page.unwrap_or(1).max(1);
        let limit = q.limit.unwrap_or(20).clamp(1, 200);
        let offset = (page - 1) * limit;

        // Search sederhana: nama_lengkap / nik / no_hp / kota_kab_ktp
        // Filter status_aktif opsional
        let rows = sqlx::query_as::<_, MasterPegawai>(
            r#"
            SELECT *
            FROM sbpv3.master_pegawai_lapangan
            WHERE
                (
                    $1::text IS NULL
                    OR nama_lengkap ILIKE '%' || $1 || '%'
                    OR nik ILIKE '%' || $1 || '%'
                    OR no_hp ILIKE '%' || $1 || '%'
                    OR kota_kab_ktp ILIKE '%' || $1 || '%'
                )
                AND (
                    $2::text IS NULL
                    OR status_aktif = $2
                )
            ORDER BY dibuat_pada DESC
            LIMIT $3 OFFSET $4
            "#,
        )
            .bind(q.q)
            .bind(q.status)
            .bind(limit)
            .bind(offset)
            .fetch_all(db)
            .await?;

        Ok(rows)
    }

    pub async fn update(db: &PgPool, id: Uuid, req: UpdateMasterPegawaiRequest) -> Result<Option<MasterPegawai>, sqlx::Error> {
        // UPDATE partial menggunakan COALESCE
        let row = sqlx::query_as::<_, MasterPegawai>(
            r#"
            UPDATE sbpv3.master_pegawai_lapangan
            SET
                nik = COALESCE($1, nik),
                no_kk = COALESCE($2, no_kk),
                nama_lengkap = COALESCE($3, nama_lengkap),
                nama_panggilan = COALESCE($4, nama_panggilan),
                jenis_kelamin = COALESCE($5, jenis_kelamin),
                tempat_lahir = COALESCE($6, tempat_lahir),
                tanggal_lahir = COALESCE($7, tanggal_lahir),
                agama = COALESCE($8, agama),

                status_perkawinan = COALESCE($9, status_perkawinan),
                pendidikan_terakhir = COALESCE($10, pendidikan_terakhir),

                no_hp = COALESCE($11, no_hp),
                email = COALESCE($12, email),

                alamat_ktp = COALESCE($13, alamat_ktp),
                kelurahan_ktp = COALESCE($14, kelurahan_ktp),
                kecamatan_ktp = COALESCE($15, kecamatan_ktp),
                kota_kab_ktp = COALESCE($16, kota_kab_ktp),
                provinsi_ktp = COALESCE($17, provinsi_ktp),
                kode_pos_ktp = COALESCE($18, kode_pos_ktp),

                alamat_domisili = COALESCE($19, alamat_domisili),
                kelurahan_domisili = COALESCE($20, kelurahan_domisili),
                kecamatan_domisili = COALESCE($21, kecamatan_domisili),
                kota_kab_domisili = COALESCE($22, kota_kab_domisili),
                provinsi_domisili = COALESCE($23, provinsi_domisili),
                kode_pos_domisili = COALESCE($24, kode_pos_domisili),

                kontak_darurat_nama = COALESCE($25, kontak_darurat_nama),
                kontak_darurat_hubungan = COALESCE($26, kontak_darurat_hubungan),
                kontak_darurat_no_hp = COALESCE($27, kontak_darurat_no_hp),

                npwp = COALESCE($28, npwp),
                bpjs_kesehatan = COALESCE($29, bpjs_kesehatan),
                bpjs_ketenagakerjaan = COALESCE($30, bpjs_ketenagakerjaan),

                bank_nama = COALESCE($31, bank_nama),
                bank_no_rekening = COALESCE($32, bank_no_rekening),
                bank_nama_pemilik = COALESCE($33, bank_nama_pemilik),

                foto_url = COALESCE($34, foto_url),
                status_aktif = COALESCE($35, status_aktif),
                tanggal_masuk = COALESCE($36, tanggal_masuk),
                catatan = COALESCE($37, catatan),

                diubah_pada = NOW()
            WHERE pegawai_id = $38
            RETURNING *
            "#
        )
            .bind(req.nik)
            .bind(req.no_kk)
            .bind(req.nama_lengkap)
            .bind(req.nama_panggilan)
            .bind(req.jenis_kelamin)
            .bind(req.tempat_lahir)
            .bind(req.tanggal_lahir)
            .bind(req.agama)
            .bind(req.status_perkawinan)
            .bind(req.pendidikan_terakhir)
            .bind(req.no_hp)
            .bind(req.email)
            .bind(req.alamat_ktp)
            .bind(req.kelurahan_ktp)
            .bind(req.kecamatan_ktp)
            .bind(req.kota_kab_ktp)
            .bind(req.provinsi_ktp)
            .bind(req.kode_pos_ktp)
            .bind(req.alamat_domisili)
            .bind(req.kelurahan_domisili)
            .bind(req.kecamatan_domisili)
            .bind(req.kota_kab_domisili)
            .bind(req.provinsi_domisili)
            .bind(req.kode_pos_domisili)
            .bind(req.kontak_darurat_nama)
            .bind(req.kontak_darurat_hubungan)
            .bind(req.kontak_darurat_no_hp)
            .bind(req.npwp)
            .bind(req.bpjs_kesehatan)
            .bind(req.bpjs_ketenagakerjaan)
            .bind(req.bank_nama)
            .bind(req.bank_no_rekening)
            .bind(req.bank_nama_pemilik)
            .bind(req.foto_url)
            .bind(req.status_aktif)
            .bind(req.tanggal_masuk)
            .bind(req.catatan)
            .bind(id)
            .fetch_optional(db)
            .await?;

        Ok(row)
    }

    pub async fn delete(db: &PgPool, id: Uuid) -> Result<bool, sqlx::Error> {
        let res = sqlx::query(
            r#"DELETE FROM sbpv3.master_pegawai_lapangan WHERE pegawai_id = $1"#,
        )
            .bind(id)
            .execute(db)
            .await?;

        Ok(res.rows_affected() > 0)
    }
}
