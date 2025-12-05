use actix::{Actor, StreamHandler, AsyncContext, ActorContext};
use actix_web::{get, web, Error, HttpRequest, HttpResponse};
use actix_web_actors::ws;
use std::time::{Duration, Instant};
use tokio::sync::broadcast;

use crate::state::AppState;

const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(5);
const CLIENT_TIMEOUT: Duration = Duration::from_secs(30);

pub struct WsSession {
    hb: Instant,
    rx: broadcast::Receiver<String>,
}

impl WsSession {
    pub fn new(rx: broadcast::Receiver<String>) -> Self {
        Self {
            hb: Instant::now(),
            rx,
        }
    }

    fn start_loop(&self, ctx: &mut ws::WebsocketContext<Self>) {
        // 1 loop: heartbeat + drain broadcast channel
        ctx.run_interval(HEARTBEAT_INTERVAL, |act, ctx| {
            // --- HEARTBEAT ---
            if Instant::now().duration_since(act.hb) > CLIENT_TIMEOUT {
                ctx.stop();
                return;
            }
            ctx.ping(b"hb");

            // --- DRAIN BROADCAST MESSAGES ---
            loop {
                use tokio::sync::broadcast::error::TryRecvError;

                match act.rx.try_recv() {
                    Ok(msg) => {
                        // Kirim ke client (Next.js akan menerima sebagai string JSON)
                        ctx.text(msg);
                    }
                    Err(TryRecvError::Empty) => {
                        // Tidak ada pesan baru → keluar loop
                        break;
                    }
                    Err(TryRecvError::Lagged(_)) => {
                        // Ada pesan yang ter-skip; lanjut drain lagi
                        continue;
                    }
                    Err(TryRecvError::Closed) => {
                        // Channel ditutup → hentikan WS
                        ctx.stop();
                        break;
                    }
                }
            }
        });
    }
}

impl Actor for WsSession {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        self.start_loop(ctx);
        ctx.text("CONNECTED: Warehouse WS ready");
    }
}

// pesan dari browser (client)
impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for WsSession {
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
                if text == "ping" {
                    ctx.text("pong");
                } else {
                    ctx.text(format!("Echo: {}", text));
                }
            }
            Ok(ws::Message::Binary(bin)) => {
                ctx.binary(bin);
            }
            Ok(ws::Message::Close(reason)) => {
                ctx.close(reason);
                ctx.stop();
            }
            _ => (),
        }
    }
}

#[get("/ws")]
pub async fn ws_handler(
    req: HttpRequest,
    stream: web::Payload,
    state: web::Data<AppState>,
) -> Result<HttpResponse, Error> {
    let rx = state.tx.subscribe();
    let resp = ws::start(WsSession::new(rx), &req, stream)?;
    Ok(resp)
}
