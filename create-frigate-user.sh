#!/bin/bash

# Script para crear usuario SSH 'frigate' en servidor Frigate
# Ejecutar como root o con sudo en el servidor Frigate

echo "🛠️ Creando usuario 'frigate' para pruebas SSH..."
echo "==============================================="

# Verificar si estamos ejecutando como root
if [[ $EUID -ne 0 ]]; then
   echo "❌ Este script debe ejecutarse como root o con sudo"
   exit 1
fi

# Crear el usuario
echo "👤 Creando usuario 'frigate'..."
useradd -m -s /bin/bash frigate

# Establecer contraseña
echo "🔑 Estableciendo contraseña..."
echo "frigate:frigate123" | chpasswd

# Agregar al grupo sudo (opcional, para acceso administrativo)
echo "🔧 Agregando a grupos necesarios..."
usermod -aG sudo frigate

# Crear directorio SSH si no existe
echo "📁 Configurando directorio SSH..."
mkdir -p /home/frigate/.ssh
chmod 700 /home/frigate/.ssh
chown frigate:frigate /home/frigate/.ssh

# Crear directorio para crops LPR
echo "📂 Creando directorio para crops LPR..."
mkdir -p /media/frigate/clips/lpr
chown -R frigate:frigate /media/frigate/clips
chmod -R 755 /media/frigate/clips

# Configurar sudo sin contraseña para operaciones específicas (opcional)
echo "⚙️ Configurando sudoers..."
echo "frigate ALL=(ALL) NOPASSWD: /bin/ls, /usr/bin/find, /usr/bin/stat" >> /etc/sudoers.d/frigate
chmod 0440 /etc/sudoers.d/frigate

# Verificar que el usuario se creó correctamente
echo "✅ Verificando creación del usuario..."
id frigate

echo ""
echo "🎉 Usuario 'frigate' creado exitosamente!"
echo ""
echo "📋 Resumen:"
echo "   Usuario: frigate"
echo "   Contraseña: frigate123"
echo "   Home: /home/frigate"
echo "   Directorio LPR: /media/frigate/clips/lpr"
echo ""
echo "🔐 Para probar la conexión SSH desde otro servidor:"
echo "   ssh frigate@10.147.18.148"
echo ""
echo "⚠️ IMPORTANTE: Cambia la contraseña en producción!"
echo "   passwd frigate"