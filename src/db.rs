use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;

pub async fn connect() -> Result<PgPool, sqlx::Error> {
    let db_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL belum diset di .env");

    PgPoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await
}
