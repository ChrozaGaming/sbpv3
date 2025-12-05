use actix_web::{HttpResponse, ResponseError};
use serde::Serialize;
use std::fmt;

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub message: String,
}

// Supaya varian yang belum dipakai tidak memunculkan warning
#[allow(dead_code)]
#[derive(Debug)]
pub enum ApiError {
    BadRequest(String),
    NotFound(String),
    Unauthorized,
    InternalError(String),
    DbError(sqlx::Error),
}

impl fmt::Display for ApiError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ApiError::BadRequest(msg) => write!(f, "BadRequest: {}", msg),
            ApiError::NotFound(msg) => write!(f, "NotFound: {}", msg),
            ApiError::Unauthorized => write!(f, "Unauthorized"),
            ApiError::InternalError(msg) => write!(f, "InternalError: {}", msg),
            ApiError::DbError(err) => write!(f, "DbError: {}", err),
        }
    }
}

impl From<sqlx::Error> for ApiError {
    fn from(err: sqlx::Error) -> Self {
        ApiError::DbError(err)
    }
}

impl ResponseError for ApiError {
    fn error_response(&self) -> HttpResponse {
        match self {
            ApiError::BadRequest(msg) => {
                HttpResponse::BadRequest().json(ErrorResponse { message: msg.clone() })
            }
            ApiError::NotFound(msg) => {
                HttpResponse::NotFound().json(ErrorResponse { message: msg.clone() })
            }
            ApiError::Unauthorized => HttpResponse::Unauthorized()
                .json(ErrorResponse { message: "Unauthorized".into() }),
            ApiError::InternalError(msg) => HttpResponse::InternalServerError()
                .json(ErrorResponse { message: msg.clone() }),
            ApiError::DbError(err) => HttpResponse::InternalServerError()
                .json(ErrorResponse { message: format!("Database error: {}", err) }),
        }
    }
}
