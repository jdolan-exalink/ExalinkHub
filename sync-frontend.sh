#!/bin/bash

echo "========================================"
echo "   SINCRONIZACIÓN DE CÓDIGO FUENTE"
echo "========================================"
echo

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Función para imprimir mensajes coloreados
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar que estamos en el directorio correcto
if [ ! -d "src" ]; then
    print_error "Directorio 'src' no encontrado. Ejecuta este script desde la raíz del proyecto."
    exit 1
fi

if [ ! -d "frontend-build" ]; then
    print_error "Directorio 'frontend-build' no encontrado."
    exit 1
fi

print_status "Sincronizando código fuente..."

# Sincronizar directorio src/
if command -v rsync &> /dev/null; then
    print_status "Usando rsync para sincronización..."
    rsync -av --delete src/ frontend-build/src/
else
    print_status "Usando cp para sincronización..."
    rm -rf frontend-build/src/*
    cp -r src/* frontend-build/src/
fi

# Sincronizar archivos de configuración importantes
print_status "Sincronizando archivos de configuración..."

# Lista de archivos a sincronizar
files_to_sync=(
    "package.json"
    "package-lock.json"
    "next.config.ts"
    "next-intl.config.mjs"
    "tailwind.config.ts"
    "postcss.config.mjs"
    "tsconfig.json"
    "middleware.ts"
    "i18n.ts"
    "components.json"
)

for file in "${files_to_sync[@]}"; do
    if [ -f "$file" ]; then
        cp "$file" "frontend-build/$file"
        print_status "Copiado: $file"
    else
        print_warning "Archivo no encontrado: $file"
    fi
done

# Sincronizar directorios adicionales
dirs_to_sync=(
    "messages"
    "public"
)

for dir in "${dirs_to_sync[@]}"; do
    if [ -d "$dir" ]; then
        if command -v rsync &> /dev/null; then
            rsync -av --delete "$dir/" "frontend-build/$dir/"
        else
            rm -rf "frontend-build/$dir"
            cp -r "$dir" "frontend-build/"
        fi
        print_status "Sincronizado: $dir/"
    else
        print_warning "Directorio no encontrado: $dir"
    fi
done

print_status "Sincronización completada exitosamente ✓"

echo
echo "========================================"
echo "   LISTO PARA DESPLIEGUE"
echo "========================================"
echo