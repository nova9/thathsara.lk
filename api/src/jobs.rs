use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use uuid::Uuid;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Job {
    pub id: String,
    pub url: String,
    pub status: String,
    pub error: Option<String>,
    pub output_path: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct EnqueueRequest {
    pub url: String,
}

pub async fn enqueue(pool: &SqlitePool, url: &str) -> sqlx::Result<Job> {
    let id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO jobs (id, url) VALUES (?, ?)"
    )
    .bind(&id)
    .bind(url)
    .execute(pool)
    .await?;

    fetch(pool, &id).await
}

pub async fn fetch(pool: &SqlitePool, id: &str) -> sqlx::Result<Job> {
    sqlx::query_as::<_, Job>("SELECT * FROM jobs WHERE id = ?")
        .bind(id)
        .fetch_one(pool)
        .await
}

pub async fn list(pool: &SqlitePool) -> sqlx::Result<Vec<Job>> {
    sqlx::query_as::<_, Job>("SELECT * FROM jobs ORDER BY created_at DESC")
        .fetch_all(pool)
        .await
}

pub async fn claim_pending(pool: &SqlitePool) -> sqlx::Result<Option<Job>> {
    let job = sqlx::query_as::<_, Job>(
        "SELECT * FROM jobs WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1"
    )
    .fetch_optional(pool)
    .await?;

    if let Some(ref j) = job {
        sqlx::query(
            "UPDATE jobs SET status = 'running', updated_at = datetime('now') WHERE id = ?"
        )
        .bind(&j.id)
        .execute(pool)
        .await?;
    }

    Ok(job)
}

pub async fn mark_done(pool: &SqlitePool, id: &str, output_path: &str) -> sqlx::Result<()> {
    sqlx::query(
        "UPDATE jobs SET status = 'done', output_path = ?, updated_at = datetime('now') WHERE id = ?"
    )
    .bind(output_path)
    .bind(id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn mark_failed(pool: &SqlitePool, id: &str, error: &str) -> sqlx::Result<()> {
    sqlx::query(
        "UPDATE jobs SET status = 'failed', error = ?, updated_at = datetime('now') WHERE id = ?"
    )
    .bind(error)
    .bind(id)
    .execute(pool)
    .await?;
    Ok(())
}
