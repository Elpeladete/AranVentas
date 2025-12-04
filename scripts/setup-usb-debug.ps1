# Script para configurar depuración USB con la tablet
# Ejecutar como administrador si es necesario

Write-Host "`n🔧 Configuración de Depuración USB para AranServices`n" -ForegroundColor Cyan

# Verificar si ADB está instalado
$adbPath = Get-Command adb -ErrorAction SilentlyContinue

if (-not $adbPath) {
    Write-Host "❌ ADB no está instalado`n" -ForegroundColor Red
    Write-Host "Opciones de instalación:`n" -ForegroundColor Yellow
    Write-Host "1. Con Chocolatey (rápido):" -ForegroundColor White
    Write-Host "   choco install adb -y`n" -ForegroundColor Gray
    Write-Host "2. Descarga manual:" -ForegroundColor White
    Write-Host "   https://developer.android.com/studio/releases/platform-tools`n" -ForegroundColor Gray
    exit 1
}

Write-Host "✅ ADB está instalado`n" -ForegroundColor Green

# Reiniciar servidor ADB
Write-Host "🔄 Reiniciando servidor ADB..." -ForegroundColor Cyan
adb kill-server | Out-Null
Start-Sleep -Seconds 1
adb start-server | Out-Null

Write-Host "📱 Buscando dispositivos conectados...`n" -ForegroundColor Cyan
$devices = adb devices

Write-Host $devices
Write-Host ""

# Verificar si hay dispositivos conectados
$deviceCount = ($devices | Select-String "device$" | Measure-Object).Count

if ($deviceCount -eq 0) {
    Write-Host "❌ No se encontraron dispositivos conectados`n" -ForegroundColor Red
    Write-Host "Pasos para conectar:`n" -ForegroundColor Yellow
    Write-Host "1. Conecta la tablet por USB" -ForegroundColor White
    Write-Host "2. En la tablet: Configuración → Opciones de desarrollador → Depuración USB (ON)" -ForegroundColor White
    Write-Host "3. Acepta el diálogo de autorización en la tablet" -ForegroundColor White
    Write-Host "4. Ejecuta este script nuevamente`n" -ForegroundColor White
    exit 1
}

if ($devices -match "unauthorized") {
    Write-Host "⚠️  Dispositivo conectado pero no autorizado`n" -ForegroundColor Yellow
    Write-Host "Acciones:" -ForegroundColor Yellow
    Write-Host "1. Verifica la pantalla de la tablet" -ForegroundColor White
    Write-Host "2. Acepta el diálogo 'Permitir depuración USB'" -ForegroundColor White
    Write-Host "3. Marca 'Confiar siempre en este equipo'" -ForegroundColor White
    Write-Host "4. Ejecuta este script nuevamente`n" -ForegroundColor White
    
    $retry = Read-Host "¿Intentar limpiar autorizaciones? (s/n)"
    
    if ($retry -eq "s" -or $retry -eq "S") {
        Write-Host "`n🧹 Limpiando autorizaciones..." -ForegroundColor Cyan
        adb kill-server
        Remove-Item "$env:USERPROFILE\.android\adbkey*" -ErrorAction SilentlyContinue
        adb start-server
        Write-Host "✅ Autorizaciones limpiadas. Desconecta y reconecta la tablet`n" -ForegroundColor Green
    }
    
    exit 1
}

Write-Host "✅ Tablet conectada y autorizada`n" -ForegroundColor Green

# Configurar port forwarding
Write-Host "🔗 Configurando port forwarding (puerto 3000)..." -ForegroundColor Cyan
$result = adb reverse tcp:3000 tcp:3000 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Port forwarding configurado exitosamente`n" -ForegroundColor Green
    
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host "🎉 ¡Todo listo!" -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "En la tablet, abre Chrome y ve a:" -ForegroundColor White
    Write-Host "  http://localhost:3000" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Para depuración remota de Chrome:" -ForegroundColor White
    Write-Host "  1. Abre Chrome en tu PC" -ForegroundColor Gray
    Write-Host "  2. Ve a: chrome://inspect" -ForegroundColor Gray
    Write-Host "  3. Verás la tablet listada" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Servidor Next.js debe estar corriendo:" -ForegroundColor White
    Write-Host "  pnpm run dev-network" -ForegroundColor Gray
    Write-Host ""
    
} else {
    Write-Host "❌ Error configurando port forwarding" -ForegroundColor Red
    Write-Host $result
    exit 1
}
