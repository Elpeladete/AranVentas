# ARAN Tecnologías - Sistema de Órdenes de Servicio

Sistema digital completo para gestión de órdenes de servicio técnico con integración WhatsApp y funcionalidades offline.

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/arantecnologias/v0-form-app-with-image)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.app-black?style=for-the-badge)](https://v0.app/chat/projects/NksaJvZMJ5a)

## 🚀 Características Principales

### ✅ Formulario Visual Interactivo
- 📋 Formulario superpuesto sobre imagen real de orden de servicio
- 🎯 Áreas clickeables precisas para edición de campos
- 📱 Optimizado para móvil con zoom 50%-250%
- 🖼️ Captura de imagen completa con todos los datos

### ✅ Integración WhatsApp
- 📲 **Wazzup API**: Envío automático de órdenes por WhatsApp
- 🌐 **Fallback**: WhatsApp Web con mensaje pre-rellenado
- 📎 Adjunto automático de imagen de orden completa
- 👤 Envío directo al teléfono del cliente

### ✅ Gestión Offline
- 💾 Base de datos local con IndexedDB
- 🔄 Sincronización automática cuando hay conexión
- 📊 Visualización de órdenes pendientes y enviadas
- 💿 Exportación/importación de datos

### ✅ Validaciones Inteligentes
- 🎯 Validación por grupos de servicios
- 📝 Campos obligatorios y opcionales
- ✍️ Firmas digitales con subida automática
- 🔍 Verificación de CUIT argentino

### ✅ Tecnología Moderna
- ⚡ Next.js 14 con React Server Components
- 🎨 TailwindCSS + shadcn/ui
- 📱 Diseño responsivo y PWA-ready
- 🔧 TypeScript para robustez

## 🚀 Instalación y Configuración

### 1. Instalación
```bash
# Clonar repositorio
git clone [url-del-repositorio]
cd AranServices

# Instalar dependencias
npm install

# Ejecutar en desarrollo
npm run dev
```

### 2. Configuración de WhatsApp (Wazzup API)
```bash
# Ver guía detallada
cat WAZZUP-SETUP.md

# Probar configuración
# Abrir consola del navegador (F12) y ejecutar:
# - Copiar y pegar contenido de test-wazzup-console.js
# - Configurar TOKEN y teléfono de prueba
# - Ejecutar testWazzupConnection()
```

### 3. Configuración de Red para Móviles
```bash
# Ver guías de configuración
cat MOBILE-ACCESS-GUIDE.md
cat NETWORK-ACCESS.md

# Servidor local para PC
npm run dev                    # http://localhost:3000

# Servidor para acceso móvil
npm run dev-network           # http://[IP-LOCAL]:3000
```

## 📱 Uso del Sistema

### Flujo Principal
1. **Completar Formulario**: Click en áreas de la imagen para editar campos
2. **Firmas Digitales**: Áreas especiales para firma de técnico y cliente
3. **Validación**: Sistema verifica campos obligatorios automáticamente
4. **Captura y Envío**: 
   - Se genera imagen PNG de la orden completa
   - Se sube a ImgBB para obtener URL pública
   - Se envía automáticamente por WhatsApp al cliente
   - Se guarda en base de datos local

### Campos del Formulario
- **Datos Cliente**: Razón social, CUIT, contacto, teléfono
- **Servicios**: Técnico, instalación, puesta en marcha, calibración, etc.
- **Ubicación**: Campo/Oficina, con cargo/sin cargo/garantía
- **Descripción**: Máquina, equipo, descripción completa del trabajo
- **Insumos**: Lista de materiales y equipos utilizados
- **Logística**: Localidad, provincia, distancia, duración
- **Facturación**: Tipo de cambio, IVA, total
- **Firmas**: Técnico y cliente con subida automática

### Funciones Avanzadas
- **🔄 Auto-guardado**: Cada 30 segundos
- **📱 Zoom móvil**: Controles de zoom para facilitar edición
- **🎯 Posicionamiento inteligente**: Overlays nunca se ocultan tras bordes
- **💾 Offline**: Funciona sin internet, sincroniza automáticamente
- **🗃️ Base de datos**: Visualización de todas las órdenes guardadas

## 🛠️ Deployment

### Desarrollo Local
```bash
npm run dev          # Servidor local
npm run build        # Build de producción
npm run start        # Servidor de producción
```

### Producción en Vercel
- **URL Live**: [https://vercel.com/arantecnologias/v0-form-app-with-image](https://vercel.com/arantecnologias/v0-form-app-with-image)
- **Auto-deployment** desde main branch
- **Variables de entorno** para configuración de APIs

## 📋 Archivos de Configuración

| Archivo | Descripción |
|---------|-------------|
| `WAZZUP-SETUP.md` | Configuración completa de WhatsApp API |
| `MOBILE-ACCESS-GUIDE.md` | Guía de acceso móvil |
| `NETWORK-ACCESS.md` | Configuración de red local |
| `FAVICON-SETUP.md` | Configuración de favicon personalizado |
| `test-wazzup-console.js` | Script de prueba para Wazzup |
| `test-imgbb-console.js` | Script de prueba para ImgBB |

## 🔧 Tecnologías Utilizadas

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: TailwindCSS, shadcn/ui, Lucide icons
- **Storage**: IndexedDB (Dexie.js), LocalStorage
- **APIs**: Wazzup WhatsApp, ImgBB, Google Forms
- **Canvas**: html2canvas para captura de imágenes
- **Mobile**: PWA-ready, responsive design
