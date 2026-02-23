// src/routes/absensi.rs

//! Routes untuk fitur absensi:
//!
//! HTTP:
//!   - GET  /api/absensi
//!   - POST /api/absensi
//!
//! WebSocket:
//!   - GET  /ws/absensi
//!
//! Seluruh endpoint dibatasi hanya untuk klien yang berada di jaringan internal
//! (IP private: 192.168.x.x, 10.x.x.x, 172.16–31.x.x atau localhost / Docker).

use std::net::IpAddr;
use std::time::{Duration, Instant};

use actix::prelude::*;
use actix_web::{
    error::ErrorInternalServerError, get, post, web, Error as ActixError, HttpRequest, HttpResponse,
};
use actix_web_actors::ws;
use chrono::Local;
use log::{error, info};
use serde::Deserialize;
use serde_json::json;

use crate::models::absensi::{Absensi, CreateAbsensiRequest, ListAbsensiQuery};
use crate::state::AppState;

/// Ambil IP client dengan prioritas:
/// 1. X-Forwarded-For (jika lewat reverse proxy)
/// 2. X-Real-IP
/// 3. peer_addr() langsung dari koneksi TCP
fn get_client_ip(req: &HttpRequest) -> Option<IpAddr> {
    // Coba X-Forwarded-For: bisa berisi beberapa IP, ambil yang pertama.
    if let Some(hdr) = req.headers().get("x-forwarded-for") {
        if let Ok(val) = hdr.to_str() {
            if let Some(first) = val.split(',').next() {
                if let Ok(ip) = first.trim().parse::<IpAddr>() {
                    return Some(ip);
                }
            }
        }
    }

    // Coba X-Real-IP
    if let Some(hdr) = req.headers().get("x-real-ip") {
        if let Ok(val) = hdr.to_str() {
            if let Ok(ip) = val.trim().parse::<IpAddr>() {
                return Some(ip);
            }
        }
    }

    // Fallback: peer_addr
    req.peer_addr().map(|sock| sock.ip())
}

/// Cek apakah IP client berada di jaringan internal kantor:
/// - IPv4 private (192.168.x.x, 10.x.x.x, 172.16–31.x.x)
/// - localhost (127.0.0.1, ::1)
fn is_ip_allowed(req: &HttpRequest) -> bool {
    match get_client_ip(req) {
        Some(IpAddr::V4(v4)) => {
            let o = v4.octets();
            let is_192 = o[0] == 192 && o[1] == 168;
            let is_10 = o[0] == 10;
            let is_172_private = o[0] == 172 && (16..=31).contains(&o[1]);
            let is_loopback = o[0] == 127;

            let allowed = is_192 || is_10 || is_172_private || is_loopback;

            if !allowed {
                info!("Rejected IPv4 client: {}", v4);
            } else {
                info!("Accepted IPv4 client: {}", v4);
            }

            allowed
        }
        Some(IpAddr::V6(v6)) => {
            let allowed = v6.is_loopback();
            if !allowed {
                info!("Rejected IPv6 client: {}", v6);
            } else {
                info!("Accepted IPv6 client: {}", v6);
            }
            allowed
        }
        None => {
            info!("No client IP detected, rejecting request");
            false
        }
    }
}

/// Helper untuk respon 403 dengan info IP (buat debug di front-end)
fn forbidden_office_only(req: &HttpRequest) -> HttpResponse {
    let ip_str = get_client_ip(req).map(|ip| ip.to_string());

    if let Some(ip) = ip_str {
        HttpResponse::Forbidden().json(json!({
            "status": "error",
            "message": "Akses hanya diperbolehkan dari jaringan kantor / internal (IP private).",
            "client_ip": ip
        }))
    } else {
        HttpResponse::Forbidden().json(json!({
            "status": "error",
            "message": "Akses hanya diperbolehkan dari jaringan kantor / internal (IP private)."
        }))
    }
}

/// GET /api/absensi
/// List log absensi (default 50 record terbaru, max 500).
#[get("/absensi")]
pub async fn list_absensi(
    req: HttpRequest,
    state: web::Data<AppState>,
    query: web::Query<ListAbsensiQuery>,
) -> Result<HttpResponse, ActixError> {
    if !is_ip_allowed(&req) {
        return Ok(forbidden_office_only(&req));
    }

    let mut limit = query.limit.unwrap_or(50);
    if limit <= 0 {
        limit = 50;
    }
    if limit > 500 {
        limit = 500;
    }

    let records = sqlx::query_as::<_, Absensi>(
        r#"
        SELECT id, nama, action, client_ip, created_at
        FROM sbpv3.absensi
        ORDER BY created_at DESC
        LIMIT $1
        "#,
    )
    .bind(limit)
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        error!("DB error list_absensi: {}", e);
        ErrorInternalServerError("DB error")
    })?;

    Ok(HttpResponse::Ok().json(records))
}

/// POST /api/absensi
/// Body JSON: { "nama": "...", "action": "hadir" | "izin" | "sakit" }
#[post("/absensi")]
pub async fn create_absensi(
    req: HttpRequest,
    state: web::Data<AppState>,
    payload: web::Json<CreateAbsensiRequest>,
) -> Result<HttpResponse, ActixError> {
    if !is_ip_allowed(&req) {
        return Ok(forbidden_office_only(&req));
    }

    let body = payload.into_inner();
    let nama = body.nama.trim();

    if nama.is_empty() {
        let resp = json!({
            "status": "error",
            "message": "Nama wajib diisi.",
        });
        return Ok(HttpResponse::BadRequest().json(resp));
    }

    let action = body.normalized_action();
    if !body.is_valid_action() {
        let resp = json!({
            "status": "error",
            "message": "Action tidak valid. Gunakan 'hadir', 'izin', atau 'sakit'.",
        });
        return Ok(HttpResponse::BadRequest().json(resp));
    }

    let client_ip = get_client_ip(&req).map(|ip| ip.to_string());

    let record = sqlx::query_as::<_, Absensi>(
        r#"
        INSERT INTO sbpv3.absensi (nama, action, client_ip)
        VALUES ($1, $2, $3)
        RETURNING id, nama, action, client_ip, created_at
        "#,
    )
    .bind(nama)
    .bind(&action)
    .bind(&client_ip)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        error!("DB error create_absensi: {}", e);
        ErrorInternalServerError("DB error")
    })?;

    let label = match action.as_str() {
        "hadir" => "Absen HADIR",
        "izin" => "Absen IZIN",
        "sakit" => "Absen SAKIT",
        _ => "Absen",
    };

    let resp = json!({
        "status": "ok",
        "message": format!("{label} tersimpan untuk {nama}"),
        "data": &record,
    });

    Ok(HttpResponse::Ok().json(resp))
}

// ===== WebSocket untuk absensi =====

/// Payload yang dikirim client via WebSocket.
/// Contoh:
/// { "action": "hadir", "name": "Hilmy Raihan" }
#[derive(Debug, Deserialize)]
struct AbsensiWsClientMessage {
    action: String,
    name: String,
}

/// WebSocket actor untuk absensi.
struct AbsensiWs {
    state: web::Data<AppState>,
    client_ip: String,
    hb: Instant,
}

impl AbsensiWs {
    fn new(state: web::Data<AppState>, client_ip: String) -> Self {
        Self {
            state,
            client_ip,
            hb: Instant::now(),
        }
    }

    fn send_json_value(&self, ctx: &mut ws::WebsocketContext<Self>, value: serde_json::Value) {
        match serde_json::to_string(&value) {
            Ok(text) => ctx.text(text),
            Err(e) => {
                error!("Failed to serialize WS message: {}", e);
                ctx.text(r#"{"event":"error","status":"error","message":"Internal JSON error"}"#);
            }
        }
    }
}

impl Actor for AbsensiWs {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        info!("Absensi WS connected from {}", self.client_ip);

        let welcome = json!({
            "event": "welcome",
            "status": "ok",
            "message": "Terhubung ke server absensi. Pastikan kamu berada di jaringan kantor.",
            "client_ip": self.client_ip,
            "timestamp": Local::now().to_rfc3339(),
        });
        self.send_json_value(ctx, welcome);

        self.hb = Instant::now();
        ctx.run_interval(Duration::from_secs(30), |act, ctx| {
            if Instant::now().duration_since(act.hb) > Duration::from_secs(90) {
                info!("Absensi WS heartbeat timeout for {}", act.client_ip);
                ctx.close(Some(ws::CloseReason {
                    code: ws::CloseCode::Abnormal,
                    description: Some("Heartbeat timeout".into()),
                }));
                ctx.stop();
                return;
            }
            ctx.ping(b"ping");
        });
    }

    fn stopped(&mut self, _ctx: &mut Self::Context) {
        info!("Absensi WS disconnected: {}", self.client_ip);
    }
}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for AbsensiWs {
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        match msg {
            Ok(ws::Message::Ping(msg)) => {
                self.hb = Instant::now();
                ctx.pong(&msg);
            }
            Ok(ws::Message::Pong(_)) => {
                self.hb = Instant::now();
            }
            Ok(ws::Message::Text(text)) => {
                let raw_text = text.to_string();
                let state = self.state.clone();
                let client_ip = self.client_ip.clone();

                ctx.spawn(
                    async move {
                        let parsed: Result<AbsensiWsClientMessage, _> =
                            serde_json::from_str(&raw_text);

                        match parsed {
                            Ok(payload) => {
                                let nama_trimmed = payload.name.trim().to_string();
                                if nama_trimmed.is_empty() {
                                    let err = json!({
                                        "event": "validation_error",
                                        "status": "error",
                                        "message": "Nama wajib diisi."
                                    });
                                    return Err(err);
                                }

                                let action = payload.action.to_lowercase();
                                if action != "hadir" && action != "izin" && action != "sakit" {
                                    let err = json!({
                                        "event": "invalid_action",
                                        "status": "error",
                                        "message": "Action tidak valid. Gunakan 'hadir', 'izin', atau 'sakit'."
                                    });
                                    return Err(err);
                                }

                                let client_ip_opt = Some(client_ip);

                                let rec_result = sqlx::query_as::<_, Absensi>(
                                    r#"
                                    INSERT INTO sbpv3.absensi (nama, action, client_ip)
                                    VALUES ($1, $2, $3)
                                    RETURNING id, nama, action, client_ip, created_at
                                    "#,
                                )
                                .bind(&nama_trimmed)
                                .bind(&action)
                                .bind(&client_ip_opt)
                                .fetch_one(&state.db)
                                .await;

                                match rec_result {
                                    Ok(rec) => {
                                        let label = match rec.action.as_str() {
                                            "hadir" => "Absen HADIR",
                                            "izin" => "Absen IZIN",
                                            "sakit" => "Absen SAKIT",
                                            _ => "Absen",
                                        };

                                        let msg = json!({
                                            "event": rec.action,
                                            "status": "ok",
                                            "message": format!("{label} tersimpan untuk {}", rec.nama),
                                            "name": rec.nama,
                                            "action": rec.action,
                                            "client_ip": rec.client_ip,
                                            "timestamp": rec.created_at.to_rfc3339(),
                                        });
                                        Ok(msg)
                                    }
                                    Err(e) => {
                                        error!("DB error insert absensi via WS: {}", e);
                                        let err = json!({
                                            "event": "db_error",
                                            "status": "error",
                                            "message": "Gagal menyimpan ke database."
                                        });
                                        Err(err)
                                    }
                                }
                            }
                            Err(e) => {
                                error!("Failed to parse WS absensi message: {}", e);
                                let err = json!({
                                    "event": "parse_error",
                                    "status": "error",
                                    "message": "Format JSON tidak valid. Gunakan {\"action\":\"hadir|izin|sakit\",\"name\":\"...\"}."
                                });
                                Err(err)
                            }
                        }
                    }
                    .into_actor(self)
                    .map(|res, act, ctx| {
                        match res {
                            Ok(json_val) | Err(json_val) => {
                                act.send_json_value(ctx, json_val);
                            }
                        }
                    }),
                );
            }
            Ok(ws::Message::Binary(_bin)) => {
                self.send_json_value(
                    ctx,
                    json!({
                        "event": "unsupported",
                        "status": "error",
                        "message": "Binary message tidak didukung."
                    }),
                );
            }
            Ok(ws::Message::Continuation(_)) => {
                // Tidak menggunakan fragmentasi, abaikan saja.
            }
            Ok(ws::Message::Close(reason)) => {
                info!(
                    "Absensi WS closed by client {:?} ip={}",
                    reason, self.client_ip
                );
                ctx.close(reason);
                ctx.stop();
            }
            Ok(ws::Message::Nop) => {
                // Tidak melakukan apa-apa
            }
            Err(e) => {
                error!("Absensi WS protocol error: {}", e);
                ctx.stop();
            }
        }
    }
}

/// Endpoint WS: ws://<host>:8080/ws/absensi
#[get("/ws/absensi")]
pub async fn absensi_ws_handler(
    req: HttpRequest,
    stream: web::Payload,
    state: web::Data<AppState>,
) -> Result<HttpResponse, ActixError> {
    if !is_ip_allowed(&req) {
        return Ok(forbidden_office_only(&req));
    }

    let client_ip = get_client_ip(&req)
        .map(|ip| ip.to_string())
        .unwrap_or_else(|| "unknown".to_string());

    let ws = AbsensiWs::new(state.clone(), client_ip);
    ws::start(ws, &req, stream)
}
