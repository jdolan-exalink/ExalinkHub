# Dockerfile para backend de Conteo
# Imagen base ligera de Python
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1
ENV APP_HOME=/app

WORKDIR $APP_HOME

# Dependencias del sistema (si se necesitan librerías para opencv u otras en el futuro)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copiar requirements
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código
COPY app ./app
COPY start.py ./

# Crear directorio de configuración
RUN mkdir -p config

EXPOSE 8012

HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD curl -f http://localhost:8012/health || exit 1

CMD ["python", "start.py"]
