# Script para crear usuario SSH 'frigate' en servidor Frigate (Windows)
# Ejecutar como Administrador en el servidor Frigate

Write-Host "🛠️ Creando usuario 'frigate' para pruebas SSH..." -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan

# Verificar si estamos ejecutando como Administrador
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "❌ Este script debe ejecutarse como Administrador" -ForegroundColor Red
    exit 1
}

# Crear el usuario
Write-Host "👤 Creando usuario 'frigate'..." -ForegroundColor Green
$password = ConvertTo-SecureString "frigate123" -AsPlainText -Force
New-LocalUser -Name "frigate" -Password $password -FullName "Frigate SSH User" -Description "Usuario para pruebas SSH de LPR"

# Agregar al grupo Administrators (opcional)
Write-Host "🔧 Agregando a grupos necesarios..." -ForegroundColor Green
Add-LocalGroupMember -Group "Administrators" -Member "frigate"

# Crear directorio para crops LPR
Write-Host "📂 Creando directorio para crops LPR..." -ForegroundColor Green
$lprPath = "C:\media\frigate\clips\lpr"
New-Item -ItemType Directory -Path $lprPath -Force

# Establecer permisos
Write-Host "🔒 Configurando permisos..." -ForegroundColor Green
icacls $lprPath /grant "frigate:(OI)(CI)F" /T

# Verificar que el usuario se creó correctamente
Write-Host "✅ Verificando creación del usuario..." -ForegroundColor Green
Get-LocalUser -Name "frigate"

Write-Host ""
Write-Host "🎉 Usuario 'frigate' creado exitosamente!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Resumen:" -ForegroundColor Yellow
Write-Host "   Usuario: frigate" -ForegroundColor White
Write-Host "   Contraseña: frigate123" -ForegroundColor White
Write-Host "   Directorio LPR: C:\media\frigate\clips\lpr" -ForegroundColor White
Write-Host ""
Write-Host "🔐 Para probar la conexión SSH desde otro servidor:" -ForegroundColor Yellow
Write-Host "   ssh frigate@10.147.18.148" -ForegroundColor White
Write-Host ""
Write-Host "⚠️ IMPORTANTE: Cambia la contraseña en producción!" -ForegroundColor Red
Write-Host "   Para cambiar contraseña: net user frigate *" -ForegroundColor White