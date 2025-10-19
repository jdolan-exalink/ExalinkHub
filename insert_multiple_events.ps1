$username = "admin"
$password = "admin123"
$base64Auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${username}:${password}"))

$headers = @{
    "Authorization" = "Basic $base64Auth"
    "Content-Type" = "application/json"
}

Write-Host "=== Insertando eventos de prueba ===" -ForegroundColor Cyan
Write-Host ""

$plates = @("XYZ789", "DEF456", "GHI012", "JKL345", "MNO678")

foreach ($plate in $plates) {
    try {
        Write-Host "Insertando matricula: $plate..." -NoNewline
        $response = Invoke-WebRequest -Uri "http://localhost:2221/api/test/insert-event" -Method Post -Headers $headers -UseBasicParsing
        $data = $response.Content | ConvertFrom-Json
        Write-Host " OK (ID: $($data.event_id))" -ForegroundColor Green
        Start-Sleep -Milliseconds 500
    } catch {
        Write-Host " ERROR" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== Verificando total de eventos ===" -ForegroundColor Cyan

try {
    $response = Invoke-WebRequest -Uri "http://localhost:2221/api/events?limit=10" -Headers $headers -UseBasicParsing
    $data = $response.Content | ConvertFrom-Json
    
    Write-Host "Total de eventos en backend: $($data.total)" -ForegroundColor Green
    Write-Host ""
    Write-Host "Ultimos eventos:"
    $data.events | ForEach-Object {
        Write-Host "  - $($_.license_plate) | Confianza: $($_.plate_confidence) | Camara: $($_.camera_name)"
    }
} catch {
    Write-Host "Error al verificar: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "Abre el navegador en: http://localhost:9002" -ForegroundColor Yellow
Write-Host "Navega a la pagina de matriculas (LPR) para ver los eventos" -ForegroundColor Yellow
