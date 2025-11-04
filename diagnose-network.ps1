# Script de Diagnóstico de Conexión de Red
# Para solucionar problemas de acceso desde tablet

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "🔍 Diagnóstico de Acceso de Red" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# 1. Obtener IP
Write-Host "1️⃣ Detectando IP local..." -ForegroundColor Cyan
$ip = node scripts/get-network-ip.js
Write-Host "   ✅ IP: $ip" -ForegroundColor Green
Write-Host ""

# 2. Verificar servidor
Write-Host "2️⃣ Verificando servidor en puerto 3000..." -ForegroundColor Cyan
$listening = netstat -ano | findstr :3000 | Select-Object -First 1
if ($listening) {
    Write-Host "   ✅ Servidor escuchando en puerto 3000" -ForegroundColor Green
} else {
    Write-Host "   ❌ Servidor NO está escuchando" -ForegroundColor Red
    Write-Host "   💡 Ejecuta: pnpm dev-network" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Presiona Enter para salir"
    exit 1
}
Write-Host ""

# 3. Probar acceso local
Write-Host "3️⃣ Probando acceso desde PC..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://$($ip):3000" -TimeoutSec 5 -UseBasicParsing
    Write-Host "   ✅ Acceso local funciona (Status: $($response.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "   ❌ No se puede acceder localmente" -ForegroundColor Red
    Write-Host "   Error: $_" -ForegroundColor Red
    Write-Host ""
    Read-Host "Presiona Enter para salir"
    exit 1
}
Write-Host ""

# 4. Verificar regla de firewall
Write-Host "4️⃣ Verificando regla de firewall..." -ForegroundColor Cyan
$rule = Get-NetFirewallRule -DisplayName "Next.js Dev Server" -ErrorAction SilentlyContinue
if ($rule) {
    Write-Host "   ✅ Regla de firewall existe" -ForegroundColor Green
    $portFilter = $rule | Get-NetFirewallPortFilter
    Write-Host "   📋 Puerto: $($portFilter.LocalPort)" -ForegroundColor Gray
} else {
    Write-Host "   ⚠️  Regla de firewall NO existe" -ForegroundColor Yellow
    Write-Host "   💡 Ejecuta: enable-network-access.ps1 como Administrador" -ForegroundColor Yellow
}
Write-Host ""

# 5. Verificar perfil de red
Write-Host "5️⃣ Verificando perfil de red..." -ForegroundColor Cyan
$profile = Get-NetConnectionProfile | Select-Object -First 1
Write-Host "   📡 Red: $($profile.Name)" -ForegroundColor Gray
Write-Host "   🔒 Categoría: $($profile.NetworkCategory)" -ForegroundColor Gray

if ($profile.NetworkCategory -eq "Public") {
    Write-Host "   ⚠️  Red configurada como 'Public'" -ForegroundColor Yellow
    Write-Host "   💡 Esto puede causar problemas de acceso" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   🔧 Solución recomendada:" -ForegroundColor Yellow
    Write-Host "   1. Abre: Configuración → Red e Internet → WiFi" -ForegroundColor White
    Write-Host "   2. Haz clic en tu red WiFi" -ForegroundColor White
    Write-Host "   3. Cambia 'Perfil de red' a 'Privada'" -ForegroundColor White
} else {
    Write-Host "   ✅ Red configurada correctamente" -ForegroundColor Green
}
Write-Host ""

# 6. Verificar firewall de Windows
Write-Host "6️⃣ Verificando Windows Defender Firewall..." -ForegroundColor Cyan
$firewallPublic = Get-NetFirewallProfile -Name Public
if ($firewallPublic.Enabled) {
    Write-Host "   🔥 Firewall ACTIVO para red pública" -ForegroundColor Yellow
    Write-Host "   💡 Esto puede bloquear conexiones entrantes" -ForegroundColor Yellow
} else {
    Write-Host "   ✅ Firewall desactivado para red pública" -ForegroundColor Green
}
Write-Host ""

# 7. Resumen y URLs
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "📱 URLs de Acceso" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "Desde tu tablet, abre:" -ForegroundColor White
Write-Host "   http://$($ip):3000" -ForegroundColor Green -BackgroundColor Black
Write-Host ""
Write-Host "Desde tu PC:" -ForegroundColor White
Write-Host "   http://localhost:3000" -ForegroundColor Green -BackgroundColor Black
Write-Host ""

# 8. Soluciones sugeridas
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "🔧 Soluciones si no funciona" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

if ($profile.NetworkCategory -eq "Public") {
    Write-Host "✅ SOLUCIÓN 1: Cambiar red a 'Privada' (Recomendado)" -ForegroundColor Green
    Write-Host "   Windows → Configuración → Red → WiFi → Tu Red → Privada" -ForegroundColor White
    Write-Host ""
}

Write-Host "✅ SOLUCIÓN 2: Desactivar temporalmente firewall (solo para prueba)" -ForegroundColor Green
Write-Host "   Panel de Control → Firewall → Desactivar firewall de red pública" -ForegroundColor White
Write-Host ""

Write-Host "✅ SOLUCIÓN 3: Crear regla específica de firewall" -ForegroundColor Green
Write-Host "   Ejecuta enable-network-access.ps1 como Administrador" -ForegroundColor White
Write-Host ""

Write-Host "✅ SOLUCIÓN 4: Verificar que ambos dispositivos estén en la misma red" -ForegroundColor Green
Write-Host "   PC y tablet deben estar conectados al mismo WiFi" -ForegroundColor White
Write-Host ""

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# Opción para copiar URL al clipboard
$copyURL = Read-Host "¿Copiar URL al portapapeles? (S/N)"
if ($copyURL -eq "S" -or $copyURL -eq "s") {
    "http://$($ip):3000" | Set-Clipboard
    Write-Host "✅ URL copiada al portapapeles" -ForegroundColor Green
}

Write-Host ""
Read-Host "Presiona Enter para salir"
