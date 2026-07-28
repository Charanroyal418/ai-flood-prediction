# FloodSense AI Backend — Multi-Stage Dockerfile
# ================================================
# Stage 1: Builder — installs all deps
# Stage 2: Production — minimal runtime image

# ── Stage 1: Build ───────────────────────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /build

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (leverages Docker layer cache)
COPY requirements.txt .

# Install Python dependencies into /build/wheels for copying to final stage
RUN pip install --upgrade pip && \
    pip install --no-cache-dir --prefix=/install -r requirements.txt


# ── Stage 2: Production Runtime ──────────────────────────────────────────────
FROM python:3.11-slim AS production

# Security: run as non-root user
RUN useradd -m -s /bin/bash -u 1001 floodsense

WORKDIR /app

# Install only runtime system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy installed Python packages from builder
COPY --from=builder /install /usr/local

# Copy application code
COPY --chown=floodsense:floodsense . .

# Create necessary directories
RUN mkdir -p /app/app/ml/models /app/data && \
    chown -R floodsense:floodsense /app

# Switch to non-root user
USER floodsense

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/health || exit 1

# Start with Gunicorn + Uvicorn workers for production
CMD ["gunicorn", "app.main:app", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--workers", "2", \
     "--bind", "0.0.0.0:8000", \
     "--timeout", "120", \
     "--keep-alive", "5", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "--log-level", "info"]
