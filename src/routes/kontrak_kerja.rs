use actix::{Actor, ActorContext, AsyncContext, StreamHandler};
use actix_web::{delete, get, post, put, web, Error, HttpRequest, HttpResponse, Responder};
use actix_web_actors::ws;
use chrono::Utc;
use serde_json::json;
use std::time::{Duration, Instant};
use tokio::sync::broadcast;
use tokio_stream::wrappers::{errors::BroadcastStreamRecvError, BroadcastStream};
use uuid::Uuid;

use crate::models::kontrak_kerja::{
    CreateKontrakKerjaRequest, KontrakKerja, ListQuery, UpdateKontrakKerjaRequest,
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
        Err(format!("{} tidak valid. Allowed: {}", field, allowed.join(", ")))
    }
}

fn validate_money_opt(field: &str, v: &Option<i64>) -> Result<(), String> {
    if let Some(x) = v {
        if *x < 0 {
            return Err(format!("{} tidak boleh < 0", field));
        }
    }
    Ok(())
}

fn opt_trim(v: Option<String>) -> Option<String> {
    v.map(|s| s.trim().to_string()).filter(|s| !s.is_empty())
}

fn broadcast_event(tx: &broadcast::Sender<String>, event: &str, payload: serde_json::Value) {
    let msg = json!({
        "tipe": "kontrak_kerja",
        "event": event,
        "payload": payload
    })
        .to_string();
    let _ = tx.send(msg);
}

/* ===========================
   REST: /api/kontrakkerja
   =========================== */

#[get("/kontrakkerja")]
pub async fn list_kontrak_kerja(state: web::Data<AppState>, q: web::Query<ListQuery>) -> impl Responder {
    let limit: i64 = q.limit.unwrap_or(50).clamp(1, 200);
    let offset: i64 = q.offset.unwrap_or(0).max(0);

    let pegawai_id = q.pegawai_id;
    let vendor_id = q.vendor_id;

    // ✅ aman (tanpa inference aneh)
    let status: Option<&str> = q.status.as_deref().map(str::trim).filter(|s| !s.is_empty());
    let tipe: Option<&str> = q.tipe.as_deref().map(str::trim).filter(|s| !s.is_empty());

    let qtext = q.q.clone().unwrap_or_default().trim().to_lowercase();
    let qlike: Option<String> = if qtext.is_empty() { None } else { Some(format!("%{}%", qtext)) };

    let rows: Vec<KontrakKerja> = match sqlx::query_as::<_, KontrakKerja>(
        r#"
        SELECT
          kontrak_id, pegawai_id, vendor_id,
          tipe_kontrak, jabatan, kategori_pekerja,
          mulai_kontrak, akhir_kontrak,
          status_kontrak,
          upah_harian_default, upah_mingguan_default, upah_bulanan_default,
          lokasi_penempatan_default, dokumen_kontrak_url,
          created_at, updated_at
        FROM sbpv3.t_kontrak_kerja
        WHERE
          ($1::uuid IS NULL OR pegawai_id = $1::uuid)
          AND ($2::uuid IS NULL OR vendor_id = $2::uuid)
          AND ($3::text IS NULL OR status_kontrak = $3::text)
          AND ($4::text IS NULL OR tipe_kontrak = $4::text)
          AND (
            $5::text IS NULL
            OR LOWER(kontrak_id::text) LIKE $5::text
            OR LOWER(pegawai_id::text) LIKE $5::text
            OR LOWER(COALESCE(vendor_id::text, '')) LIKE $5::text
            OR LOWER(tipe_kontrak) LIKE $5::text
            OR LOWER(jabatan) LIKE $5::text
            OR LOWER(kategori_pekerja) LIKE $5::text
            OR LOWER(status_kontrak) LIKE $5::text
            OR LOWER(COALESCE(lokasi_penempatan_default, '')) LIKE $5::text
          )
        ORDER BY mulai_kontrak DESC, updated_at DESC
        LIMIT $6 OFFSET $7
        "#,
    )
        .bind(pegawai_id)
        .bind(vendor_id)
        .bind(status)
        .bind(tipe)
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

#[get("/kontrakkerja/{kontrak_id}")]
pub async fn get_kontrak_kerja(state: web::Data<AppState>, path: web::Path<Uuid>) -> impl Responder {
    let kontrak_id = path.into_inner();

    let row: Option<KontrakKerja> = match sqlx::query_as::<_, KontrakKerja>(
        r#"
        SELECT
          kontrak_id, pegawai_id, vendor_id,
          tipe_kontrak, jabatan, kategori_pekerja,
          mulai_kontrak, akhir_kontrak,
          status_kontrak,
          upah_harian_default, upah_mingguan_default, upah_bulanan_default,
          lokasi_penempatan_default, dokumen_kontrak_url,
          created_at, updated_at
        FROM sbpv3.t_kontrak_kerja
        WHERE kontrak_id = $1
        "#,
    )
        .bind(kontrak_id)
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
            "message": "Kontrak tidak ditemukan"
        })),
    }
}

#[post("/kontrakkerja")]
pub async fn create_kontrak_kerja(
    state: web::Data<AppState>,
    body: web::Json<CreateKontrakKerjaRequest>,
) -> impl Responder {
    let b = body.into_inner();

    if b.jabatan.trim().is_empty() {
        return bad_request("Jabatan wajib diisi");
    }

    if let Some(akhir) = b.akhir_kontrak {
        if akhir < b.mulai_kontrak {
            return bad_request("Akhir kontrak tidak boleh sebelum mulai kontrak");
        }
    }

    if let Err(msg) = validate_text_enum("tipe_kontrak", &b.tipe_kontrak, &["Harian", "Lepas", "Borongan", "PKWT", "PKWTT"]) {
        return bad_request(&msg);
    }
    if let Err(msg) = validate_text_enum("kategori_pekerja", &b.kategori_pekerja, &["Skill", "Non-skill"]) {
        return bad_request(&msg);
    }
    if let Err(msg) = validate_text_enum("status_kontrak", &b.status_kontrak, &["aktif", "selesai", "putus"]) {
        return bad_request(&msg);
    }

    if let Err(msg) = validate_money_opt("upah_harian_default", &b.upah_harian_default) {
        return bad_request(&msg);
    }
    if let Err(msg) = validate_money_opt("upah_mingguan_default", &b.upah_mingguan_default) {
        return bad_request(&msg);
    }
    if let Err(msg) = validate_money_opt("upah_bulanan_default", &b.upah_bulanan_default) {
        return bad_request(&msg);
    }

    if let Some(url) = b.dokumen_kontrak_url.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        if !(url.starts_with("http://") || url.starts_with("https://")) {
            return bad_request("dokumen_kontrak_url harus diawali http:// atau https://");
        }
    }

    let now = Utc::now();

    let inserted: KontrakKerja = match sqlx::query_as::<_, KontrakKerja>(
        r#"
        INSERT INTO sbpv3.t_kontrak_kerja (
          kontrak_id, pegawai_id, vendor_id,
          tipe_kontrak, jabatan, kategori_pekerja,
          mulai_kontrak, akhir_kontrak,
          status_kontrak,
          upah_harian_default, upah_mingguan_default, upah_bulanan_default,
          lokasi_penempatan_default, dokumen_kontrak_url,
          created_at, updated_at
        )
        VALUES (
          $1,$2,$3,
          $4,$5,$6,
          $7,$8,
          $9,
          $10,$11,$12,
          $13,$14,
          $15,$16
        )
        RETURNING
          kontrak_id, pegawai_id, vendor_id,
          tipe_kontrak, jabatan, kategori_pekerja,
          mulai_kontrak, akhir_kontrak,
          status_kontrak,
          upah_harian_default, upah_mingguan_default, upah_bulanan_default,
          lokasi_penempatan_default, dokumen_kontrak_url,
          created_at, updated_at
        "#,
    )
        .bind(b.kontrak_id)
        .bind(b.pegawai_id)
        .bind(b.vendor_id)
        .bind(b.tipe_kontrak.trim().to_string())
        .bind(b.jabatan.trim().to_string())
        .bind(b.kategori_pekerja.trim().to_string())
        .bind(b.mulai_kontrak)
        .bind(b.akhir_kontrak)
        .bind(b.status_kontrak.trim().to_string())
        .bind(b.upah_harian_default)
        .bind(b.upah_mingguan_default)
        .bind(b.upah_bulanan_default)
        .bind(opt_trim(b.lokasi_penempatan_default))
        .bind(opt_trim(b.dokumen_kontrak_url))
        .bind(now)
        .bind(now)
        .fetch_one(&state.db)
        .await
    {
        Ok(r) => r,
        Err(e) => {
            let msg = format!("{}", e).to_lowercase();
            if msg.contains("duplicate") {
                return bad_request("Kontrak ID sudah ada (duplicate)");
            }
            return HttpResponse::InternalServerError().json(json!({
                "success": false,
                "message": format!("DB error: {}", e)
            }));
        }
    };

    broadcast_event(&state.tx, "created", json!(inserted));
    ok_data(inserted)
}

#[put("/kontrakkerja/{kontrak_id}")]
pub async fn update_kontrak_kerja(
    state: web::Data<AppState>,
    path: web::Path<Uuid>,
    body: web::Json<UpdateKontrakKerjaRequest>,
) -> impl Responder {
    let kontrak_id = path.into_inner();
    let b = body.into_inner();

    let existing: Option<KontrakKerja> = match sqlx::query_as::<_, KontrakKerja>(
        r#"
        SELECT
          kontrak_id, pegawai_id, vendor_id,
          tipe_kontrak, jabatan, kategori_pekerja,
          mulai_kontrak, akhir_kontrak,
          status_kontrak,
          upah_harian_default, upah_mingguan_default, upah_bulanan_default,
          lokasi_penempatan_default, dokumen_kontrak_url,
          created_at, updated_at
        FROM sbpv3.t_kontrak_kerja
        WHERE kontrak_id = $1
        "#,
    )
        .bind(kontrak_id)
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
                "message": "Kontrak tidak ditemukan"
            }))
        }
    };

    // merge patch
    if let Some(v) = b.pegawai_id { row.pegawai_id = v; }
    if let Some(v) = b.vendor_id { row.vendor_id = v; }

    if let Some(v) = b.tipe_kontrak { row.tipe_kontrak = v; }
    if let Some(v) = b.jabatan { row.jabatan = v; }
    if let Some(v) = b.kategori_pekerja { row.kategori_pekerja = v; }

    if let Some(v) = b.mulai_kontrak { row.mulai_kontrak = v; }
    if let Some(v) = b.akhir_kontrak { row.akhir_kontrak = v; }

    if let Some(v) = b.status_kontrak { row.status_kontrak = v; }

    if let Some(v) = b.upah_harian_default { row.upah_harian_default = v; }
    if let Some(v) = b.upah_mingguan_default { row.upah_mingguan_default = v; }
    if let Some(v) = b.upah_bulanan_default { row.upah_bulanan_default = v; }

    if let Some(v) = b.lokasi_penempatan_default { row.lokasi_penempatan_default = v; }
    if let Some(v) = b.dokumen_kontrak_url { row.dokumen_kontrak_url = v; }

    // validations after merge
    if row.jabatan.trim().is_empty() {
        return bad_request("Jabatan wajib diisi");
    }
    if let Some(akhir) = row.akhir_kontrak {
        if akhir < row.mulai_kontrak {
            return bad_request("Akhir kontrak tidak boleh sebelum mulai kontrak");
        }
    }

    if let Err(msg) = validate_text_enum("tipe_kontrak", &row.tipe_kontrak, &["Harian", "Lepas", "Borongan", "PKWT", "PKWTT"]) {
        return bad_request(&msg);
    }
    if let Err(msg) = validate_text_enum("kategori_pekerja", &row.kategori_pekerja, &["Skill", "Non-skill"]) {
        return bad_request(&msg);
    }
    if let Err(msg) = validate_text_enum("status_kontrak", &row.status_kontrak, &["aktif", "selesai", "putus"]) {
        return bad_request(&msg);
    }

    if let Err(msg) = validate_money_opt("upah_harian_default", &row.upah_harian_default) {
        return bad_request(&msg);
    }
    if let Err(msg) = validate_money_opt("upah_mingguan_default", &row.upah_mingguan_default) {
        return bad_request(&msg);
    }
    if let Err(msg) = validate_money_opt("upah_bulanan_default", &row.upah_bulanan_default) {
        return bad_request(&msg);
    }

    if let Some(url) = row.dokumen_kontrak_url.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        if !(url.starts_with("http://") || url.starts_with("https://")) {
            return bad_request("dokumen_kontrak_url harus diawali http:// atau https://");
        }
    }

    let now = Utc::now();

    let lokasi_bind: Option<String> = opt_trim(row.lokasi_penempatan_default.clone());
    let dok_bind: Option<String> = opt_trim(row.dokumen_kontrak_url.clone());

    let updated: KontrakKerja = match sqlx::query_as::<_, KontrakKerja>(
        r#"
        UPDATE sbpv3.t_kontrak_kerja
        SET
          pegawai_id = $2,
          vendor_id = $3,
          tipe_kontrak = $4,
          jabatan = $5,
          kategori_pekerja = $6,
          mulai_kontrak = $7,
          akhir_kontrak = $8,
          status_kontrak = $9,
          upah_harian_default = $10,
          upah_mingguan_default = $11,
          upah_bulanan_default = $12,
          lokasi_penempatan_default = $13,
          dokumen_kontrak_url = $14,
          updated_at = $15
        WHERE kontrak_id = $1
        RETURNING
          kontrak_id, pegawai_id, vendor_id,
          tipe_kontrak, jabatan, kategori_pekerja,
          mulai_kontrak, akhir_kontrak,
          status_kontrak,
          upah_harian_default, upah_mingguan_default, upah_bulanan_default,
          lokasi_penempatan_default, dokumen_kontrak_url,
          created_at, updated_at
        "#,
    )
        .bind(kontrak_id)
        .bind(row.pegawai_id)
        .bind(row.vendor_id)
        .bind(row.tipe_kontrak.trim().to_string())
        .bind(row.jabatan.trim().to_string())
        .bind(row.kategori_pekerja.trim().to_string())
        .bind(row.mulai_kontrak)
        .bind(row.akhir_kontrak)
        .bind(row.status_kontrak.trim().to_string())
        .bind(row.upah_harian_default)
        .bind(row.upah_mingguan_default)
        .bind(row.upah_bulanan_default)
        .bind(lokasi_bind)
        .bind(dok_bind)
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

    broadcast_event(&state.tx, "updated", json!(updated));
    ok_data(updated)
}

#[delete("/kontrakkerja/{kontrak_id}")]
pub async fn delete_kontrak_kerja(state: web::Data<AppState>, path: web::Path<Uuid>) -> impl Responder {
    let kontrak_id = path.into_inner();

    let deleted: Option<KontrakKerja> = match sqlx::query_as::<_, KontrakKerja>(
        r#"
        DELETE FROM sbpv3.t_kontrak_kerja
        WHERE kontrak_id = $1
        RETURNING
          kontrak_id, pegawai_id, vendor_id,
          tipe_kontrak, jabatan, kategori_pekerja,
          mulai_kontrak, akhir_kontrak,
          status_kontrak,
          upah_harian_default, upah_mingguan_default, upah_bulanan_default,
          lokasi_penempatan_default, dokumen_kontrak_url,
          created_at, updated_at
        "#,
    )
        .bind(kontrak_id)
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
            broadcast_event(&state.tx, "deleted", json!({ "kontrak_id": r.kontrak_id }));
            ok_data(r)
        }
        None => HttpResponse::NotFound().json(json!({
            "success": false,
            "message": "Kontrak tidak ditemukan"
        })),
    }
}

/* ===========================
   WS: /ws/kontrakkerja
   =========================== */

const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(5);
const CLIENT_TIMEOUT: Duration = Duration::from_secs(30);

pub struct KontrakKerjaWs {
    hb: Instant,
    rx: broadcast::Receiver<String>,
}

impl KontrakKerjaWs {
    pub fn new(rx: broadcast::Receiver<String>) -> Self {
        Self { hb: Instant::now(), rx }
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

impl Actor for KontrakKerjaWs {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        self.start_heartbeat(ctx);

        // broadcast -> stream -> ws
        let stream = BroadcastStream::new(self.rx.resubscribe());
        ctx.add_stream(stream);
    }
}

// incoming frames
impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for KontrakKerjaWs {
    fn handle(&mut self, item: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
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

// broadcast stream messages
impl StreamHandler<Result<String, BroadcastStreamRecvError>> for KontrakKerjaWs {
    fn handle(&mut self, item: Result<String, BroadcastStreamRecvError>, ctx: &mut Self::Context) {
        if let Ok(text) = item {
            let should_send = match serde_json::from_str::<serde_json::Value>(&text) {
                Ok(v) => v.get("tipe").and_then(|x| x.as_str()) == Some("kontrak_kerja"),
                Err(_) => false,
            };
            if should_send {
                ctx.text(text);
            }
        }
    }
}

#[get("/ws/kontrakkerja")]
pub async fn ws_kontrak_kerja_handler(
    req: HttpRequest,
    stream: web::Payload,
    state: web::Data<AppState>,
) -> Result<HttpResponse, Error> {
    let rx = state.tx.subscribe();
    ws::start(KontrakKerjaWs::new(rx), &req, stream)
}
