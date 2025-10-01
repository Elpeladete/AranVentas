# 🚀 Configuración de Wazzup WhatsApp API

Este proyecto incluye integración completa con Wazzup API para envío **automático** de órdenes de servicio por WhatsApp, incluyendo **texto + imagen adjunta**.

## 📋 Configuración Rápida

### 1. Obtener credenciales de Wazzup
- Regístrate en [Wazzup24.com](https://wazzup24.com)
- Obtén tu **API Token** desde el panel de administración
- Copia tu **Instance ID** (ID de instancia WhatsApp Business)

### 2. Configurar API Key
Edita el archivo `lib/wazzup-api.ts` línea 31:

```typescript
const DEFAULT_CONFIG: WazzupConfig = {
  apiKey: 'TU_API_TOKEN_REAL_AQUÍ', // ← Reemplaza esto
  baseUrl: 'https://api.wazzup24.com'
}
```

O crea un archivo `.env.local`:
```bash
NEXT_PUBLIC_WAZZUP_API_KEY=TU_API_TOKEN_REAL_AQUÍ
```

### 3. ¡Listo! 🎉
El sistema detectará automáticamente si Wazzup está configurado:
- **✅ Configurado:** Envío automático con imagen adjunta
- **⚠️ No configurado:** Fallback a WhatsApp Web (solo texto + enlace imagen)

## 🔄 Funcionamiento Automático

### Con Wazzup configurado:
1. Usuario completa formulario ✅
2. Sistema captura imagen de la orden 📸
3. Sube imagen a ImgBB ☁️
4. **Envía mensaje de texto por Wazzup** 📱
5. **Envía imagen adjunta por Wazzup** 🖼️
6. Cliente recibe orden completa en WhatsApp ✨

### Sin Wazzup (Fallback):
1. Usuario completa formulario ✅
2. Sistema captura imagen de la orden 📸
3. Sube imagen a ImgBB ☁️
4. Abre WhatsApp Web con mensaje + enlace imagen 🌐

## 🧪 Diagnóstico y Pruebas

### Probar configuración:
1. Abre la consola del navegador (F12)
2. Carga `test-wazzup-console.js` 
3. Ejecuta: `testWazzupSetup()`

### Ver logs en tiempo real:
- Abre consola del navegador durante envío de formulario
- Busca mensajes que inicien con: `📱`, `✅`, `❌`

### Mensajes de diagnóstico:
- `📱 Iniciando envío por WhatsApp` - Inicio del proceso
- `✅ Texto enviado exitosamente` - Mensaje de texto OK
- `📎 Enviando imagen adjunta...` - Iniciando envío de imagen
- `✅ Imagen enviada exitosamente` - Imagen adjunta OK
- `⚠️ Wazzup no configurado, usando fallback` - Usando WhatsApp Web

## ❌ Solución de Problemas

### Error "Wazzup no configurado"
- ✅ Verifica que el API Token no sea `YOUR_WAZZUP_API_KEY`
- ✅ Confirma que el token tenga más de 10 caracteres
- ✅ Reinicia el servidor después de cambios

### Error "401 Unauthorized"
- ❌ API Token inválido o expirado
- 🔧 Verifica credenciales en panel de Wazzup
- 🔧 Regenera API Token si es necesario

### Error "No se pudo enviar imagen"  
- ⚠️ El texto se envía pero la imagen falla
- 🔍 Verifica que ImgBB esté funcionando
- 🔍 Confirma que la URL de imagen sea accesible

### Mensaje se envía sin imagen
- Es normal si Wazzup no está configurado
- El sistema usa fallback con enlace a imagen
- Configura Wazzup para adjuntos automáticos

## 🔒 Seguridad

- ⚠️ **NUNCA** subas las credenciales de Wazzup al repositorio público
- ✅ Usa variables de entorno (`.env.local`)
- ✅ Mantén el archivo `.env.local` en `.gitignore`

## 📊 Logs Útiles para Debugging

```javascript
// En la consola del navegador, busca:
📱 Iniciando envío por WhatsApp: {...}  // Datos de inicio
📋 Enviando orden de servicio por Wazzup API: {...}  // Detalles técnicos
✅ Texto enviado exitosamente  // Mensaje OK
📎 Enviando imagen adjunta...  // Iniciando imagen
✅ Imagen enviada exitosamente  // Imagen OK
✅ Orden de servicio enviada completamente por WhatsApp  // Proceso completo
```

## 🚀 Estado del Sistema

**✅ FUNCIONALIDADES IMPLEMENTADAS:**
- Captura automática de imagen de orden
- Subida automática a ImgBB
- Envío automático de texto por Wazzup
- Envío automático de imagen adjunta por Wazzup
- Fallback a WhatsApp Web si no está configurado
- Logs completos para debugging
- Manejo de errores y recuperación

**🔧 PRÓXIMAMENTE:**
- Configuración desde UI (sin editar código)
- Soporte para múltiples proveedores WhatsApp
- Plantillas de mensajes personalizables

---

💡 **TIP:** Una vez configurado, el sistema funciona completamente automático. Los clientes recibirán la orden de servicio con imagen adjunta sin intervención manual.
