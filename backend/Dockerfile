# Platio Backend - Cloud Run Deployment
# Multi-stage build for smaller production image
FROM python:3.13-slim AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir --target=/app/libs -r requirements.txt

# Production stage
FROM python:3.13-slim AS production

# Create non-root user
RUN useradd -m -u 1000 appuser

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /app/libs ./libs

# Copy application code
COPY . .

# Create data directories
RUN mkdir -p /app/data /app/data/receipts && chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Environment variables
ENV PYTHONPATH=/app/libs
ENV PLATIO_DATA_DIR=/app/data
ENV PYTHONUNBUFFERED=1

# Cloud Run sets PORT env var (default 8080)
EXPOSE 8080

# Use gunicorn for production (better than uvicorn --reload)
CMD exec gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 0 app:app