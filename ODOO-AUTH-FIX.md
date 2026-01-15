# Fix: Error de Autenticación Odoo

## Problema Detectado

**Fecha**: 15/01/2026
**Error**: `Odoo Server Error` al intentar acceder a contactos de Odoo
**React Error**: `Minified React error #31` (lanzamiento de objeto en lugar de Error)

## Causa Raíz

La variable de entorno `ODOO_USERNAME` no existía en el ambiente **Production** de Vercel.

### Variables Requeridas

El sistema necesita **AMBAS** versiones de las variables:

#### Variables Públicas (Client-side - accesibles desde el navegador)
- `NEXT_PUBLIC_ODOO_URL` ✅
- `NEXT_PUBLIC_ODOO_DB` ✅
- `NEXT_PUBLIC_ODOO_USERNAME` ✅
- `NEXT_PUBLIC_ODOO_PASSWORD` ✅

#### Variables Privadas (Server-side - solo en API Routes)
- `ODOO_URL` ✅
- `ODOO_DB` ✅
- `ODOO_USERNAME` ❌ **FALTABA EN PRODUCTION**
- `ODOO_PASSWORD` ✅

## Solución Implementada

### 1. Detectar el problema
```powershell
vercel env ls
```

### 2. Agregar variable faltante
```powershell
# Production
Write-Output "martinaused@arantecnologias.com.ar" | vercel env add ODOO_USERNAME production --force

# Preview
Write-Output "martinaused@arantecnologias.com.ar" | vercel env add ODOO_USERNAME preview --force

# Development
Write-Output "martinaused@arantecnologias.com.ar" | vercel env add ODOO_USERNAME development --force
```

### 3. Redesplegar
```powershell
vercel --prod
```

## Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Browser)                        │
│  components/odoo-contact-search-fixed.tsx                   │
│  - Lee: NEXT_PUBLIC_ODOO_* (client-side)                   │
│  - Llama: lib/odoo-api-client.ts                           │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  │ fetch('/api/odoo/authenticate')
                  │ fetch('/api/odoo/execute')
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                API ROUTES (Server-side)                      │
│  app/api/odoo/authenticate/route.ts                        │
│  app/api/odoo/execute/route.ts                             │
│  - Lee: ODOO_* (server-side, privadas)                     │
│  - Llama: Odoo XML-RPC endpoints                           │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  │ HTTP POST (XML-RPC)
                  ▼
┌─────────────────────────────────────────────────────────────┐
│              ODOO SERVER                                     │
│  arantecnologias.odoo.com                                   │
│  DB: arantecnologias                                         │
└─────────────────────────────────────────────────────────────┘
```

## Archivos Involucrados

### Frontend
- `components/odoo-contact-search-fixed.tsx` - Componente de búsqueda
- `lib/odoo-api-client.ts` - Cliente API (isOdooConfigured, testOdooConnection, searchOdooContacts)

### Backend (API Routes)
- `app/api/odoo/authenticate/route.ts` - Endpoint de autenticación
  - **LEE**: `ODOO_URL`, `ODOO_DB`, `ODOO_USERNAME`, `ODOO_PASSWORD`
- `app/api/odoo/execute/route.ts` - Endpoint de ejecución de métodos
  - **LEE**: `ODOO_URL`, `ODOO_DB`, `ODOO_USERNAME`, `ODOO_PASSWORD`

### Configuración Local
- `.env.local` - Variables locales (gitignored)
- `.env.example` - Plantilla de variables

## Verificación Post-Fix

### 1. Verificar variables en Vercel
```powershell
vercel env ls
```

**Resultado Esperado**: Todas las variables deben existir en los 3 ambientes (Production, Preview, Development)

### 2. Verificar deployment
```powershell
vercel ls
```

**Resultado Esperado**: Último deployment exitoso

### 3. Test de conexión
Visitar: https://aranservices.vercel.app

- Abrir DevTools Console
- Buscar log: `✅ Conexión con Odoo exitosa. UID: <número>`
- Probar búsqueda de contacto con 4+ caracteres
- Verificar que no hay errores de autenticación

## Checklist de Variables de Entorno

Antes de cualquier deployment, verificar:

- [ ] `ODOO_URL` en Production, Preview, Development
- [ ] `ODOO_DB` en Production, Preview, Development
- [ ] `ODOO_USERNAME` en Production, Preview, Development ⚠️ **ERA EL FALTANTE**
- [ ] `ODOO_PASSWORD` en Production, Preview, Development
- [ ] `NEXT_PUBLIC_ODOO_URL` en Production, Preview, Development
- [ ] `NEXT_PUBLIC_ODOO_DB` en Production, Preview, Development
- [ ] `NEXT_PUBLIC_ODOO_USERNAME` en Production, Preview, Development
- [ ] `NEXT_PUBLIC_ODOO_PASSWORD` en Production, Preview, Development

## Lecciones Aprendidas

1. **Duplicación de variables**: Next.js requiere duplicar variables con prefijo `NEXT_PUBLIC_` para acceso client-side
2. **Variables server-side**: Las API Routes solo leen variables sin prefijo `NEXT_PUBLIC_`
3. **Sincronización**: Cuando se agregan variables nuevas, deben agregarse a TODOS los ambientes
4. **Redespliegue obligatorio**: Los cambios en variables de entorno requieren redespliegue

## Comandos Útiles

### Ver todas las variables
```powershell
vercel env ls
```

### Agregar/actualizar variable (todos los ambientes)
```powershell
Write-Output "valor" | vercel env add VARIABLE_NAME production --force
Write-Output "valor" | vercel env add VARIABLE_NAME preview --force
Write-Output "valor" | vercel env add VARIABLE_NAME development --force
```

### Eliminar variable obsoleta
```powershell
vercel env rm VARIABLE_NAME production
vercel env rm VARIABLE_NAME preview
vercel env rm VARIABLE_NAME development
```

### Redesplegar
```powershell
vercel --prod
```

## Estado Actual

✅ **RESUELTO** (15/01/2026)
- Deployment: https://aranservices.vercel.app
- Commit: 3969d29
- Variables: 21 variables configuradas correctamente
- Odoo: Conectando exitosamente con arantecnologias.odoo.com
