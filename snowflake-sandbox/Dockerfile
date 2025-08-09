FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl \
        gcc \
        g++ \
        && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY src/ ./src/
COPY config/ ./config/

# Create non-root user
RUN useradd -m -u 1000 snowflake && \
    chown -R snowflake:snowflake /app
USER snowflake

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:5432/health || exit 1

# Set Python path
ENV PYTHONPATH="/app"

# Expose port
EXPOSE 5432

# Run the application
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "5432"]