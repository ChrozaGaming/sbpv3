// src/routes/masterpegawai.rs
use actix_web::{delete, get, post, put, web, Error, HttpRequest, HttpResponse, Responder};
use serde_json::json;
use actix::ActorContext;
use uuid::Uuid;

use crate::models::masterpegawai::{
    CreateMasterPegawaiRequest, ListQuery, MasterPegawai, UpdateMasterPegawaiRequest,
};
use crate::state::AppState;

/* ===========================
   WS: MasterPegawai (khusus)
   Path: /ws/pegawai
   =========================== */

use actix::{Actor, AsyncContext, StreamHandler};
use actix_web_actors::ws;
use std::time::{Duration, Instant};
use tokio::sync::broadcast;

const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(5);
const CLIENT_TIMEOUT: Duration = Duration::from_secs(30);
const DRAIN_INTERVAL: Duration = Duration::from_millis(200);

pub struct MasterPegawaiWsSession {
    hb: Instant,
    rx: broadcast::Receiver<String>,
}

impl MasterPegawaiWsSession {
    pub fn new(rx: broadcast::Receiver<String>) -> Self {
        Self {
            hb: Instant::now(),
            rx,
        }
    }

    fn start_heartbeat(&self, ctx: &mut ws::WebsocketContext<Self>) {
        ctx.run_interval(HEARTBEAT_INTERVAL, |act, ctx| {
            if Instant::now().duration_since(act.hb) > CLIENT_TIMEOUT {
                // timeout -> stop
                ctx.close(None);
                ctx.stop();
                return;
            }
            // ping -> browser akan auto balas Pong
            ctx.ping(b"hb");
        });
    }

    fn start_drain_broadcast(&self, ctx: &mut ws::WebsocketContext<Self>) {
        ctx.run_interval(DRAIN_INTERVAL, |act, ctx| {
            use tokio::sync::broadcast::error::TryRecvError;

            loop {
                match act.rx.try_recv() {
                    Ok(msg) => {
                        // FILTER: hanya event masterpegawai + valid JSON
                        if let Ok(v) = serde_json::from_str::<serde_json::Value>(&msg) {
                            let tipe_ok = v
                                .get("tipe")
                                .and_then(|x| x.as_str())
                                .map(|x| x == "masterpegawai")
                                .unwrap_or(false);

                            if tipe_ok {
                                ctx.text(msg);
                            }
                        }
                    }
                    Err(TryRecvError::Empty) => break,
                    Err(TryRecvError::Lagged(_)) => {
                        // skip pesan lama, lanjut drain lagi
                        continue;
                    }
                    Err(TryRecvError::Closed) => {
                        ctx.close(None);
                        ctx.stop();
                        break;
                    }
                }
            }
        });
    }
}

impl Actor for MasterPegawaiWsSession {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        self.start_heartbeat(ctx);
        self.start_drain_broadcast(ctx);

        ctx.text(
            json!({
                "tipe": "system",
                "event": "connected",
                "payload": { "channel": "masterpegawai" }
            })
                .to_string(),
        );
    }
}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for MasterPegawaiWsSession {
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        match msg {
            Ok(ws::Message::Ping(bytes)) => {
                self.hb = Instant::now();
                ctx.pong(&bytes);
            }
            Ok(ws::Message::Pong(_)) => {
                self.hb = Instant::now();
            }
            Ok(ws::Message::Text(_text)) => {
                // jangan echo apa pun -> biasanya FE gak butuh
            }
            Ok(ws::Message::Binary(_bin)) => {}
            Ok(ws::Message::Close(reason)) => {
                ctx.close(reason);
                ctx.stop();
            }
            _ => (),
        }
    }
}

#[get("/ws/pegawai")]
pub async fn ws_masterpegawai_handler(
    req: HttpRequest,
    stream: web::Payload,
    state: web::Data<AppState>,
) -> Result<HttpResponse, Error> {
    let rx = state.tx.subscribe();
    ws::start(MasterPegawaiWsSession::new(rx), &req, stream)
}

/* ===========================
   REST: MasterPegawai
   =========================== */

fn ws_event(event: &str, payload: serde_json::Value) -> String {
    json!({
        "tipe": "masterpegawai",
        "event": event,
        "payload": payload
    })
        .to_string()
}

#[get("/masterpegawai")]
pub async fn list_masterpegawai(
    state: web::Data<AppState>,
    query: web::Query<ListQuery>,
) -> impl Responder {
    match MasterPegawai::list(&state.db, query.into_inner()).await {
        Ok(rows) => HttpResponse::Ok().json(json!({
            "success": true,
            "data": rows
        })),
        Err(e) => HttpResponse::InternalServerError().json(json!({
            "success": false,
            "message": "Gagal mengambil data master pegawai.",
            "error": e.to_string()
        })),
    }
}

#[get("/masterpegawai/{pegawai_id}")]
pub async fn get_masterpegawai(
    state: web::Data<AppState>,
    pegawai_id: web::Path<Uuid>,
) -> impl Responder {
    match MasterPegawai::get_by_id(&state.db, pegawai_id.into_inner()).await {
        Ok(Some(row)) => HttpResponse::Ok().json(json!({ "success": true, "data": row })),
        Ok(None) => HttpResponse::NotFound().json(json!({
            "success": false,
            "message": "Pegawai tidak ditemukan."
        })),
        Err(e) => HttpResponse::InternalServerError().json(json!({
            "success": false,
            "message": "Gagal mengambil detail pegawai.",
            "error": e.to_string()
        })),
    }
}

#[get("/masterpegawai/nik/{nik}")]
pub async fn get_masterpegawai_by_nik(
    state: web::Data<AppState>,
    nik: web::Path<String>,
) -> impl Responder {
    match MasterPegawai::get_by_nik(&state.db, nik.as_str()).await {
        Ok(Some(row)) => HttpResponse::Ok().json(json!({ "success": true, "data": row })),
        Ok(None) => HttpResponse::NotFound().json(json!({
            "success": false,
            "message": "Pegawai dengan NIK tersebut tidak ditemukan."
        })),
        Err(e) => HttpResponse::InternalServerError().json(json!({
            "success": false,
            "message": "Gagal mengambil data pegawai berdasarkan NIK.",
            "error": e.to_string()
        })),
    }
}

#[post("/masterpegawai")]
pub async fn create_masterpegawai(
    state: web::Data<AppState>,
    body: web::Json<CreateMasterPegawaiRequest>,
) -> impl Responder {
    // Validasi minimal (sesuai FE)
    if body.nik.trim().len() != 16 {
        return HttpResponse::BadRequest().json(json!({
            "success": false,
            "message": "NIK wajib 16 digit."
        }));
    }
    if body.nama_lengkap.trim().is_empty() {
        return HttpResponse::BadRequest().json(json!({
            "success": false,
            "message": "Nama lengkap wajib diisi."
        }));
    }
    if body.no_hp.trim().is_empty() {
        return HttpResponse::BadRequest().json(json!({
            "success": false,
            "message": "No HP wajib diisi."
        }));
    }
    if body.alamat_ktp.trim().is_empty()
        || body.kota_kab_ktp.trim().is_empty()
        || body.provinsi_ktp.trim().is_empty()
    {
        return HttpResponse::BadRequest().json(json!({
            "success": false,
            "message": "Alamat KTP, Kota/Kab KTP, dan Provinsi KTP wajib diisi."
        }));
    }
    if body.bank_nama.trim().is_empty()
        || body.bank_no_rekening.trim().is_empty()
        || body.bank_nama_pemilik.trim().is_empty()
    {
        return HttpResponse::BadRequest().json(json!({
            "success": false,
            "message": "Data bank (nama bank, no rekening, pemilik) wajib diisi."
        }));
    }

    match MasterPegawai::insert(&state.db, body.into_inner()).await {
        Ok(row) => {
            // broadcast event ke websocket (payload: id + ringkas)
            let _ = state.tx.send(ws_event(
                "created",
                json!({
                    "pegawai_id": row.pegawai_id,
                    "nik": row.nik,
                    "nama_lengkap": row.nama_lengkap
                }),
            ));

            HttpResponse::Created().json(json!({
                "success": true,
                "message": "Pegawai berhasil ditambahkan.",
                "data": row
            }))
        }
        Err(e) => {
            let msg = if e.to_string().to_lowercase().contains("uq_master_pegawai_lapangan_nik")
                || e.to_string().to_lowercase().contains("duplicate key")
            {
                "NIK sudah terdaftar."
            } else {
                "Gagal menambahkan pegawai."
            };

            HttpResponse::InternalServerError().json(json!({
                "success": false,
                "message": msg,
                "error": e.to_string()
            }))
        }
    }
}

#[put("/masterpegawai/{pegawai_id}")]
pub async fn update_masterpegawai(
    state: web::Data<AppState>,
    pegawai_id: web::Path<Uuid>,
    body: web::Json<UpdateMasterPegawaiRequest>,
) -> impl Responder {
    let id = pegawai_id.into_inner();

    match MasterPegawai::update(&state.db, id, body.into_inner()).await {
        Ok(Some(row)) => {
            let _ = state.tx.send(ws_event(
                "updated",
                json!({
                    "pegawai_id": row.pegawai_id,
                    "nik": row.nik,
                    "nama_lengkap": row.nama_lengkap
                }),
            ));

            HttpResponse::Ok().json(json!({
                "success": true,
                "message": "Pegawai berhasil diperbarui.",
                "data": row
            }))
        }
        Ok(None) => HttpResponse::NotFound().json(json!({
            "success": false,
            "message": "Pegawai tidak ditemukan."
        })),
        Err(e) => HttpResponse::InternalServerError().json(json!({
            "success": false,
            "message": "Gagal memperbarui pegawai.",
            "error": e.to_string()
        })),
    }
}

#[delete("/masterpegawai/{pegawai_id}")]
pub async fn delete_masterpegawai(
    state: web::Data<AppState>,
    pegawai_id: web::Path<Uuid>,
) -> impl Responder {
    let id = pegawai_id.into_inner();

    match MasterPegawai::delete(&state.db, id).await {
        Ok(true) => {
            let _ = state.tx.send(ws_event("deleted", json!({ "pegawai_id": id })));

            HttpResponse::Ok().json(json!({
                "success": true,
                "message": "Pegawai berhasil dihapus."
            }))
        }
        Ok(false) => HttpResponse::NotFound().json(json!({
            "success": false,
            "message": "Pegawai tidak ditemukan."
        })),
        Err(e) => HttpResponse::InternalServerError().json(json!({
            "success": false,
            "message": "Gagal menghapus pegawai.",
            "error": e.to_string()
        })),
    }
}
