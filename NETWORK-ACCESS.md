# 📱 Acceso Móvil - AranServices

## 🌐 Direcciones de Acceso

### En esta máquina (localhost)
- **Local**: http://localhost:3000

### Desde dispositivos móviles en la misma red WiFi
- **IP Principal**: http://192.168.1.100:3000
- **IP Alternativa**: http://192.168.56.1:3000

## 📋 Instrucciones para Acceso Móvil

### 1. Verificar Conectividad
- Asegúrate de que tu dispositivo móvil esté conectado a la misma red WiFi
- Red actual: La misma red que usa la IP 192.168.1.x

### 2. Acceder desde el Móvil
1. Abre el navegador web en tu dispositivo móvil
2. Escribe en la barra de direcciones: `http://192.168.1.100:3000`
3. Presiona Enter

### 3. Funcionalidades Móviles Disponibles
✅ Zoom nativo del navegador  
✅ Controles de zoom integrados (50% - 250%)  
✅ Interfaz optimizada para pantallas táctiles  
✅ Formulario completamente funcional  
✅ Captura y envío de imágenes  

## 🔧 Configuración del Servidor

```bash
# Comando para iniciar con acceso de red
npm run dev

# El servidor se inicia con:
# --hostname 0.0.0.0 (escucha en todas las interfaces)
```

## 🛡️ Seguridad de Red Local
- El acceso está limitado a dispositivos en la misma red WiFi
- No se requiere autenticación adicional para la red local
- Para producción, considera usar HTTPS y autenticación

## 📱 Prueba en Dispositivos
- **Android**: Chrome, Firefox, Samsung Internet
- **iOS**: Safari, Chrome
- **Tablets**: Cualquier navegador moderno

## 🔍 Solución de Problemas

### Si no puedes acceder:
1. Verifica que ambos dispositivos estén en la misma red
2. Asegúrate de que el firewall permita conexiones en el puerto 3000
3. Prueba con la IP alternativa: http://192.168.1.100:3000
4. Reinicia el servidor si es necesario

### Para verificar la IP actual:
```bash
ipconfig | findstr "IPv4"
```

---
*Última actualización: Configuración completada para acceso móvil optimizado* 🚀