# Platio Backend - Render Deployment
# Single-stage build (simpler and more reliable)
FROM python:3.13-slim

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 1000 appuser

WORKDIR /app

# Copy requirements and install globally
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY backend/ .

# Create data directories
RUN mkdir -p /app/data /app/data/receipts && chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Environment variables
ENV PLATIO_DATA_DIR=/app/data
ENV PYTHONUNBUFFERED=1

# Render sets PORT env var (default 10000)
EXPOSE 10000

# Use gunicorn for production
CMD exec gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 0 app:app