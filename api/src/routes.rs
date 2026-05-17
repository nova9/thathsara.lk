use axum::{
    Router,
    body::Body,
    extract::{Json, Path, State},
    http::{StatusCode, header},
    response::Response,
    routing::get,
};
use serde::Serialize;
use sqlx::SqlitePool;
use tokio::fs::File;
use tokio_util::io::ReaderStream;

use crate::jobs::{self, EnqueueRequest, Job};

#[derive(Serialize)]
struct Health {
    status: &'static str,
}

async fn health() -> Json<Health> {
    Json(Health { status: "ok" })
}

async fn enqueue(
    State(pool): State<SqlitePool>,
    Json(body): Json<EnqueueRequest>,
) -> Result<(StatusCode, Json<Job>), (StatusCode, String)> {
    jobs::enqueue(&pool, &body.url)
        .await
        .map(|job| (StatusCode::CREATED, Json(job)))
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

async fn list_jobs(State(pool): State<SqlitePool>) -> Result<Json<Vec<Job>>, (StatusCode, String)> {
    jobs::list(&pool)
        .await
        .map(Json)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

async fn get_job(
    State(pool): State<SqlitePool>,
    Path(id): Path<String>,
) -> Result<Json<Job>, (StatusCode, String)> {
    jobs::fetch(&pool, &id).await.map(Json).map_err(|e| match e {
        sqlx::Error::RowNotFound => (StatusCode::NOT_FOUND, format!("job {id} not found")),
        e => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    })
}

async fn download_job(
    State(pool): State<SqlitePool>,
    Path(id): Path<String>,
) -> Result<Response, (StatusCode, String)> {
    let job = jobs::fetch(&pool, &id).await.map_err(|e| match e {
        sqlx::Error::RowNotFound => (StatusCode::NOT_FOUND, format!("job {id} not found")),
        e => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    })?;

    let path = job.output_path.ok_or((
        StatusCode::NOT_FOUND,
        "file not ready yet".to_string(),
    ))?;

    let filename = std::path::Path::new(&path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("download")
        .to_string();

    let file = File::open(&path).await.map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
    })?;

    let stream = ReaderStream::new(file);
    let body = Body::from_stream(stream);

    Ok(Response::builder()
        .header(header::CONTENT_TYPE, "application/octet-stream")
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{filename}\""),
        )
        .body(body)
        .unwrap())
}

pub fn router() -> Router<SqlitePool> {
    let api = Router::new()
        .route("/health", get(health))
        .route("/jobs", get(list_jobs).post(enqueue))
        .route("/jobs/{id}", get(get_job))
        .route("/jobs/{id}/download", get(download_job));

    Router::new().nest("/api", api)
}
