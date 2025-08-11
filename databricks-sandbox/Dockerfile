FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl \
        gcc \
        g++ \
        default-jdk \
        && \
    rm -rf /var/lib/apt/lists/*

# Set Java environment
ENV JAVA_HOME=/usr/lib/jvm/default-java
ENV PATH=$PATH:$JAVA_HOME/bin

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download Spark JAR dependencies
RUN mkdir -p /app/jars && \
    curl -L -o /app/jars/delta-core_2.12-2.4.0.jar https://repo1.maven.org/maven2/io/delta/delta-core_2.12/2.4.0/delta-core_2.12-2.4.0.jar && \
    curl -L -o /app/jars/delta-spark_2.12-2.4.0.jar https://repo1.maven.org/maven2/io/delta/delta-spark_2.12/2.4.0/delta-spark_2.12-2.4.0.jar && \
    curl -L -o /app/jars/iceberg-spark-runtime-3.5_2.12-1.4.2.jar https://repo1.maven.org/maven2/org/apache/iceberg/iceberg-spark-runtime-3.5_2.12/1.4.2/iceberg-spark-runtime-3.5_2.12-1.4.2.jar && \
    curl -L -o /app/jars/hadoop-aws-3.3.4.jar https://repo1.maven.org/maven2/org/apache/hadoop/hadoop-aws/3.3.4/hadoop-aws-3.3.4.jar

# Copy application code
COPY src/ ./src/
COPY config/ ./config/

# Create non-root user
RUN useradd -m -u 1000 databricks && \
    chown -R databricks:databricks /app
USER databricks

# Set Python path
ENV PYTHONPATH="/app"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:5434/health || exit 1

# Expose ports
EXPOSE 5434

# Run the application
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "5434"]