FROM python:3.11-slim
ARG APP_VERSION=dev
LABEL org.opencontainers.image.title="conteo-api" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.source="local"
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN apt-get update && apt-get install -y --no-install-recommends build-essential curl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ /app/
EXPOSE 8000
CMD ["uvicorn","app:app","--host","0.0.0.0","--port","8000"]
