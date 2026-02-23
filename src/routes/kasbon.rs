use actix::{Actor, ActorContext, AsyncContext, StreamHandler};
use actix_web::{delete, get, post, put, web, Error, HttpRequest, HttpResponse, Responder};
use actix_web_actors::ws;
use chrono::Utc;
use serde_json::json;
use std::time::{Duration, Instant};
use tokio::sync::broadcast;
use tokio_stream::wrappers::{errors::BroadcastStreamRecvError, BroadcastStream};
use uuid::Uuid;

use crate::models::kasbon::{
    CreateKasbonRequest, Kasbon, KasbonListQuery, UpdateKasbonRequest,
};
use crate::state::AppState;

/* ===========================
   Helpers
   =========================== */

fn bad_request(msg: &str) -> HttpResponse {
    HttpResponse::BadRequest().json(json!({
        "success": false,
        "message": msg
    }))
}

fn ok_data<T: serde::Serialize>(data: T) -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "success": true,
        "data": data
    }))
}

fn validate_text_enum(field: &str, value: &str, allowed: &[&str]) -> Result<(), String> {
    if allowed.iter().any(|x| *x == value) {
        Ok(())
    } else {
        Err(format!(
            "{} tidak valid. Allowed: {}",
            field,
            allowed.join(", ")
        ))
    }
}

fn opt_trim(v: Option<String>) -> Option<String> {
    v.map(|s| s.trim().to_string()).filter(|s| !s.is_empty())
}

fn broadcast_kasbon(tx: &broadcast::Sender<String>, event: &str, payload: serde_json::Value) {
    let msg = json!({
        "tipe": "kasbon",
        "event": event,
        "payload": payload
    })
        .to_string();
    let _ = tx.send(msg);
}

/* ===========================
   SQL column lists (DRY)
   =========================== */

const KASBON_COLS: &str = r#"
    kasbon_id, pegawai_id, kontrak_id,
    tanggal_pengajuan, nominal_pengajuan, alasan,
    status_kasbon, disetujui_oleh, tanggal_persetujuan, nominal_disetujui,
    tanggal_cair, metode_pencairan, bukti_pencairan_url,
    metode_potong, jumlah_cicilan, saldo_kasbon,
    catatan, created_at, updated_at
"#;

/* ===========================
   REST: /api/kasbon
   =========================== */

#[get("/kasbon")]
pub async fn list_kasbon(
    state: web::Data<AppState>,
    q: web::Query<KasbonListQuery>,
) -> impl Responder {
    let limit: i64 = q.limit.unwrap_or(50).clamp(1, 200);
    let offset: i64 = q.offset.unwrap_or(0).max(0);
    let pegawai_id = q.pegawai_id;
    let status: Option<&str> = q.status.as_deref().map(str::trim).filter(|s| !s.is_empty());
    let qtext = q.q.clone().unwrap_or_default().trim().to_lowercase();
    let qlike: Option<String> = if qtext.is_empty() {
        None
    } else {
        Some(format!("%{}%", qtext))
    };

    let sql = format!(
        r#"
        SELECT {}
        FROM sbpv3.t_kasbon
        WHERE
          ($1::uuid IS NULL OR pegawai_id = $1::uuid)
          AND ($2::text IS NULL OR status_kasbon = $2::text)
          AND (
            $3::text IS NULL
            OR LOWER(kasbon_id::text) LIKE $3::text
            OR LOWER(pegawai_id::text) LIKE $3::text
            OR LOWER(COALESCE(alasan, '')) LIKE $3::text
            OR LOWER(status_kasbon) LIKE $3::text
            OR LOWER(metode_potong) LIKE $3::text
            OR LOWER(COALESCE(disetujui_oleh, '')) LIKE $3::text
            OR LOWER(COALESCE(catatan, '')) LIKE $3::text
          )
        ORDER BY tanggal_pengajuan DESC, updated_at DESC
        LIMIT $4 OFFSET $5
        "#,
        KASBON_COLS
    );

    let rows = match sqlx::query_as::<_, Kasbon>(&sql)
        .bind(pegawai_id)
        .bind(status)
        .bind(qlike.as_deref())
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.db)
        .await
    {
        Ok(r) => r,
        Err(e) => {
            return HttpResponse::InternalServerError().json(json!({
                "success": false,
                "message": format!("DB error: {}", e)
            }))
        }
    };

    ok_data(rows)
}

#[get("/kasbon/{kasbon_id}")]
pub async fn get_kasbon(
    state: web::Data<AppState>,
    path: web::Path<Uuid>,
) -> impl Responder {
    let kasbon_id = path.into_inner();

    let sql = format!(
        "SELECT {} FROM sbpv3.t_kasbon WHERE kasbon_id = $1",
        KASBON_COLS
    );

    let row = match sqlx::query_as::<_, Kasbon>(&sql)
        .bind(kasbon_id)
        .fetch_optional(&state.db)
        .await
    {
        Ok(r) => r,
        Err(e) => {
            return HttpResponse::InternalServerError().json(json!({
                "success": false,
                "message": format!("DB error: {}", e)
            }))
        }
    };

    match row {
        Some(r) => ok_data(r),
        None => HttpResponse::NotFound().json(json!({
            "success": false,
            "message": "Kasbon tidak ditemukan"
        })),
    }
}

#[post("/kasbon")]
pub async fn create_kasbon(
    state: web::Data<AppState>,
    body: web::Json<CreateKasbonRequest>,
) -> impl Responder {
    let b = body.into_inner();

    // ── Validasi ──
    if b.nominal_pengajuan <= 0 {
        return bad_request("nominal_pengajuan harus > 0");
    }
    // jumlah_cicilan TIDAK divalidasi — default 0, bisa berapa saja
    if let Err(msg) = validate_text_enum(
        "status_kasbon",
        &b.status_kasbon,
        &["diajukan", "disetujui", "ditolak", "dicairkan", "lunas"],
    ) {
        return bad_request(&msg);
    }
    if let Err(msg) = validate_text_enum(
        "metode_potong",
        &b.metode_potong,
        &["potong_gaji", "cicilan"],
    ) {
        return bad_request(&msg);
    }
    if let Some(ref mp) = b.metode_pencairan {
        if let Err(msg) = validate_text_enum("metode_pencairan", mp, &["tunai", "transfer"]) {
            return bad_request(&msg);
        }
    }
    if let Some(nom) = b.nominal_disetujui {
        if nom <= 0 {
            return bad_request("nominal_disetujui harus > 0");
        }
    }

    let now = Utc::now();

    // saldo_kasbon: dari request, atau auto dari nominal jika dicairkan
    let saldo: i64 = if let Some(s) = b.saldo_kasbon {
        s
    } else if b.status_kasbon == "dicairkan" {
        b.nominal_disetujui.unwrap_or(b.nominal_pengajuan)
    } else {
        0
    };

    let inserted = match sqlx::query_as::<_, Kasbon>(&format!(
        r#"
        INSERT INTO sbpv3.t_kasbon (
            kasbon_id, pegawai_id, kontrak_id,
            tanggal_pengajuan, nominal_pengajuan, alasan,
            status_kasbon, disetujui_oleh, tanggal_persetujuan, nominal_disetujui,
            tanggal_cair, metode_pencairan, bukti_pencairan_url,
            metode_potong, jumlah_cicilan, saldo_kasbon,
            catatan, created_at, updated_at
        )
        VALUES (
            $1,$2,$3,
            $4,$5,$6,
            $7,$8,$9,$10,
            $11,$12,$13,
            $14,$15,$16,
            $17,$18,$19
        )
        RETURNING {}
        "#,
        KASBON_COLS
    ))
        .bind(b.kasbon_id)
        .bind(b.pegawai_id)
        .bind(b.kontrak_id)
        .bind(b.tanggal_pengajuan)
        .bind(b.nominal_pengajuan)
        .bind(opt_trim(b.alasan))
        .bind(b.status_kasbon.trim().to_string())
        .bind(opt_trim(b.disetujui_oleh))
        .bind(b.tanggal_persetujuan)
        .bind(b.nominal_disetujui)
        .bind(b.tanggal_cair)
        .bind(opt_trim(b.metode_pencairan))
        .bind(opt_trim(b.bukti_pencairan_url))
        .bind(b.metode_potong.trim().to_string())
        .bind(b.jumlah_cicilan)       // default 0 dari serde
        .bind(saldo)
        .bind(opt_trim(b.catatan))
        .bind(now)
        .bind(now)
        .fetch_one(&state.db)
        .await
    {
        Ok(r) => r,
        Err(e) => {
            let msg = format!("{}", e).to_lowercase();
            if msg.contains("duplicate") {
                return bad_request("Kasbon ID sudah ada (duplicate)");
            }
            if msg.contains("foreign key") || msg.contains("fk") {
                return bad_request("pegawai_id atau kontrak_id tidak valid (FK error)");
            }
            return HttpResponse::InternalServerError().json(json!({
                "success": false,
                "message": format!("DB error: {}", e)
            }));
        }
    };

    // NOTE: Tidak ada lagi auto-generate cicilan.
    // Pembayaran sekarang via POST /api/kasbon/{id}/mutasi

    broadcast_kasbon(&state.tx, "created", json!(inserted));
    ok_data(inserted)
}

#[put("/kasbon/{kasbon_id}")]
pub async fn update_kasbon(
    state: web::Data<AppState>,
    path: web::Path<Uuid>,
    body: web::Json<UpdateKasbonRequest>,
) -> impl Responder {
    let kasbon_id = path.into_inner();
    let b = body.into_inner();

    // Fetch existing
    let sql = format!(
        "SELECT {} FROM sbpv3.t_kasbon WHERE kasbon_id = $1",
        KASBON_COLS
    );
    let existing = match sqlx::query_as::<_, Kasbon>(&sql)
        .bind(kasbon_id)
        .fetch_optional(&state.db)
        .await
    {
        Ok(r) => r,
        Err(e) => {
            return HttpResponse::InternalServerError().json(json!({
                "success": false,
                "message": format!("DB error: {}", e)
            }))
        }
    };

    let mut row = match existing {
        Some(r) => r,
        None => {
            return HttpResponse::NotFound().json(json!({
                "success": false,
                "message": "Kasbon tidak ditemukan"
            }))
        }
    };

    // Merge patch
    if let Some(v) = b.pegawai_id {
        row.pegawai_id = v;
    }
    if let Some(v) = b.kontrak_id {
        row.kontrak_id = v;
    }
    if let Some(v) = b.tanggal_pengajuan {
        row.tanggal_pengajuan = v;
    }
    if let Some(v) = b.nominal_pengajuan {
        row.nominal_pengajuan = v;
    }
    if let Some(v) = b.alasan {
        row.alasan = v;
    }
    if let Some(v) = b.status_kasbon {
        row.status_kasbon = v;
    }
    if let Some(v) = b.disetujui_oleh {
        row.disetujui_oleh = v;
    }
    if let Some(v) = b.tanggal_persetujuan {
        row.tanggal_persetujuan = v;
    }
    if let Some(v) = b.nominal_disetujui {
        row.nominal_disetujui = v;
    }
    if let Some(v) = b.tanggal_cair {
        row.tanggal_cair = v;
    }
    if let Some(v) = b.metode_pencairan {
        row.metode_pencairan = v;
    }
    if let Some(v) = b.bukti_pencairan_url {
        row.bukti_pencairan_url = v;
    }
    if let Some(v) = b.metode_potong {
        row.metode_potong = v;
    }
    if let Some(v) = b.jumlah_cicilan {
        row.jumlah_cicilan = v;
    }
    if let Some(v) = b.saldo_kasbon {
        row.saldo_kasbon = v;
    }
    if let Some(v) = b.catatan {
        row.catatan = v;
    }

    // ── Validate after merge ──
    if row.nominal_pengajuan <= 0 {
        return bad_request("nominal_pengajuan harus > 0");
    }
    // jumlah_cicilan TIDAK divalidasi — legacy, selalu diterima
    if let Err(msg) = validate_text_enum(
        "status_kasbon",
        &row.status_kasbon,
        &["diajukan", "disetujui", "ditolak", "dicairkan", "lunas"],
    ) {
        return bad_request(&msg);
    }
    if let Err(msg) = validate_text_enum(
        "metode_potong",
        &row.metode_potong,
        &["potong_gaji", "cicilan"],
    ) {
        return bad_request(&msg);
    }
    if let Some(ref mp) = row.metode_pencairan {
        if let Err(msg) = validate_text_enum("metode_pencairan", mp, &["tunai", "transfer"]) {
            return bad_request(&msg);
        }
    }

    let now = Utc::now();

    let updated = match sqlx::query_as::<_, Kasbon>(&format!(
        r#"
        UPDATE sbpv3.t_kasbon
        SET
            pegawai_id = $2,
            kontrak_id = $3,
            tanggal_pengajuan = $4,
            nominal_pengajuan = $5,
            alasan = $6,
            status_kasbon = $7,
            disetujui_oleh = $8,
            tanggal_persetujuan = $9,
            nominal_disetujui = $10,
            tanggal_cair = $11,
            metode_pencairan = $12,
            bukti_pencairan_url = $13,
            metode_potong = $14,
            jumlah_cicilan = $15,
            saldo_kasbon = $16,
            catatan = $17,
            updated_at = $18
        WHERE kasbon_id = $1
        RETURNING {}
        "#,
        KASBON_COLS
    ))
        .bind(kasbon_id)
        .bind(row.pegawai_id)
        .bind(row.kontrak_id)
        .bind(row.tanggal_pengajuan)
        .bind(row.nominal_pengajuan)
        .bind(opt_trim(row.alasan.clone()))
        .bind(row.status_kasbon.trim().to_string())
        .bind(opt_trim(row.disetujui_oleh.clone()))
        .bind(row.tanggal_persetujuan)
        .bind(row.nominal_disetujui)
        .bind(row.tanggal_cair)
        .bind(opt_trim(row.metode_pencairan.clone()))
        .bind(opt_trim(row.bukti_pencairan_url.clone()))
        .bind(row.metode_potong.trim().to_string())
        .bind(row.jumlah_cicilan)
        .bind(row.saldo_kasbon)
        .bind(opt_trim(row.catatan.clone()))
        .bind(now)
        .fetch_one(&state.db)
        .await
    {
        Ok(r) => r,
        Err(e) => {
            return HttpResponse::InternalServerError().json(json!({
                "success": false,
                "message": format!("DB error: {}", e)
            }))
        }
    };

    // NOTE: Tidak ada lagi auto-generate cicilan atau recalculate saldo.
    // Pembayaran sekarang via POST /api/kasbon/{id}/mutasi

    broadcast_kasbon(&state.tx, "updated", json!(updated));
    ok_data(updated)
}

#[delete("/kasbon/{kasbon_id}")]
pub async fn delete_kasbon(
    state: web::Data<AppState>,
    path: web::Path<Uuid>,
) -> impl Responder {
    let kasbon_id = path.into_inner();

    // Hapus mutasi + cicilan lama (ON DELETE CASCADE, tapi explicit juga aman)
    let _ = sqlx::query("DELETE FROM sbpv3.t_kasbon_mutasi WHERE kasbon_id = $1")
        .bind(kasbon_id)
        .execute(&state.db)
        .await;
    let _ = sqlx::query("DELETE FROM sbpv3.t_kasbon_cicilan WHERE kasbon_id = $1")
        .bind(kasbon_id)
        .execute(&state.db)
        .await;

    let sql = format!(
        "DELETE FROM sbpv3.t_kasbon WHERE kasbon_id = $1 RETURNING {}",
        KASBON_COLS
    );

    let deleted = match sqlx::query_as::<_, Kasbon>(&sql)
        .bind(kasbon_id)
        .fetch_optional(&state.db)
        .await
    {
        Ok(r) => r,
        Err(e) => {
            return HttpResponse::InternalServerError().json(json!({
                "success": false,
                "message": format!("DB error: {}", e)
            }))
        }
    };

    match deleted {
        Some(r) => {
            broadcast_kasbon(&state.tx, "deleted", json!({ "kasbon_id": r.kasbon_id }));
            ok_data(r)
        }
        None => HttpResponse::NotFound().json(json!({
            "success": false,
            "message": "Kasbon tidak ditemukan"
        })),
    }
}

/* ===========================
   NOTE: list_cicilan dan update_cicilan DIHAPUS.
   Pembayaran kasbon sekarang via:
     GET  /api/kasbon/{id}/mutasi  → routes::kasbon_mutasi::list_mutasi
     POST /api/kasbon/{id}/mutasi  → routes::kasbon_mutasi::create_mutasi
   =========================== */

/* ===========================
   WS: /ws/kasbon
   =========================== */

const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(5);
const CLIENT_TIMEOUT: Duration = Duration::from_secs(30);

pub struct KasbonWs {
    hb: Instant,
    rx: broadcast::Receiver<String>,
}

impl KasbonWs {
    pub fn new(rx: broadcast::Receiver<String>) -> Self {
        Self {
            hb: Instant::now(),
            rx,
        }
    }

    fn start_heartbeat(&self, ctx: &mut ws::WebsocketContext<Self>) {
        ctx.run_interval(HEARTBEAT_INTERVAL, |act, ctx| {
            if Instant::now().duration_since(act.hb) > CLIENT_TIMEOUT {
                ctx.stop();
                return;
            }
            ctx.ping(b"ping");
        });
    }
}

impl Actor for KasbonWs {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        self.start_heartbeat(ctx);
        let stream = BroadcastStream::new(self.rx.resubscribe());
        ctx.add_stream(stream);
    }
}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for KasbonWs {
    fn handle(
        &mut self,
        item: Result<ws::Message, ws::ProtocolError>,
        ctx: &mut Self::Context,
    ) {
        match item {
            Ok(ws::Message::Ping(msg)) => {
                self.hb = Instant::now();
                ctx.pong(&msg);
            }
            Ok(ws::Message::Pong(_)) => {
                self.hb = Instant::now();
            }
            Ok(ws::Message::Text(_)) => {}
            Ok(ws::Message::Close(reason)) => {
                ctx.close(reason);
                ctx.stop();
            }
            Ok(ws::Message::Binary(_)) => {}
            Ok(ws::Message::Continuation(_)) => {}
            Ok(ws::Message::Nop) => {}
            Err(_) => ctx.stop(),
        }
    }
}

impl StreamHandler<Result<String, BroadcastStreamRecvError>> for KasbonWs {
    fn handle(
        &mut self,
        item: Result<String, BroadcastStreamRecvError>,
        ctx: &mut Self::Context,
    ) {
        if let Ok(text) = item {
            let should_send = match serde_json::from_str::<serde_json::Value>(&text) {
                Ok(v) => v.get("tipe").and_then(|x| x.as_str()) == Some("kasbon"),
                Err(_) => false,
            };
            if should_send {
                ctx.text(text);
            }
        }
    }
}

#[get("/ws/kasbon")]
pub async fn ws_kasbon_handler(
    req: HttpRequest,
    stream: web::Payload,
    state: web::Data<AppState>,
) -> Result<HttpResponse, Error> {
    let rx = state.tx.subscribe();
    ws::start(KasbonWs::new(rx), &req, stream)
}