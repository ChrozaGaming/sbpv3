// src/models/absensi.rs

//! Model dan DTO untuk fitur absensi.
//!
//! Contoh DDL Postgres (pakai schema `sbpv3`):
//!
//! ```sql
//! CREATE EXTENSION IF NOT EXISTS "pgcrypto";
//! CREATE SCHEMA IF NOT EXISTS sbpv3;
//!
//! CREATE TABLE IF NOT EXISTS sbpv3.absensi (
//!     id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
//!     nama       TEXT        NOT NULL,
//!     action     TEXT        NOT NULL,
//!     client_ip  TEXT,
//!     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
//!     CONSTRAINT absensi_action_check
//!         CHECK (action = ANY (ARRAY['hadir', 'izin', 'sakit']))
//! );
//!
//! CREATE INDEX IF NOT EXISTS idx_absensi_created_at
//!     ON sbpv3.absensi (created_at DESC);
//!
//! CREATE INDEX IF NOT EXISTS idx_absensi_nama_created_at
//!     ON sbpv3.absensi (nama, created_at DESC);
//! ```
//!
//! Backend di routes memakai `sbpv3.absensi` secara eksplisit,
//! jadi tidak tergantung `search_path`.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Record absensi yang tersimpan di database.
#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct Absensi {
    pub id: Uuid,
    pub nama: String,
    /// "hadir" | "izin" | "sakit"
    pub action: String,
    pub client_ip: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Payload untuk create absensi via HTTP (`POST /api/absensi`)
#[derive(Debug, Serialize, Deserialize)]
pub struct CreateAbsensiRequest {
    pub nama: String,
    /// "hadir" | "izin" | "sakit"
    pub action: String,
}

impl CreateAbsensiRequest {
    /// Normalisasi action jadi lowercase.
    pub fn normalized_action(&self) -> String {
        self.action.to_lowercase()
    }

    /// Validasi action.
    pub fn is_valid_action(&self) -> bool {
        matches!(
            self.normalized_action().as_str(),
            "hadir" | "izin" | "sakit"
        )
    }
}

/// Query params untuk list absensi (`GET /api/absensi`)
#[derive(Debug, Deserialize)]
pub struct ListAbsensiQuery {
    /// Batas jumlah record (default 50, max 500)
    pub limit: Option<i64>,
}
