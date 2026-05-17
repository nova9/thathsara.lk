use sqlx::SqlitePool;
use tokio::time::{Duration, sleep};
use tracing::{error, info};

use crate::jobs;

pub async fn run(pool: SqlitePool) {
    let download_dir = std::env::var("DOWNLOAD_DIR").unwrap_or_else(|_| "downloads".into());
    std::fs::create_dir_all(&download_dir).expect("failed to create download dir");

    loop {
        match jobs::claim_pending(&pool).await {
            Ok(Some(job)) => {
                info!(id = %job.id, url = %job.url, "starting download");

                let output_template = format!("{}/{}.%(ext)s", download_dir, job.id);

                let result = tokio::process::Command::new("yt-dlp")
                    .arg("--no-playlist")
                    .arg("--output").arg(&output_template)
                    .arg("--print").arg("after_move:filepath")
                    .arg(&job.url)
                    .output()
                    .await;

                match result {
                    Ok(out) if out.status.success() => {
                        let path = String::from_utf8_lossy(&out.stdout).trim().to_string();
                        info!(id = %job.id, path = %path, "download complete");
                        if let Err(e) = jobs::mark_done(&pool, &job.id, &path).await {
                            error!(id = %job.id, err = %e, "failed to mark job done");
                        }
                    }
                    Ok(out) => {
                        let stderr = String::from_utf8_lossy(&out.stderr).to_string();
                        error!(id = %job.id, err = %stderr, "yt-dlp failed");
                        if let Err(e) = jobs::mark_failed(&pool, &job.id, &stderr).await {
                            error!(id = %job.id, err = %e, "failed to mark job failed");
                        }
                    }
                    Err(e) => {
                        error!(id = %job.id, err = %e, "failed to spawn yt-dlp");
                        if let Err(db_err) = jobs::mark_failed(&pool, &job.id, &e.to_string()).await {
                            error!(id = %job.id, err = %db_err, "failed to mark job failed");
                        }
                    }
                }
            }
            Ok(None) => {
                sleep(Duration::from_secs(5)).await;
            }
            Err(e) => {
                error!(err = %e, "failed to poll queue");
                sleep(Duration::from_secs(5)).await;
            }
        }
    }
}
