# Script para habilitar acceso de red a Next.js Development Server
# Ejecutar como Administrador

Write-Host "🔥 Configurando acceso de red para Next.js..." -ForegroundColor Cyan
Write-Host ""

# Verificar si se ejecuta como administrador
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "⚠️  ADVERTENCIA: Este script necesita ejecutarse como Administrador" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Por favor, haz lo siguiente:" -ForegroundColor Yellow
    Write-Host "1. Cierra esta ventana" -ForegroundColor Yellow
    Write-Host "2. Haz clic derecho en PowerShell" -ForegroundColor Yellow
    Write-Host "3. Selecciona 'Ejecutar como administrador'" -ForegroundColor Yellow
    Write-Host "4. Vuelve a ejecutar este script" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Presiona Enter para salir"
    exit 1
}

Write-Host "✅ Ejecutando como Administrador" -ForegroundColor Green
Write-Host ""

# Nombre de la regla
$ruleName = "Next.js Development Server"
$port = 3000

# Verificar si la regla ya existe
$existingRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue

if ($existingRule) {
    Write-Host "ℹ️  La regla de firewall ya existe" -ForegroundColor Yellow
    Write-Host ""
    $response = Read-Host "¿Deseas recrearla? (S/N)"
    
    if ($response -eq "S" -or $response -eq "s") {
        Write-Host "🗑️  Eliminando regla existente..." -ForegroundColor Yellow
        Remove-NetFirewallRule -DisplayName $ruleName
        Write-Host "✅ Regla eliminada" -ForegroundColor Green
    } else {
        Write-Host "✅ Manteniendo regla existente" -ForegroundColor Green
        Write-Host ""
        Write-Host "🎉 ¡Configuración completada!" -ForegroundColor Green
        exit 0
    }
}

# Crear nueva regla de firewall
Write-Host "🔧 Creando regla de firewall para puerto $port..." -ForegroundColor Cyan

try {
    New-NetFirewallRule -DisplayName $ruleName `
        -Direction Inbound `
        -Protocol TCP `
        -LocalPort $port `
        -Action Allow `
        -Enabled True `
        -Profile Any `
        -Description "Permite acceso de red al servidor de desarrollo Next.js en puerto $port"
    
    Write-Host "✅ Regla de firewall creada exitosamente" -ForegroundColor Green
} catch {
    Write-Host "❌ Error al crear regla de firewall: $_" -ForegroundColor Red
    Read-Host "Presiona Enter para salir"
    exit 1
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "🎉 ¡Configuración completada exitosamente!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# Obtener IP local
$ip = node scripts/get-network-ip.js
Write-Host "📱 Acceso desde tu tablet:" -ForegroundColor Cyan
Write-Host "   http://$($ip):3000" -ForegroundColor Green
Write-Host ""
Write-Host "💻 Acceso local (PC):" -ForegroundColor Cyan
Write-Host "   http://localhost:3000" -ForegroundColor Green
Write-Host ""
Write-Host "🔥 Para iniciar el servidor con acceso de red:" -ForegroundColor Cyan
Write-Host "   pnpm dev-network" -ForegroundColor Yellow
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

Read-Host "Presiona Enter para salir"
