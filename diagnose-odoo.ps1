# Script de diagnóstico rápido para Odoo
# Verifica las variables de entorno y la configuración

Write-Host "`n🔍 DIAGNÓSTICO DE CONFIGURACIÓN ODOO" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan

# Cargar variables de entorno desde .env.local
if (Test-Path ".env.local") {
    Write-Host "`n✅ Archivo .env.local encontrado" -ForegroundColor Green
    
    $envContent = Get-Content ".env.local"
    
    Write-Host "`n📋 Variables de Odoo configuradas:" -ForegroundColor Yellow
    
    $odooVars = $envContent | Where-Object { $_ -match "ODOO" -and $_ -notmatch "^#" }
    
    foreach ($line in $odooVars) {
        if ($line -match "PASSWORD") {
            $varName = ($line -split "=")[0]
            Write-Host "  ✓ $varName = ***" -ForegroundColor Green
        } elseif ($line -match "=" ) {
            Write-Host "  ✓ $line" -ForegroundColor Green
        }
    }
    
    Write-Host "`n🔍 Verificando valores específicos:" -ForegroundColor Yellow
    
    # URL
    $urlLine = $odooVars | Where-Object { $_ -match "^NEXT_PUBLIC_ODOO_URL=" } | Select-Object -First 1
    if ($urlLine -match "arantecnologias.odoo.com") {
        Write-Host "  ✅ URL: Actualizada correctamente (arantecnologias.odoo.com)" -ForegroundColor Green
    } else {
        Write-Host "  ❌ URL: No actualizada o incorrecta" -ForegroundColor Red
    }
    
    # DB
    $dbLine = $odooVars | Where-Object { $_ -match "^NEXT_PUBLIC_ODOO_DB=" } | Select-Object -First 1
    if ($dbLine -match "=arantecnologias$") {
        Write-Host "  ✅ DB: Actualizada correctamente (arantecnologias)" -ForegroundColor Green
    } else {
        Write-Host "  ❌ DB: No actualizada o incorrecta" -ForegroundColor Red
    }
    
    # USERNAME
    $userLine = $odooVars | Where-Object { $_ -match "^NEXT_PUBLIC_ODOO_USERNAME=" } | Select-Object -First 1
    if ($userLine) {
        Write-Host "  ✅ USERNAME: Variable correcta (NEXT_PUBLIC_ODOO_USERNAME)" -ForegroundColor Green
    } else {
        $oldUserLine = $odooVars | Where-Object { $_ -match "^NEXT_PUBLIC_ODOO_USER=" } | Select-Object -First 1
        if ($oldUserLine) {
            Write-Host "  ⚠️  USERNAME: Usando variable antigua (NEXT_PUBLIC_ODOO_USER)" -ForegroundColor Yellow
        } else {
            Write-Host "  ❌ USERNAME: No configurada" -ForegroundColor Red
        }
    }
    
} else {
    Write-Host "`n❌ Archivo .env.local NO encontrado" -ForegroundColor Red
    Write-Host "   Crea el archivo copiando desde .env.example" -ForegroundColor Yellow
}

Write-Host "`n📝 Verificando archivos de código:" -ForegroundColor Yellow

# Verificar lib/odoo-integration.ts
if (Test-Path "lib/odoo-integration.ts") {
    $odooIntContent = Get-Content "lib/odoo-integration.ts" -Raw
    
    if ($odooIntContent -match "NEXT_PUBLIC_ODOO_USERNAME") {
        Write-Host "  ✅ lib/odoo-integration.ts usa NEXT_PUBLIC_ODOO_USERNAME" -ForegroundColor Green
    } elseif ($odooIntContent -match "NEXT_PUBLIC_ODOO_USER[^N]") {
        Write-Host "  ❌ lib/odoo-integration.ts usa NEXT_PUBLIC_ODOO_USER (antigua)" -ForegroundColor Red
    }
}

# Verificar app/api/odoo/route.ts
if (Test-Path "app/api/odoo/route.ts") {
    $apiRouteContent = Get-Content "app/api/odoo/route.ts" -Raw
    
    if ($apiRouteContent -match "NEXT_PUBLIC_ODOO_USERNAME") {
        Write-Host "  ✅ app/api/odoo/route.ts usa NEXT_PUBLIC_ODOO_USERNAME" -ForegroundColor Green
    } elseif ($apiRouteContent -match "NEXT_PUBLIC_ODOO_USER[^N]") {
        Write-Host "  ❌ app/api/odoo/route.ts usa NEXT_PUBLIC_ODOO_USER (antigua)" -ForegroundColor Red
    }
}

Write-Host "`n🚀 Estado del deployment:" -ForegroundColor Yellow
Write-Host "  • Último commit:" -ForegroundColor Gray
git log -1 --oneline
Write-Host "  • URL de producción: https://aranservices.vercel.app" -ForegroundColor Gray

Write-Host "`n💡 Próximos pasos:" -ForegroundColor Cyan
Write-Host "  1. Espera a que Vercel redeploy automáticamente (2-3 minutos)" -ForegroundColor White
Write-Host "  2. O fuerza el redeploy: vercel --prod --yes" -ForegroundColor White
Write-Host "  3. Prueba en: https://aranservices.vercel.app" -ForegroundColor White
Write-Host ""
