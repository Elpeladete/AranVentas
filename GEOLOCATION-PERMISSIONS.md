# Sistema de Permisos de Geolocalización

## Descripción

Sistema automatizado para gestionar permisos de geolocalización con verificación diaria. Garantiza que los permisos estén activos para capturar la ubicación del cliente en las órdenes de servicio.

## Características

### ✅ Verificación Automática Diaria
- Los permisos se verifican cada 24 horas automáticamente
- La verificación ocurre al cargar la aplicación
- Se re-verifica cuando la app vuelve al foco (visibility change)

### 📍 Estados de Permiso
1. **Granted (Habilitado)** ✅
   - Permisos activos
   - La geolocalización se capturará automáticamente con las firmas del cliente
   
2. **Denied (Denegado)** ❌
   - Permisos rechazados por el usuario
   - Se muestran instrucciones para habilitarlos manualmente
   
3. **Prompt (Pendiente)** ⚠️
   - Permisos no solicitados aún
   - Botón visible para solicitar permisos

4. **Unknown (Desconocido)** ❓
   - Estado inicial o error en la verificación

### 🔄 Flujo de Trabajo

```
1. Usuario abre la app
   ↓
2. Hook verifica última verificación (localStorage)
   ↓
3. ¿Hace más de 24h?
   ├─ SÍ → Verificar estado actual de permisos
   └─ NO → Usar estado guardado
   ↓
4. Actualizar UI con estado actual
   ↓
5. Si es "prompt" → Mostrar botón "Habilitar"
   ↓
6. Usuario concede permisos
   ↓
7. Estado guardado por 24h
```

### 🎯 Componentes

#### 1. `use-geolocation-permission.ts`
Hook personalizado que gestiona el estado de permisos:

**Exports:**
- `status`: Estado actual ('granted' | 'denied' | 'prompt' | 'unknown')
- `lastChecked`: Fecha de última verificación
- `isChecking`: Booleano indicando verificación en progreso
- `needsRecheck`: Indica si necesita re-verificación
- `hasPermission`: Booleano simplificado (true si granted)
- `isPermissionDenied`: Booleano simplificado (true si denied)
- `shouldRequestPermission`: Indica si debe mostrar botón de solicitud
- `requestPermission()`: Función para solicitar permisos
- `checkPermissions()`: Función para verificar estado manualmente
- `resetCheckTimer()`: Reinicia el temporizador de 24h

**localStorage Keys:**
- `aran-geolocation-last-check`: Timestamp de última verificación
- `aran-geolocation-status`: Estado guardado ('granted' | 'denied' | 'prompt')

#### 2. `geolocation-permission-indicator.tsx`
Componente visual para mostrar estado y solicitar permisos:

**Props:**
- `className`: Classes CSS adicionales
- `showDetails`: Mostrar vista completa o compacta (default: true)
- `autoRequest`: Solicitar permisos automáticamente si es necesario (default: false)

**Modos de Vista:**
- **Completa** (`showDetails=true`): Card con estado, botones, instrucciones
- **Compacta** (`showDetails=false`): Solo badge con ícono y estado

#### 3. Integración en `service-order-form.tsx`
El indicador se muestra prominentemente después del header:

```tsx
<GeolocationPermissionIndicator 
  className="mb-4"
  showDetails={true}
  autoRequest={false}
/>
```

### 📱 Experiencia de Usuario

#### Primera Vez (Sin Permisos)
```
┌─────────────────────────────────────────┐
│ 📍 Geolocalización      [Pendiente]    │
│                                         │
│ Es necesario conceder permisos para    │
│ capturar la ubicación del cliente.     │
│                                         │
│ Última verificación: 21/01/2026 10:30  │
│                                         │
│         [Habilitar]  [Verificar]       │
└─────────────────────────────────────────┘
```

#### Permisos Activos
```
┌─────────────────────────────────────────┐
│ ✅ Geolocalización      [Habilitado]   │
│                                         │
│ Permisos activos. La ubicación se     │
│ capturará con las firmas del cliente.  │
│                                         │
│ Última verificación: 21/01/2026 10:30  │
│                                         │
│               [Verificar]              │
└─────────────────────────────────────────┘
```

#### Permisos Denegados
```
┌─────────────────────────────────────────┐
│ ❌ Geolocalización      [Denegado]     │
│                                         │
│ Permisos denegados. No se podrá       │
│ capturar la ubicación.                 │
│                                         │
│ Última verificación: 21/01/2026 10:30  │
│                                         │
│ ┌─────────────────────────────────┐   │
│ │ ¿Cómo habilitar los permisos?  │   │
│ │ 1. Toca el ícono del candado   │   │
│ │ 2. Busca "Ubicación"           │   │
│ │ 3. Selecciona "Permitir"       │   │
│ │ 4. Recarga la página           │   │
│ └─────────────────────────────────┘   │
│               [Verificar]              │
└─────────────────────────────────────────┘
```

### 🔐 Seguridad y Privacidad

- Los permisos solo se verifican, nunca se almacena la ubicación en localStorage
- La geolocalización solo se captura al firmar como cliente
- Los datos de ubicación se envían únicamente con la orden de servicio
- El usuario puede denegar permisos en cualquier momento

### 🛠️ Configuración

#### Cambiar Intervalo de Verificación
En `use-geolocation-permission.ts`:

```typescript
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000 // 24 horas (cambiar aquí)
```

#### Solicitud Automática
Para solicitar permisos automáticamente al detectar que faltan:

```tsx
<GeolocationPermissionIndicator 
  autoRequest={true}  // Cambia a true
/>
```

⚠️ **Nota**: No recomendado para UX. Es mejor dejar que el usuario decida.

### 🧪 Testing

#### Simular Estado "Denied"
1. Abre DevTools (F12)
2. Settings → Content settings → Location
3. Selecciona "Block"
4. Recarga la página

#### Simular Estado "Prompt"
1. Abre DevTools (F12)
2. Settings → Content settings → Location
3. Selecciona "Ask"
4. Limpia localStorage: `localStorage.clear()`
5. Recarga la página

#### Forzar Re-verificación
En la consola del navegador:
```javascript
localStorage.removeItem('aran-geolocation-last-check')
location.reload()
```

### 📊 Comportamiento por Navegador

| Navegador | Permissions API | getCurrentPosition | Notas |
|-----------|-----------------|-------------------|-------|
| Chrome 90+ | ✅ | ✅ | Soporte completo |
| Firefox 88+ | ✅ | ✅ | Soporte completo |
| Safari 15+ | ⚠️ | ✅ | No soporta Permissions API, usa fallback |
| Edge 90+ | ✅ | ✅ | Soporte completo |
| Mobile Chrome | ✅ | ✅ | Soporte completo |
| Mobile Safari | ⚠️ | ✅ | No soporta Permissions API, usa fallback |

### 🐛 Troubleshooting

#### El estado siempre es "unknown"
- Verifica que el navegador soporte geolocation
- Revisa la consola por errores
- Asegúrate de estar en HTTPS (geolocation requiere contexto seguro)

#### Los permisos no se guardan
- Verifica que localStorage esté habilitado
- Revisa cookies/storage settings del navegador
- Limpia localStorage y prueba de nuevo

#### La verificación diaria no funciona
- Verifica el valor en localStorage: `localStorage.getItem('aran-geolocation-last-check')`
- Asegúrate de que la fecha sea válida
- Revisa la consola por errores

### 🔄 Actualizaciones Futuras

- [ ] Notificación push cuando los permisos son revocados
- [ ] Analytics de tasa de concesión de permisos
- [ ] Fallback a geolocalización IP si permisos denegados
- [ ] Tutorial interactivo para conceder permisos
- [ ] Integración con service worker para verificación en background

### 📝 Changelog

#### v1.0.0 (21/01/2026)
- ✨ Sistema inicial de verificación diaria de permisos
- ✨ Componente visual de indicador de permisos
- ✨ Hook personalizado para gestión de permisos
- ✨ Integración en formulario principal
- 📚 Documentación completa
