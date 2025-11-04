# 📱 Acceso Rápido desde Tablet

## ✅ Tu servidor ya está corriendo con acceso de red

### 🌐 URLs de Acceso:

**Desde tu Tablet:**
```
http://192.168.1.14:3000
```

**Desde tu PC:**
```
http://localhost:3000
```

---

## 📋 Pasos para Acceder desde la Tablet:

### 1️⃣ Verifica que ambos dispositivos estén en la misma red WiFi
- Tu PC debe estar conectada a la red WiFi
- Tu tablet debe estar conectada a la **misma red WiFi**

### 2️⃣ Abre el navegador en tu tablet
- Chrome, Safari, Firefox, o cualquier navegador

### 3️⃣ Escribe la URL en la barra de direcciones:
```
http://192.168.1.14:3000
```

### 4️⃣ ¡Listo! Ya deberías ver la aplicación

---

## 🔥 Configuración del Firewall (Si no puedes acceder)

Si tu tablet no puede conectarse, necesitas configurar el firewall:

### Opción 1: Script Automático (Recomendado)
1. Haz clic derecho en el archivo `enable-network-access.ps1`
2. Selecciona "Ejecutar con PowerShell"
3. Cuando aparezca la ventana de UAC, haz clic en "Sí"
4. Sigue las instrucciones en pantalla

### Opción 2: Manual
1. Abre PowerShell como **Administrador**
2. Ejecuta:
```powershell
New-NetFirewallRule -DisplayName "Next.js Development Server" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Enabled True
```

---

## 🚀 Comandos Útiles:

### Iniciar servidor con acceso de red:
```bash
pnpm dev-network
```

### Iniciar servidor solo local:
```bash
pnpm dev
```

### Ver tu IP actual:
```bash
node scripts/get-network-ip.js
```

### Verificar que el servidor está corriendo:
```bash
curl http://localhost:3000
```

---

## 🛠️ Solución de Problemas:

### ❌ "No se puede acceder al sitio"

**Causa posible:** Firewall bloqueando conexiones

**Solución:**
1. Ejecuta el script `enable-network-access.ps1` como administrador
2. O temporalmente desactiva el firewall de Windows:
   - Panel de Control → Firewall de Windows
   - Desactivar (solo para prueba)
   - ⚠️ Recuerda reactivarlo después

### ❌ "Timeout de conexión"

**Causa posible:** Dispositivos en redes diferentes

**Solución:**
- Verifica que PC y tablet estén en la misma red WiFi
- Verifica la IP ejecutando: `node scripts/get-network-ip.js`
- Usa la IP correcta en tu tablet

### ❌ "IP incorrecta"

**Causa posible:** Tu IP cambió

**Solución:**
1. Ejecuta: `node scripts/get-network-ip.js`
2. Usa la nueva IP en tu tablet
3. Tu IP puede cambiar si te reconectas al WiFi

---

## 📱 Funcionalidades Disponibles en Tablet:

✅ Formulario completo interactivo  
✅ Firma digital y manual  
✅ Autocompletado de campos  
✅ Captura de fotos con cámara  
✅ Envío automático por WhatsApp  
✅ Funcionamiento offline  
✅ PWA instalable  

---

## 🎯 Información Actual del Sistema:

- **Estado del Servidor:** ✅ CORRIENDO
- **Puerto:** 3000
- **IP Local:** 192.168.1.14
- **Hostname:** 0.0.0.0 (escucha en todas las interfaces)
- **Comando usado:** `pnpm dev-network`

---

## 📞 Acceso Rápido:

Para compartir fácilmente con otros dispositivos, puedes:

1. **Tomar captura** de la URL
2. **Crear código QR** en https://qr.io
3. **Compartir por WhatsApp** o email

---

**¡Tu aplicación está lista para usar desde cualquier dispositivo en tu red local!** 🎉
