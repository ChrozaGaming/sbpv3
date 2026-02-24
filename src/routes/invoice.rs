use actix::{Actor, ActorContext, AsyncContext, StreamHandler};
use actix_web::{delete, get, post, put, web, Error, HttpRequest, HttpResponse, Responder};
use actix_web_actors::ws;
use chrono::{Utc, NaiveDate};
use serde_json::json;
use std::time::{Duration, Instant};
use tokio::sync::broadcast;
use tokio_stream::wrappers::{errors::BroadcastStreamRecvError, BroadcastStream};
use uuid::Uuid;

use crate::models::invoice::{
    CreateInvoiceRequest, Invoice, InvoiceListQuery, UpdateInvoiceRequest,
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

fn broadcast_invoice(tx: &broadcast::Sender<String>, event: &str, payload: serde_json::Value) {
    let msg = json!({
        "tipe": "invoice",
        "event": event,
        "payload": payload
    })
        .to_string();
    let _ = tx.send(msg);
}

/* ===========================
   SQL column lists (DRY)
   =========================== */

const INVOICE_COLS: &str = r#"
    invoice_id, nomor_invoice,
    jenis_tagihan, nama_pemilik, deskripsi, frekuensi, periode,
    jumlah, jumlah_dibayar,
    tanggal_dibuat, jatuh_tempo,
    status,
    kontak_hp, kontak_email,
    nomor_id_meter,
    pemakaian, satuan_pemakaian, harga_satuan,
    reminder_aktif, reminder_metode, reminder_hari_before, reminder_berikutnya,
    catatan, created_at, updated_at
"#;

/* ===========================
   Auto-generate nomor_invoice
   =========================== */

async fn generate_nomor_invoice(pool: &sqlx::PgPool) -> Result<String, sqlx::Error> {
    let year = Utc::now().format("%Y").to_string();
    let prefix = format!("INV-{}-", year);

    let count: Option<i64> = sqlx::query_scalar(
        r#"
        SELECT COUNT(*) FROM sbpv3.t_invoice
        WHERE nomor_invoice LIKE $1 || '%'
        "#,
    )
        .bind(&prefix)
        .fetch_one(pool)
        .await?;

    let next = count.unwrap_or(0) + 1;
    Ok(format!("INV-{}-{:03}", year, next))
}

/* ===========================
   REST: /api/invoice
   =========================== */

#[get("/invoice")]
pub async fn list_invoice(
    state: web::Data<AppState>,
    q: web::Query<InvoiceListQuery>,
) -> impl Responder {
    let limit: i64 = q.limit.unwrap_or(50).clamp(1, 200);
    let offset: i64 = q.offset.unwrap_or(0).max(0);
    let frekuensi: Option<&str> = q.frekuensi.as_deref().map(str::trim).filter(|s| !s.is_empty());
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
        FROM sbpv3.t_invoice
        WHERE
          ($1::text IS NULL OR frekuensi = $1::text)
          AND ($2::text IS NULL OR status = $2::text)
          AND (
            $3::text IS NULL
            OR LOWER(nomor_invoice) LIKE $3::text
            OR LOWER(nama_pemilik) LIKE $3::text
            OR LOWER(jenis_tagihan) LIKE $3::text
            OR LOWER(COALESCE(deskripsi, '')) LIKE $3::text
            OR LOWER(COALESCE(periode, '')) LIKE $3::text
            OR LOWER(COALESCE(kontak_hp, '')) LIKE $3::text
            OR LOWER(COALESCE(catatan, '')) LIKE $3::text
          )
        ORDER BY created_at DESC, updated_at DESC
        LIMIT $4 OFFSET $5
        "#,
        INVOICE_COLS
    );

    let rows = match sqlx::query_as::<_, Invoice>(&sql)
        .bind(frekuensi)
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

#[get("/invoice/stats")]
pub async fn stats_invoice(
    state: web::Data<AppState>,
    q: web::Query<InvoiceListQuery>,
) -> impl Responder {
    let frekuensi: Option<&str> = q.frekuensi.as_deref().map(str::trim).filter(|s| !s.is_empty());

    // Per-frekuensi stats
    let sql = r#"
        SELECT
            frekuensi,
            COUNT(*)::BIGINT AS total_count,
            COALESCE(SUM(jumlah), 0)::BIGINT AS total_jumlah,
            COALESCE(SUM(jumlah_dibayar), 0)::BIGINT AS total_dibayar,
            COUNT(*) FILTER (WHERE status = 'lunas')::BIGINT AS count_lunas,
            COUNT(*) FILTER (WHERE status IN ('belum_bayar','terlambat'))::BIGINT AS count_belum,
            COUNT(*) FILTER (WHERE status = 'terlambat')::BIGINT AS count_terlambat,
            COUNT(*) FILTER (WHERE status = 'sebagian')::BIGINT AS count_sebagian
        FROM sbpv3.t_invoice
        WHERE ($1::text IS NULL OR frekuensi = $1::text)
        GROUP BY frekuensi
        ORDER BY frekuensi
    "#;

    #[derive(sqlx::FromRow, serde::Serialize)]
    struct FrekStats {
        frekuensi: String,
        total_count: i64,
        total_jumlah: i64,
        total_dibayar: i64,
        count_lunas: i64,
        count_belum: i64,
        count_terlambat: i64,
        count_sebagian: i64,
    }

    let rows = match sqlx::query_as::<_, FrekStats>(sql)
        .bind(frekuensi)
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

#[get("/invoice/{invoice_id}")]
pub async fn get_invoice(
    state: web::Data<AppState>,
    path: web::Path<Uuid>,
) -> impl Responder {
    let invoice_id = path.into_inner();

    let sql = format!(
        "SELECT {} FROM sbpv3.t_invoice WHERE invoice_id = $1",
        INVOICE_COLS
    );

    let row = match sqlx::query_as::<_, Invoice>(&sql)
        .bind(invoice_id)
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
            "message": "Invoice tidak ditemukan"
        })),
    }
}

#[post("/invoice")]
pub async fn create_invoice(
    state: web::Data<AppState>,
    body: web::Json<CreateInvoiceRequest>,
) -> impl Responder {
    let b = body.into_inner();

    // ── Validasi ──
    if b.jenis_tagihan.trim().is_empty() {
        return bad_request("jenis_tagihan wajib diisi");
    }
    if b.nama_pemilik.trim().is_empty() {
        return bad_request("nama_pemilik wajib diisi");
    }
    if b.jumlah <= 0 {
        return bad_request("jumlah harus > 0");
    }
    if let Err(msg) = validate_text_enum(
        "frekuensi",
        &b.frekuensi,
        &["harian", "mingguan", "bulanan", "tahunan", "sekali"],
    ) {
        return bad_request(&msg);
    }
    let status = b.status.as_deref().unwrap_or("belum_bayar").trim().to_string();
    if let Err(msg) = validate_text_enum(
        "status",
        &status,
        &["belum_bayar", "lunas", "sebagian", "terlambat", "batal"],
    ) {
        return bad_request(&msg);
    }
    if let Some(ref rm) = b.reminder_metode {
        if let Err(msg) = validate_text_enum("reminder_metode", rm, &["whatsapp", "sms", "email"]) {
            return bad_request(&msg);
        }
    }

    // Auto-generate nomor_invoice jika tidak disediakan
    let nomor_invoice = match b.nomor_invoice {
        Some(ref n) if !n.trim().is_empty() => n.trim().to_string(),
        _ => match generate_nomor_invoice(&state.db).await {
            Ok(n) => n,
            Err(e) => {
                return HttpResponse::InternalServerError().json(json!({
                    "success": false,
                    "message": format!("Gagal generate nomor invoice: {}", e)
                }))
            }
        },
    };

    let now = Utc::now();
    let tanggal_dibuat = b.tanggal_dibuat.unwrap_or_else(|| Utc::now().date_naive());

    let inserted = match sqlx::query_as::<_, Invoice>(&format!(
        r#"
        INSERT INTO sbpv3.t_invoice (
            invoice_id, nomor_invoice,
            jenis_tagihan, nama_pemilik, deskripsi, frekuensi, periode,
            jumlah, jumlah_dibayar,
            tanggal_dibuat, jatuh_tempo,
            status,
            kontak_hp, kontak_email,
            nomor_id_meter,
            pemakaian, satuan_pemakaian, harga_satuan,
            reminder_aktif, reminder_metode, reminder_hari_before, reminder_berikutnya,
            catatan, created_at, updated_at
        )
        VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25
        )
        RETURNING {}
        "#,
        INVOICE_COLS
    ))
        .bind(b.invoice_id)                          // $1
        .bind(&nomor_invoice)                        // $2
        .bind(b.jenis_tagihan.trim().to_string())    // $3
        .bind(b.nama_pemilik.trim().to_string())     // $4
        .bind(opt_trim(b.deskripsi))                 // $5
        .bind(b.frekuensi.trim().to_string())        // $6
        .bind(opt_trim(b.periode))                   // $7
        .bind(b.jumlah)                              // $8
        .bind(b.jumlah_dibayar)                      // $9
        .bind(tanggal_dibuat)                        // $10
        .bind(b.jatuh_tempo)                         // $11
        .bind(&status)                               // $12
        .bind(opt_trim(b.kontak_hp))                 // $13
        .bind(opt_trim(b.kontak_email))              // $14
        .bind(opt_trim(b.nomor_id_meter))            // $15
        .bind(b.pemakaian)                           // $16
        .bind(opt_trim(b.satuan_pemakaian))          // $17
        .bind(b.harga_satuan)                        // $18
        .bind(b.reminder_aktif)                      // $19
        .bind(opt_trim(b.reminder_metode))           // $20
        .bind(opt_trim(b.reminder_hari_before))      // $21
        .bind(b.reminder_berikutnya)                 // $22
        .bind(opt_trim(b.catatan))                   // $23
        .bind(now)                                   // $24  created_at
        .bind(now)                                   // $25  updated_at
        .fetch_one(&state.db)
        .await
    {
        Ok(r) => r,
        Err(e) => {
            let msg = format!("{}", e).to_lowercase();
            if msg.contains("duplicate") {
                return bad_request("Nomor invoice sudah ada (duplicate)");
            }
            return HttpResponse::InternalServerError().json(json!({
                "success": false,
                "message": format!("DB error: {}", e)
            }));
        }
    };

    broadcast_invoice(&state.tx, "created", json!(inserted));
    HttpResponse::Created().json(json!({
        "success": true,
        "data": inserted
    }))
}

#[put("/invoice/{invoice_id}")]
pub async fn update_invoice(
    state: web::Data<AppState>,
    path: web::Path<Uuid>,
    body: web::Json<UpdateInvoiceRequest>,
) -> impl Responder {
    let invoice_id = path.into_inner();
    let b = body.into_inner();

    // Fetch existing
    let sql = format!(
        "SELECT {} FROM sbpv3.t_invoice WHERE invoice_id = $1",
        INVOICE_COLS
    );
    let existing = match sqlx::query_as::<_, Invoice>(&sql)
        .bind(invoice_id)
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
                "message": "Invoice tidak ditemukan"
            }))
        }
    };

    // Merge patch
    if let Some(v) = b.jenis_tagihan { row.jenis_tagihan = v; }
    if let Some(v) = b.nama_pemilik { row.nama_pemilik = v; }
    if let Some(v) = b.deskripsi { row.deskripsi = v; }
    if let Some(v) = b.frekuensi { row.frekuensi = v; }
    if let Some(v) = b.periode { row.periode = v; }
    if let Some(v) = b.jumlah { row.jumlah = v; }
    if let Some(v) = b.jumlah_dibayar { row.jumlah_dibayar = v; }
    if let Some(v) = b.tanggal_dibuat { row.tanggal_dibuat = v; }
    if let Some(v) = b.jatuh_tempo { row.jatuh_tempo = v; }
    if let Some(v) = b.status { row.status = v; }
    if let Some(v) = b.kontak_hp { row.kontak_hp = v; }
    if let Some(v) = b.kontak_email { row.kontak_email = v; }
    if let Some(v) = b.nomor_id_meter { row.nomor_id_meter = v; }
    if let Some(v) = b.pemakaian { row.pemakaian = v; }
    if let Some(v) = b.satuan_pemakaian { row.satuan_pemakaian = v; }
    if let Some(v) = b.harga_satuan { row.harga_satuan = v; }
    if let Some(v) = b.reminder_aktif { row.reminder_aktif = v; }
    if let Some(v) = b.reminder_metode { row.reminder_metode = v; }
    if let Some(v) = b.reminder_hari_before { row.reminder_hari_before = v; }
    if let Some(v) = b.reminder_berikutnya { row.reminder_berikutnya = v; }
    if let Some(v) = b.catatan { row.catatan = v; }

    // ── Validate after merge ──
    if row.jumlah <= 0 {
        return bad_request("jumlah harus > 0");
    }
    if let Err(msg) = validate_text_enum(
        "frekuensi",
        &row.frekuensi,
        &["harian", "mingguan", "bulanan", "tahunan", "sekali"],
    ) {
        return bad_request(&msg);
    }
    if let Err(msg) = validate_text_enum(
        "status",
        &row.status,
        &["belum_bayar", "lunas", "sebagian", "terlambat", "batal"],
    ) {
        return bad_request(&msg);
    }
    if let Some(ref rm) = row.reminder_metode {
        if let Err(msg) = validate_text_enum("reminder_metode", rm, &["whatsapp", "sms", "email"]) {
            return bad_request(&msg);
        }
    }

    let now = Utc::now();

    let updated = match sqlx::query_as::<_, Invoice>(&format!(
        r#"
        UPDATE sbpv3.t_invoice
        SET
            jenis_tagihan = $2,
            nama_pemilik = $3,
            deskripsi = $4,
            frekuensi = $5,
            periode = $6,
            jumlah = $7,
            jumlah_dibayar = $8,
            tanggal_dibuat = $9,
            jatuh_tempo = $10,
            status = $11,
            kontak_hp = $12,
            kontak_email = $13,
            nomor_id_meter = $14,
            pemakaian = $15,
            satuan_pemakaian = $16,
            harga_satuan = $17,
            reminder_aktif = $18,
            reminder_metode = $19,
            reminder_hari_before = $20,
            reminder_berikutnya = $21,
            catatan = $22,
            updated_at = $23
        WHERE invoice_id = $1
        RETURNING {}
        "#,
        INVOICE_COLS
    ))
        .bind(invoice_id)
        .bind(row.jenis_tagihan.trim().to_string())
        .bind(row.nama_pemilik.trim().to_string())
        .bind(opt_trim(row.deskripsi.clone()))
        .bind(row.frekuensi.trim().to_string())
        .bind(opt_trim(row.periode.clone()))
        .bind(row.jumlah)
        .bind(row.jumlah_dibayar)
        .bind(row.tanggal_dibuat)
        .bind(row.jatuh_tempo)
        .bind(row.status.trim().to_string())
        .bind(opt_trim(row.kontak_hp.clone()))
        .bind(opt_trim(row.kontak_email.clone()))
        .bind(opt_trim(row.nomor_id_meter.clone()))
        .bind(row.pemakaian)
        .bind(opt_trim(row.satuan_pemakaian.clone()))
        .bind(row.harga_satuan)
        .bind(row.reminder_aktif)
        .bind(opt_trim(row.reminder_metode.clone()))
        .bind(opt_trim(row.reminder_hari_before.clone()))
        .bind(row.reminder_berikutnya)
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

    broadcast_invoice(&state.tx, "updated", json!(updated));
    ok_data(updated)
}

#[delete("/invoice/{invoice_id}")]
pub async fn delete_invoice(
    state: web::Data<AppState>,
    path: web::Path<Uuid>,
) -> impl Responder {
    let invoice_id = path.into_inner();

    let sql = format!(
        "DELETE FROM sbpv3.t_invoice WHERE invoice_id = $1 RETURNING {}",
        INVOICE_COLS
    );

    let deleted = match sqlx::query_as::<_, Invoice>(&sql)
        .bind(invoice_id)
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
            broadcast_invoice(
                &state.tx,
                "deleted",
                json!({ "invoice_id": r.invoice_id }),
            );
            ok_data(r)
        }
        None => HttpResponse::NotFound().json(json!({
            "success": false,
            "message": "Invoice tidak ditemukan"
        })),
    }
}

/* ===========================
   WS: /ws/invoice
   =========================== */

const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(5);
const CLIENT_TIMEOUT: Duration = Duration::from_secs(30);

pub struct InvoiceWs {
    hb: Instant,
    rx: broadcast::Receiver<String>,
}

impl InvoiceWs {
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

impl Actor for InvoiceWs {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        self.start_heartbeat(ctx);
        let stream = BroadcastStream::new(self.rx.resubscribe());
        ctx.add_stream(stream);
    }
}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for InvoiceWs {
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

impl StreamHandler<Result<String, BroadcastStreamRecvError>> for InvoiceWs {
    fn handle(
        &mut self,
        item: Result<String, BroadcastStreamRecvError>,
        ctx: &mut Self::Context,
    ) {
        if let Ok(text) = item {
            let should_send = match serde_json::from_str::<serde_json::Value>(&text) {
                Ok(v) => v.get("tipe").and_then(|x| x.as_str()) == Some("invoice"),
                Err(_) => false,
            };
            if should_send {
                ctx.text(text);
            }
        }
    }
}

#[get("/ws/invoice")]
pub async fn ws_invoice_handler(
    req: HttpRequest,
    stream: web::Payload,
    state: web::Data<AppState>,
) -> Result<HttpResponse, Error> {
    let rx = state.tx.subscribe();
    ws::start(InvoiceWs::new(rx), &req, stream)
}