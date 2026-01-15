# Script para actualizar variables de entorno en Vercel
# Ejecutar desde la raíz del proyecto

Write-Host "🚀 Actualizando variables de entorno en Vercel..." -ForegroundColor Cyan
Write-Host ""

# Variables a actualizar
$variables = @(
    @{Name="ODOO_URL"; Value="https://arantecnologias.odoo.com"; Environments="production,preview,development"},
    @{Name="ODOO_DB"; Value="arantecnologias"; Environments="production,preview,development"},
    @{Name="ODOO_USERNAME"; Value="martinaused@arantecnologias.com.ar"; Environments="production,preview,development"},
    @{Name="ODOO_PASSWORD"; Value="cEiSa?f^E!rKf+2"; Environments="production,preview,development"},
    @{Name="NEXT_PUBLIC_ODOO_URL"; Value="https://arantecnologias.odoo.com"; Environments="production,preview,development"},
    @{Name="NEXT_PUBLIC_ODOO_DB"; Value="arantecnologias"; Environments="production,preview,development"},
    @{Name="NEXT_PUBLIC_ODOO_USERNAME"; Value="martinaused@arantecnologias.com.ar"; Environments="production,preview,development"},
    @{Name="NEXT_PUBLIC_ODOO_PASSWORD"; Value="cEiSa?f^E!rKf+2"; Environments="production,preview,development"}
)

Write-Host "📋 Variables a actualizar:" -ForegroundColor Yellow
foreach ($var in $variables) {
    Write-Host "  - $($var.Name)" -ForegroundColor Gray
}
Write-Host ""

$confirm = Read-Host "¿Deseas continuar? (s/n)"
if ($confirm -ne 's' -and $confirm -ne 'S') {
    Write-Host "❌ Operación cancelada" -ForegroundColor Red
    exit
}

Write-Host ""
Write-Host "🔄 Procesando variables..." -ForegroundColor Cyan
Write-Host ""

$updated = 0
$failed = 0

foreach ($var in $variables) {
    Write-Host "Procesando: $($var.Name)..." -ForegroundColor White
    
    # Primero intentar eliminar la variable existente (solo en production para confirmar una vez)
    Write-Host "  Eliminando versión anterior..." -ForegroundColor Gray
    $removeOutput = echo "y" | vercel env rm $($var.Name) production 2>&1
    
    if ($LASTEXITCODE -ne 0 -and $removeOutput -notlike "*not found*") {
        Write-Host "  ⚠️  Error al eliminar (puede no existir)" -ForegroundColor Yellow
    }
    
    # Agregar la nueva variable a todos los entornos
    Write-Host "  Agregando nuevo valor..." -ForegroundColor Gray
    
    # Para production
    $addOutput = echo $($var.Value) | vercel env add $($var.Name) production 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ Production actualizado" -ForegroundColor Green
        $updated++
    } else {
        Write-Host "  ❌ Error en production: $addOutput" -ForegroundColor Red
        $failed++
    }
    
    # Para preview
    $addOutput = echo $($var.Value) | vercel env add $($var.Name) preview 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ Preview actualizado" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Preview: $addOutput" -ForegroundColor Yellow
    }
    
    # Para development
    $addOutput = echo $($var.Value) | vercel env add $($var.Name) development 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ Development actualizado" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Development: $addOutput" -ForegroundColor Yellow
    }
    
    Write-Host ""
}

Write-Host ""
Write-Host "=" -Repeat 60 -ForegroundColor Cyan
Write-Host "📊 RESUMEN" -ForegroundColor Cyan
Write-Host "=" -Repeat 60 -ForegroundColor Cyan
Write-Host "✅ Variables actualizadas: $updated" -ForegroundColor Green
Write-Host "❌ Variables con errores: $failed" -ForegroundColor Red
Write-Host ""

if ($failed -eq 0) {
    Write-Host "🎉 ¡Todas las variables se actualizaron correctamente!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🚀 Siguiente paso: Redeploy de la aplicación" -ForegroundColor Yellow
    Write-Host "   Ejecuta: vercel --prod" -ForegroundColor Gray
} else {
    Write-Host "⚠️  Algunas variables tuvieron errores. Revisa los mensajes arriba." -ForegroundColor Yellow
}

Write-Host ""
