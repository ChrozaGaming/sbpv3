mod db;
mod error;
mod models;
mod routes;
mod state;

use crate::state::AppState;

use actix_cors::Cors;
use actix_web::{
    http,
    middleware::{Logger, NormalizePath},
    web, App, HttpResponse, HttpServer,
};
use std::{env, sync::Arc};
use tokio::sync::broadcast;

fn env_or(key: &str, fallback: &str) -> String {
    env::var(key).unwrap_or_else(|_| fallback.to_string())
}

/// FRONTEND_ORIGIN bisa:
/// - satu origin: "http://localhost:3000"
/// - multiple (pisah koma): "http://localhost:3000,https://app.example.com"
fn parse_frontend_origins() -> Arc<Vec<String>> {
    let raw = env_or("FRONTEND_ORIGIN", "http://localhost:3000");
    let origins = raw
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>();
    Arc::new(origins)
}

fn build_cors(allowed_origins: Arc<Vec<String>>) -> Cors {
    Cors::default()
        .allowed_origin_fn(move |origin, _req_head| {
            let o = origin.to_str().unwrap_or("");
            allowed_origins.iter().any(|x| x == o)
        })
        .allowed_methods(vec!["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
        .allowed_headers(vec![
            http::header::AUTHORIZATION,
            http::header::CONTENT_TYPE,
            http::header::ACCEPT,
            http::header::ORIGIN,
        ])
        .supports_credentials()
        .max_age(3600)
}

/// Kelompokkan service API biar main.rs gak “panjang banget”
/// Catatan: semua route di routes::* harus TANPA prefix "/api"
fn config_api(cfg: &mut web::ServiceConfig) {
    cfg
        // Auth
        .service(routes::auth::register_user)
        .service(routes::auth::login_user)
        // Master Pegawai
        .service(routes::masterpegawai::list_masterpegawai)
        .service(routes::masterpegawai::get_masterpegawai)
        .service(routes::masterpegawai::get_masterpegawai_by_nik)
        .service(routes::masterpegawai::create_masterpegawai)
        .service(routes::masterpegawai::update_masterpegawai)
        .service(routes::masterpegawai::delete_masterpegawai)
        // Kontrak Kerja
        .service(routes::kontrak_kerja::list_kontrak_kerja)
        .service(routes::kontrak_kerja::get_kontrak_kerja)
        .service(routes::kontrak_kerja::create_kontrak_kerja)
        .service(routes::kontrak_kerja::update_kontrak_kerja)
        .service(routes::kontrak_kerja::delete_kontrak_kerja)
        // Product
        .service(routes::product::list_products)
        .service(routes::product::get_product)
        .service(routes::product::get_product_by_kode)
        .service(routes::product::search_product)
        .service(routes::product::create_product)
        .service(routes::product::update_product)
        .service(routes::product::delete_product)
        // Stok
        .service(routes::stok::list_stok)
        .service(routes::stok::get_stok)
        .service(routes::stok::create_stok)
        .service(routes::stok::update_stok)
        .service(routes::stok::delete_stok)
        .service(routes::stok::list_low_stok)
        .service(routes::stok::list_recent_movements)
        .service(routes::stok::create_movement)
        .service(routes::stok::batch_stock_in)
        // Satuan
        .service(routes::satuan::list_satuan)
        .service(routes::satuan::get_satuan)
        .service(routes::satuan::create_satuan)
        .service(routes::satuan::update_satuan)
        .service(routes::satuan::delete_satuan)
        // Surat Jalan
        .service(routes::suratjalan::list_surat_jalan)
        .service(routes::suratjalan::get_surat_jalan)
        .service(routes::suratjalan::create_surat_jalan)
        .service(routes::suratjalan::delete_surat_jalan)
        // Retur
        .service(routes::retur::create_retur)
        // Absensi
        .service(routes::absensi::list_absensi)
        .service(routes::absensi::create_absensi);
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenvy::dotenv().ok();

    if env::var("RUST_LOG").is_err() {
        env::set_var("RUST_LOG", "info,actix_web=info");
    }
    env_logger::init();

    let pool = db::connect().await.expect("DB connection error");

    // Broadcast untuk WS
    let (tx, _rx) = broadcast::channel::<String>(200);

    let bind_addr = env_or("BIND_ADDR", "0.0.0.0:8080");
    let origins = parse_frontend_origins();

    let host_for_print = bind_addr.replace("0.0.0.0", "localhost");

    println!("🚀 SBPApp v3 Backend running on http://{bind_addr}");
    println!("🌐 FRONTEND_ORIGIN(s) = {}", origins.join(", "));
    println!("🔌 WS MasterPegawai   = ws://{}/ws/pegawai", host_for_print);
    println!("🔌 WS KontrakKerja    = ws://{}/ws/kontrakkerja", host_for_print);
    println!("🔌 WS Absensi         = ws://{}/ws/absensi", host_for_print);

    let app_state = web::Data::new(AppState {
        db: pool.clone(),
        tx: tx.clone(),
    });

    HttpServer::new(move || {
        let cors = build_cors(origins.clone());

        App::new()
            .wrap(NormalizePath::trim())
            .wrap(Logger::default())
            .wrap(cors)
            .app_data(app_state.clone())
            .app_data(web::JsonConfig::default().limit(4 * 1024 * 1024))
            .route(
                "/",
                web::get().to(|| async {
                    HttpResponse::Ok().json(serde_json::json!({
                        "success": true,
                        "service": "sbpappv3-backend",
                        "status": "ok"
                    }))
                }),
            )
            .service(web::scope("/api").configure(config_api))
            // WEBSOCKET
            .service(routes::masterpegawai::ws_masterpegawai_handler)
            .service(routes::kontrak_kerja::ws_kontrak_kerja_handler)
            .service(routes::absensi::absensi_ws_handler)
    })
        .bind(bind_addr)?
        .run()
        .await
}
