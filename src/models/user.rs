// src/models/user.rs
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct RegisterUser {
    pub nama_lengkap: String,
    pub email: String,
    pub no_hp: String,
    pub password: String,
}

#[derive(Serialize, Deserialize)]
pub struct LoginUser {
    pub email: String,
    pub password: String,
}
