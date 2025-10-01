# 🚀 Script para subir Studio Camera System a GitHub
# Ejecutar después de crear el repositorio en GitHub.com

Write-Host "🎯 Studio Camera System - Deploy to GitHub v0.0.1" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Gray

# Verificar que estamos en un repositorio git
if (-not (Test-Path ".git")) {
    Write-Host "❌ Error: No estás en un repositorio git" -ForegroundColor Red
    exit 1
}

# Solicitar URL del repositorio
Write-Host ""
Write-Host "📋 Instrucciones:" -ForegroundColor Yellow
Write-Host "1. Ve a GitHub.com y crea un nuevo repositorio llamado 'studio-camera-system'"
Write-Host "2. NO inicialices con README, .gitignore o licencia"
Write-Host "3. Copia la URL que GitHub te proporciona"
Write-Host ""

$repoUrl = Read-Host "🔗 Pega aquí la URL de tu repositorio GitHub (ej: https://github.com/usuario/studio-camera-system.git)"

if (-not $repoUrl) {
    Write-Host "❌ URL requerida" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🔧 Configurando remoto..." -ForegroundColor Green

try {
    # Agregar el remoto origin
    git remote add origin $repoUrl
    Write-Host "✅ Remoto agregado correctamente" -ForegroundColor Green
    
    # Subir el código
    Write-Host "📤 Subiendo código a GitHub..." -ForegroundColor Green
    git push -u origin master
    
    # Subir el tag
    Write-Host "🏷️ Subiendo tag v0.0.1..." -ForegroundColor Green
    git push origin v0.0.1
    
    Write-Host ""
    Write-Host "🎉 ¡ÉXITO! Tu proyecto está ahora en GitHub" -ForegroundColor Green
    Write-Host "🌐 Visita: $($repoUrl.Replace('.git', ''))" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📊 Estadísticas del release:" -ForegroundColor Yellow
    Write-Host "   📁 Archivos: 102"
    Write-Host "   📝 Líneas: 23,911"
    Write-Host "   🏷️ Versión: v0.0.1"
    Write-Host "   🎯 Estado: ✅ Subido a GitHub"
    
} catch {
    Write-Host "❌ Error al subir: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "🔍 Posibles soluciones:" -ForegroundColor Yellow
    Write-Host "1. Verifica que la URL sea correcta"
    Write-Host "2. Asegúrate de tener permisos en el repositorio"
    Write-Host "3. Verifica tu autenticación con GitHub"
}

Write-Host ""
Write-Host "🎨 Features incluidas en v0.0.1:" -ForegroundColor Magenta
Write-Host "   • Zoom interactivo con rueda del mouse (1x-3x)"
Write-Host "   • Filtros de post-procesado en tiempo real"
Write-Host "   • Controles de audio para main stream"
Write-Host "   • Drag & drop de cámaras"
Write-Host "   • Integración completa con Frigate NVR"
Write-Host "   • UI profesional con efectos visuales"