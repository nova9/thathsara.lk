FROM rust:1.95-slim AS builder
WORKDIR /app
COPY api/ .
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y \
    yt-dlp \
    ffmpeg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/target/release/api .
EXPOSE 8080
CMD ["./api"]
