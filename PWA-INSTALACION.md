# 📱 Instalación de PWA - ARAN Tecnologías

## ✅ Sistema de Instalación Implementado

La aplicación ahora muestra un **banner de invitación** para instalar la app como PWA (Progressive Web App).

---

## 🎯 Características Implementadas

### 1. **Banner de Instalación Automático**
- ✅ Aparece 5 segundos después de cargar la página
- ✅ Solo se muestra si el navegador soporta PWA
- ✅ Diseño atractivo con gradiente azul
- ✅ Botón "Instalar Ahora" prominente
- ✅ Se puede cerrar con X
- ✅ Si se cierra, no aparece de nuevo por 7 días

### 2. **Service Worker**
- ✅ Cachea archivos estáticos para uso offline
- ✅ Funciona sin conexión a internet
- ✅ Se actualiza automáticamente

### 3. **Manifest Configurado**
- ✅ Nombre: "ARAN Tecnologías - Órdenes de Servicio"
- ✅ Nombre corto: "ARAN OS"
- ✅ Íconos en todos los tamaños (96px, 192px, 512px)
- ✅ Tema color: Negro (#000000)
- ✅ Modo standalone (pantalla completa)

---

## 🧪 Cómo Probar la Instalación

### **Opción 1: Escritorio (Chrome/Edge)**

1. **Abrir la aplicación:**
   ```
   http://localhost:3001
   ```

2. **Esperar 5 segundos** → Aparecerá el banner azul en la parte inferior

3. **Hacer clic en "Instalar Ahora"**

4. **El navegador mostrará un diálogo de confirmación**

5. **Hacer clic en "Instalar"**

6. **La app se abrirá en una ventana independiente** sin la barra del navegador

### **Opción 2: Desde el menú del navegador**

**Chrome/Edge:**
- Hacer clic en el ícono ⊕ (plus) en la barra de direcciones
- O ir a Menú (⋮) → "Instalar ARAN OS..."

**Firefox:**
- Hacer clic en el ícono 🏠 con + en la barra de direcciones

---

## 📱 Instalación en Dispositivos Móviles

### **Android (Chrome)**

1. **Abrir** la app en Chrome
2. **Esperar** a que aparezca el banner de instalación
3. **Hacer clic en "Instalar"**
4. **O desde el menú:** ⋮ → "Agregar a pantalla de inicio"
5. **La app se agregará** como ícono en tu inicio

### **iOS/iPadOS (Safari)**

1. **Abrir** la app en Safari
2. **Hacer clic** en el botón Compartir (⬆️)
3. **Seleccionar** "Agregar a pantalla de inicio"
4. **Personalizar** el nombre (opcional)
5. **Hacer clic en "Agregar"**

**Nota:** iOS no muestra el banner automático, debe hacerse manualmente.

---

## 🎨 Apariencia del Banner

```
┌──────────────────────────────────────────────────────────┐
│  📱  Instala ARAN Órdenes de Servicio                    │
│      Accede más rápido y trabaja sin conexión.          │
│      Instala nuestra app en tu dispositivo.              │
│                                      [Instalar Ahora]  X │
└──────────────────────────────────────────────────────────┘
```

---

## 🔧 Componentes Creados

1. **`components/install-prompt.tsx`**
   - Banner de instalación con diseño atractivo
   - Detecta el evento `beforeinstallprompt`
   - Gestiona el estado de instalación
   - Sistema de recordatorio (7 días)

2. **`components/service-worker-registration.tsx`**
   - Registra el Service Worker
   - Gestiona actualizaciones
   - Recarga automática cuando hay nueva versión

3. **`public/service-worker.js`**
   - Cachea archivos estáticos
   - Funcionalidad offline
   - Gestión de cache

---

## ✨ Ventajas de la Instalación

✅ **Acceso rápido:** Ícono en escritorio/inicio  
✅ **Pantalla completa:** Sin barras del navegador  
✅ **Offline:** Funciona sin internet (excepto sync)  
✅ **Notificaciones:** Preparado para push notifications (futuro)  
✅ **Actualizaciones automáticas:** Se actualiza en segundo plano  

---

## 🐛 Troubleshooting

### El banner no aparece:

1. **Verificar que estás en producción o HTTPS**
   - Localhost funciona para testing
   - En producción debe ser HTTPS

2. **Verificar la consola del navegador**
   - Buscar mensajes de Service Worker
   - Buscar errores del manifest

3. **Limpiar cache y recargar**
   - Chrome DevTools → Application → Clear storage
   - Recargar la página

4. **Verificar que no esté ya instalada**
   - Si la app ya está instalada, el banner no aparece

### Service Worker no se registra:

1. **Abrir Chrome DevTools → Application → Service Workers**
2. **Verificar que aparece el SW**
3. **Si hay error, revisar la consola**
4. **Hacer "Unregister" y recargar**

---

## 🎯 Próximos Pasos (Opcional)

- [ ] Agregar screenshots al manifest para mejor experiencia
- [ ] Implementar push notifications
- [ ] Agregar splash screen personalizada
- [ ] Analytics de instalaciones
- [ ] A/B testing del mensaje del banner

---

## 📊 Verificar Estado PWA

**Chrome DevTools:**
1. F12 → Application
2. Manifest → Verificar que carga correctamente
3. Service Workers → Verificar que está activo
4. Lighthouse → Ejecutar auditoría PWA (debería dar >90%)

---

**¡La aplicación está lista para ser instalada! 🚀**
