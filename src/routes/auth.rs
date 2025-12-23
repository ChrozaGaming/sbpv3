// src/routes/auth.rs
use actix_web::{post, web, HttpResponse};
use bcrypt::{hash, verify};
use jsonwebtoken::{encode, EncodingKey, Header};
use serde::{Deserialize, Serialize};

use crate::{error::ApiError, state::AppState};
use crate::models::user::{LoginUser, RegisterUser};

#[derive(Serialize, Deserialize)]
struct JwtClaims {
    sub: String,
    exp: usize,
}

/// POST /api/auth/register
#[post("/auth/register")]
pub async fn register_user(
    state: web::Data<AppState>,
    body: web::Json<RegisterUser>,
) -> Result<HttpResponse, ApiError> {
    let body = body.into_inner();

    // Cek email sudah terdaftar
    let existing = sqlx::query!(
        r#"SELECT id::text FROM sbpv3.users WHERE email = $1"#,
        body.email
    )
    .fetch_optional(&state.db)
    .await?;

    if existing.is_some() {
        return Err(ApiError::BadRequest("Email sudah terdaftar".into()));
    }

    // Hash password
    let hashed = hash(&body.password, 12)
        .map_err(|e| ApiError::InternalError(format!("Hash error: {}", e)))?;

    // Insert user baru
    sqlx::query!(
        r#"
        INSERT INTO sbpv3.users (nama_lengkap, email, no_hp, password_hash)
        VALUES ($1, $2, $3, $4)
        "#,
        body.nama_lengkap,
        body.email,
        body.no_hp,
        hashed
    )
    .execute(&state.db)
    .await?;

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "Registrasi berhasil"
    })))
}

/// POST /api/auth/login
#[post("/auth/login")]
pub async fn login_user(
    state: web::Data<AppState>,
    body: web::Json<LoginUser>,
) -> Result<HttpResponse, ApiError> {
    let body = body.into_inner();

    // Ambil id, nama_lengkap, email, dan password_hash
    let user = sqlx::query!(
        r#"
        SELECT 
            id::text,
            nama_lengkap,
            email,
            password_hash
        FROM sbpv3.users
        WHERE email = $1
        "#,
        body.email
    )
    .fetch_optional(&state.db)
    .await?;

    let user = match user {
        Some(u) => u,
        None => return Err(ApiError::Unauthorized),
    };

    // Password check
    let is_valid = verify(&body.password, &user.password_hash)
        .map_err(|e| ApiError::InternalError(format!("Verify error: {}", e)))?;

    if !is_valid {
        return Err(ApiError::Unauthorized);
    }

    // id::text akan dibaca SQLx sebagai Option<String>
    let user_id = user
        .id
        .ok_or(ApiError::InternalError("User ID null".into()))?;

    // nama_lengkap & email di DB bertipe NOT NULL → String, bukan Option
    let nama_lengkap: String = user.nama_lengkap;
    let email: String = user.email;

    // Claims JWT
    let claims = JwtClaims {
        sub: user_id.clone(),
        exp: (chrono::Utc::now().timestamp() + 86400) as usize, // +1 hari
    };

    let secret = std::env::var("JWT_SECRET")
        .map_err(|_| ApiError::InternalError("JWT_SECRET missing".into()))?;

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| ApiError::InternalError(format!("JWT error: {}", e)))?;

    // Kembalikan token + data user (dipakai frontend)
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "token": token,
        "user": {
            "id": user_id,
            "nama_lengkap": nama_lengkap,
            "email": email
        }
    })))
}
