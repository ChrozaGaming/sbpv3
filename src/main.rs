// src/main.rs
mod db;
mod error;
mod models;
mod routes;
mod state;

use crate::state::AppState;
use actix_cors::Cors;
use actix_web::middleware::Logger;
use actix_web::{web, App, HttpServer};
use tokio::sync::broadcast;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenvy::dotenv().ok();
    env_logger::init();

    let pool = db::connect().await.expect("DB connection error");

    // channel global untuk WebSocket
    let (tx, _rx) = broadcast::channel::<String>(100);

    println!("🚀 SBPApp v3 Backend running on 0.0.0.0:8080");

    HttpServer::new(move || {
        let cors = Cors::permissive();

        App::new()
            .wrap(cors)
            .wrap(Logger::default())
            .app_data(web::Data::new(AppState {
                db: pool.clone(),
                tx: tx.clone(),
            }))
            // API scope
            .service(
                web::scope("/api")
                    // 🔐 AUTH
                    .service(routes::auth::register_user)
                    .service(routes::auth::login_user)
                    // PRODUCT MASTER
                    .service(routes::product::list_products)
                    .service(routes::product::get_product)
                    .service(routes::product::get_product_by_kode)
                    .service(routes::product::search_product)
                    .service(routes::product::create_product)
                    .service(routes::product::update_product)
                    .service(routes::product::delete_product)
                    // STOK
                    .service(routes::stok::list_stok)
                    .service(routes::stok::get_stok)
                    .service(routes::stok::create_stok)
                    .service(routes::stok::update_stok)
                    .service(routes::stok::delete_stok)
                    .service(routes::stok::list_low_stok)
                    .service(routes::stok::list_recent_movements)
                    .service(routes::stok::create_movement)
                    .service(routes::stok::batch_stock_in)
                    // SATUAN
                    .service(routes::satuan::list_satuan)
                    .service(routes::satuan::get_satuan)
                    .service(routes::satuan::create_satuan)
                    .service(routes::satuan::update_satuan)
                    .service(routes::satuan::delete_satuan)
                    // SURAT JALAN
                    .service(routes::surat_jalan::list_surat_jalan)
                    .service(routes::surat_jalan::get_surat_jalan)
                    .service(routes::surat_jalan::create_surat_jalan)
                    .service(routes::surat_jalan::update_surat_jalan)
                    .service(routes::surat_jalan::delete_surat_jalan)
                    .service(routes::surat_jalan::list_surat_jalan_items)
                    .service(routes::surat_jalan::create_surat_jalan_item)
                    .service(routes::surat_jalan::get_surat_jalan_item)
                    .service(routes::surat_jalan::update_surat_jalan_item)
                    .service(routes::surat_jalan::delete_surat_jalan_item)
                    // RETUR
                    .service(routes::retur::create_retur),
            )
            // WebSocket global (untuk dashboard frontend)
            .service(routes::ws::ws_handler)
    })
    .bind(("0.0.0.0", 8080))?
    .run()
    .await
}
