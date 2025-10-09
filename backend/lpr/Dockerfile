# Dockerfile para Sistema LPR Backend
#
# IMPORTANTE: Construye la imagen desde la raíz del proyecto (ExalinkHub) para que el contexto incluya docker-entrypoint.sh y todos los archivos necesarios.
# Imagen base optimizada con Python 3.11
FROM python:3.11-slim

# Metadatos del contenedor
LABEL maintainer="ExalinkHub Team"
LABEL description="Backend LPR - Sistema de Reconocimiento de Matrículas"
LABEL version="1.0.0"

# Variables de entorno para Python
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Crear usuario no-root para seguridad
RUN groupadd --gid 1000 lpr && \
    useradd --uid 1000 --gid 1000 --create-home --shell /bin/bash lpr

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y \
    --no-install-recommends \
    curl \
    gcc \
    libc6-dev \
    bash \
    && rm -rf /var/lib/apt/lists/*

# Establecer directorio de trabajo
WORKDIR /app

# Copiar requirements primero (para cache de Docker layers)
COPY requirements.txt ./

# Instalar dependencias Python
RUN pip install --no-cache-dir -r requirements.txt

# Copiar script de inicialización
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Copiar código fuente
COPY app/ ./app/
COPY start.py ./

# Crear directorios necesarios y configurar permisos
RUN mkdir -p data logs DB config

# Cambiar a usuario no-root (comentado para Windows)
# USER lpr

# Exponer puerto
EXPOSE 2221

# Health check para Docker
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:2221/health || exit 1

# Variables de entorno por defecto
ENV LPR_HOST=0.0.0.0
ENV LPR_PORT=2221
ENV LPR_DEBUG=false
ENV DATABASE_URL=sqlite:///./DB/matriculas.db
ENV DATABASE_PATH=./DB/matriculas.db

# Punto de entrada con inicialización
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# Comando por defecto
CMD ["python", "start.py", "--host", "0.0.0.0", "--port", "2221"]