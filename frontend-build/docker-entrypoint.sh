#!/bin/sh
set -e

# Dar permisos al socket de Docker si existe
if [ -S /var/run/docker.sock ]; then
    echo "Configurando permisos del socket de Docker..."
    # Cambiar permisos del socket para que cualquier usuario pueda acceder
    chmod 666 /var/run/docker.sock 2>/dev/null || true
    # También cambiar el propietario para asegurar acceso
    chown nextjs:nodejs /var/run/docker.sock 2>/dev/null || true
    echo "✓ Permisos del socket configurados"
fi

# Mantener permisos del socket en segundo plano
(
    while true; do
        sleep 30
        if [ -S /var/run/docker.sock ]; then
            chmod 666 /var/run/docker.sock 2>/dev/null || true
        fi
    done
) &

# Ejecutar el comando principal como usuario nextjs
exec su-exec nextjs "$@"
