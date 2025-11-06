# 🔄 Sistema de Sincronización Offline - AranServices

## 📋 Resumen Ejecutivo

El sistema está diseñado para capturar órdenes de servicio **completamente offline** y sincronizarlas automáticamente cuando vuelve el internet.

---

## ✅ Garantías del Sistema

### 1. **Captura Offline 100% Funcional**
- ✅ Imágenes del formulario pre-cargadas en memoria (2.4MB)
- ✅ Firmas digitales guardadas como base64 (sin necesidad de red)
- ✅ Todos los datos guardados en IndexedDB local
- ✅ Orden marcada como `pending-offline` en BD local

### 2. **Sincronización Automática Inteligente**
- ✅ Verificación REAL de conectividad (no solo `navigator.onLine`)
- ✅ Reintentos automáticos con backoff exponencial
- ✅ Sistema de reintentos en cascada:
  - ImgBB: 3 reintentos (1s, 2s, 4s)
  - Google Forms: 3 reintentos (1s, 2s, 4s)
  - Sistema general: 3 intentos (1min, 5min, 15min)

### 3. **Monitoreo en Consola**
- ✅ Logs detallados de cada paso
- ✅ Estado de sincronización cada 5 minutos
- ✅ Alertas visuales en caso de errores

---

## 🔄 Flujo Completo: Offline → Online

### **Escenario: Desactivar WiFi → Capturar Orden → Reactivar WiFi**

```
┌─────────────────────────────────────────────────────────────────────┐
│ FASE 1: CAPTURA OFFLINE                                             │
└─────────────────────────────────────────────────────────────────────┘

1. Usuario desactiva WiFi
   └─> Sistema detecta: isOnline = false ⚠️

2. Usuario completa formulario y envía
   └─> captureOrderToCanvas() usa imagen pre-cargada ✅
   └─> Canvas genera imagen PNG de 481KB ✅
   └─> Imagen convertida a base64 ✅

3. Datos guardados localmente
   └─> IndexedDB: orden completa con imagen base64 ✅
   └─> LocalStorage: formulario en cola de sincronización ✅
   └─> Estado: "pending-offline" ✅

┌─────────────────────────────────────────────────────────────────────┐
│ FASE 2: RECONEXIÓN                                                  │
└─────────────────────────────────────────────────────────────────────┘

4. Usuario reactiva WiFi
   └─> Navegador reporta: navigator.onLine = true 📡
   └─> Sistema inicia verificación REAL de conectividad 🔍

5. Verificación de Conectividad Real
   ├─> Intento 1: ping a https://www.google.com/favicon.ico (5s timeout)
   ├─> Intento 2: ping a https://httpbin.org/status/200 (3s timeout)
   └─> Resultado: ✅ Conectividad confirmada

┌─────────────────────────────────────────────────────────────────────┐
│ FASE 3: SINCRONIZACIÓN AUTOMÁTICA                                   │
└─────────────────────────────────────────────────────────────────────┘

6. Auto-Sync se ejecuta (cada 60 segundos)
   └─> Detecta 1 formulario pendiente
   └─> Verifica conectividad real ✅
   └─> Inicia proceso de subida

7. Subida de Imagen del Formulario (aux1)
   ├─> Base64 → ImgBB (481KB)
   ├─> Reintentos automáticos si falla (1s, 2s, 4s)
   └─> Resultado: https://i.ibb.co/xxxxx/orden-20251106-160009.png ✅

8. Subida de Firma del Técnico
   ├─> Base64 → ImgBB (pequeña)
   ├─> Reintentos automáticos si falla
   └─> Resultado: https://i.ibb.co/yyyyy/firma-tecnico.png ✅

9. Subida de Firma del Cliente
   ├─> Base64 → ImgBB (pequeña)
   ├─> Reintentos automáticos si falla
   └─> Resultado: https://i.ibb.co/zzzzz/firma-cliente.png ✅

10. Envío a Google Forms
    ├─> Todas las URLs de ImgBB incluidas
    ├─> Reintentos automáticos si falla (1s, 2s, 4s)
    └─> Resultado: ✅ Formulario enviado exitosamente

11. Actualización de Base de Datos Local
    ├─> Estado cambia: "pending-offline" → "sent"
    ├─> googleFormsSent: true
    ├─> sentAt: fecha actual
    └─> imageUrl: URL final de ImgBB ✅

12. Limpieza
    └─> Formulario removido de cola de sincronización ✅

┌─────────────────────────────────────────────────────────────────────┐
│ RESULTADO FINAL                                                      │
└─────────────────────────────────────────────────────────────────────┘

✅ Orden sincronizada exitosamente
✅ Todas las imágenes en ImgBB
✅ Datos en Google Forms
✅ BD Local actualizada
✅ Cola de sincronización limpia
```

---

## 🛡️ Protecciones Implementadas

### **1. Verificación Real de Conectividad**
```typescript
// NO confiar solo en navigator.onLine
// Hacer ping real a servidores conocidos
const hasRealConnectivity = await checkRealConnectivity()
if (!hasRealConnectivity) {
  console.log('⚠️ Sin conectividad real, omitiendo sincronización')
  return // Reintentará en 60 segundos
}
```

### **2. Reintentos con Backoff Exponencial**
```
Nivel 1 (ImgBB/Google Forms):
  - Reintento 1: +1 segundo
  - Reintento 2: +2 segundos
  - Reintento 3: +4 segundos

Nivel 2 (Sistema General):
  - Intento 1: inmediato
  - Intento 2: +1 minuto
  - Intento 3: +5 minutos
  - Intento 4: +15 minutos
```

### **3. Timeouts Configurados**
- **ImgBB Upload**: 30 segundos máximo
- **Google Forms**: 15 segundos máximo
- **Verificación de conectividad**: 5 segundos (Google), 3 segundos (httpbin)

### **4. Logging Detallado**
Cada paso del proceso registra información en consola:
- 🚀 Inicio de operación
- 📏 Tamaño de datos
- 📤 Envío de petición
- 📡 Respuesta recibida
- ✅ Éxito
- ❌ Error con detalles

---

## 📊 Monitoreo en Consola

### **Al cargar la aplicación:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 SISTEMA DE SINCRONIZACIÓN OFFLINE INICIADO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Estado inicial:
   📋 Formularios pendientes: 1
   ⏳ Pendientes: 1
   📤 Subiendo: 0
   ❌ Fallidos: 0
   🕐 Más antiguo: 5 minutos
   🌐 Red: OFFLINE ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### **Cuando se reactiva la conexión:**
```
🌐 Estado de red cambió: ONLINE ✅
   📋 Hay 1 formularios pendientes de sincronización
   ⏳ La sincronización automática intentará enviarlos en breve...

🔍 Verificando conectividad real...
✅ Conectividad confirmada, procediendo con sincronización

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 SINCRONIZACIÓN INICIADA
   📋 Total a sincronizar: 1
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### **Durante la sincronización:**
```
🖼️ Subiendo imagen del formulario (aran-1762455742742-ynwht4xyd)
🚀 Iniciando upload a ImgBB para: orden-20251106-160009-aran-1762455742742-ynwht4xyd
📏 Tamaño del base64: 481824 caracteres
✅ Upload exitoso a ImgBB: https://i.ibb.co/xxxxx/orden.png

📤 Enviando formulario a Google Forms
✅ Formulario enviado a Google Forms exitosamente

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ FORMULARIO SINCRONIZADO EXITOSAMENTE
   📋 Orden: 20251106-160009
   🆔 ID: aran-1762455742742-ynwht4xyd
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 🔧 Comandos Útiles para Testing

### **Verificar estado de formularios pendientes:**
```javascript
// En consola del navegador:
localStorage.getItem('aran-offline-forms')
```

### **Ver estadísticas:**
```javascript
// Importar y usar (en componente React):
import { getPendingStats } from '@/lib/offline-storage'
const stats = getPendingStats()
console.log(stats)
```

### **Forzar sincronización inmediata:**
```javascript
// En componente con useSyncManager:
const { syncNow } = useSyncManager()
await syncNow()
```

### **Limpiar cola (CUIDADO - solo para testing):**
```javascript
import { clearAllPendingSubmissions } from '@/lib/offline-storage'
clearAllPendingSubmissions() // Elimina TODOS los formularios pendientes
```

---

## 🎯 Casos de Uso Validados

### ✅ **Caso 1: WiFi completamente desactivado**
- Captura: ✅ Funciona (imagen pre-cargada)
- Almacenamiento: ✅ IndexedDB + LocalStorage
- Sincronización posterior: ✅ Auto-sync al reconectar

### ✅ **Caso 2: WiFi conectado pero sin internet**
- Captura: ✅ Funciona (imagen pre-cargada)
- Almacenamiento: ✅ IndexedDB + LocalStorage
- Sincronización: ⏳ Esperará hasta que haya internet real

### ✅ **Caso 3: Internet intermitente**
- Captura: ✅ Funciona
- Sincronización: ✅ Reintentos automáticos con backoff

### ✅ **Caso 4: Múltiples órdenes offline**
- Captura: ✅ Todas guardadas localmente
- Sincronización: ✅ Una por una, en orden, con pausa de 1s entre cada una

---

## 📞 Soporte

Si experimentás problemas:
1. Abrí la consola del navegador (F12)
2. Buscá los logs con emoji: 🚀 🔄 ✅ ❌
3. Copiá los mensajes relevantes
4. Verificá que el internet esté funcionando realmente (no solo WiFi conectado)

---

## 🚀 Próximas Mejoras Posibles

- [ ] Notificación visual cuando se complete sincronización
- [ ] Botón manual "Sincronizar Ahora" en la UI
- [ ] Exportar formularios pendientes a JSON
- [ ] Service Worker para sincronización en background
- [ ] Compresión de imágenes antes de guardar offline
- [ ] Límite de tamaño de cola (ej: máximo 50 formularios)

---

**Versión del documento:** 1.0  
**Última actualización:** 2025-01-06  
**Sistema:** AranServices - Órdenes de Servicio
