# 🚀 Configuración de Variables de Entorno en Vercel

## ⚠️ IMPORTANTE: Configurar Odoo en Vercel

Para que la sincronización con Odoo funcione en producción, **DEBES** configurar las variables de entorno en Vercel.

### Pasos para configurar:

1. **Ve a tu proyecto en Vercel Dashboard**
   - URL: https://vercel.com/elpeladete/aran-services

2. **Navega a Settings → Environment Variables**

3. **Agrega las siguientes variables:**

#### Variables Server-Side (Backend - Rutas API):
```
ODOO_URL=https://arantecnologias.odoo.com
ODOO_DB=arantecnologias
ODOO_USERNAME=martinaused@arantecnologias.com.ar
ODOO_PASSWORD=cEiSa?f^E!rKf+2
```

#### Variables Client-Side (Frontend - Navegador):
```
NEXT_PUBLIC_ODOO_URL=https://arantecnologias.odoo.com
NEXT_PUBLIC_ODOO_DB=arantecnologias
NEXT_PUBLIC_ODOO_USERNAME=martinaused@arantecnologias.com.ar
NEXT_PUBLIC_ODOO_PASSWORD=cEiSa?f^E!rKf+2
```

### ✅ Verificación

Después de configurar las variables:

1. Redeploy la aplicación desde Vercel Dashboard
2. Verifica en la consola del navegador que aparezca:
   ```
   🔍 Verificando configuración de Odoo: true  ← Debe ser true
   🔄 Sincronizando con Odoo FSM
   ```

### 🔒 Seguridad

**IMPORTANTE:** Las variables `NEXT_PUBLIC_*` son visibles en el código del navegador. Para mayor seguridad en producción:

- Las credenciales de Odoo ya están configuradas con permisos limitados
- Solo tienen acceso a lectura/escritura de contactos y tareas
- No uses credenciales de administrador

### 📋 Variables Actuales en Vercel

Actualmente NO tienes configuradas las variables de Odoo en Vercel, por eso la sincronización no funciona.

### 🔧 Comando para verificar desde terminal:

```bash
# Ver variables configuradas en Vercel (requiere Vercel CLI)
vercel env ls
```

---

**Después de configurar estas variables, la aplicación podrá:**
- ✅ Buscar clientes en Odoo (autocompletar Razón Social)
- ✅ Crear tareas en Odoo cuando se envía una orden de servicio
- ✅ Adjuntar imágenes automáticamente a las tareas
- ✅ Marcar tareas como completadas
