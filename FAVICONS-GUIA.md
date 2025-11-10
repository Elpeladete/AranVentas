# 🎨 Guía para Generar Favicons con el Logo ARAN

## ✅ Lo que ya está hecho:

1. **favicon.svg** - Logo vectorial creado con "Os" y guion verde
2. **safari-pinned-tab.svg** - Versión monocromática para Safari
3. **site.webmanifest** - Configurado con información de ARAN
4. **layout.tsx** - Actualizado con todos los íconos configurados
5. **generate-favicons.html** - Herramienta para generar PNG automáticamente

---

## 📝 Pasos para completar la instalación:

### Opción 1: Usar el Generador HTML (Recomendado)

1. **Abrir el generador:**
   ```
   http://localhost:3000/generate-favicons.html
   ```
   (cuando el servidor esté corriendo)

2. **Se generarán automáticamente:**
   - favicon-16x16.png
   - favicon-32x32.png
   - favicon-96x96.png
   - favicon.ico
   - apple-touch-icon.png (180x180)
   - web-app-manifest-192x192.png
   - web-app-manifest-512x512.png

3. **Descargar todos** los archivos usando el botón "📦 Descargar Todos"

4. **Reemplazar** los archivos en la carpeta `public/`

---

### Opción 2: Usar un Convertidor Online

Si no puedes iniciar el servidor, usa estos sitios:

1. **RealFaviconGenerator** (https://realfavicongenerator.net/)
   - Sube el archivo `public/favicon.svg`
   - Configura las opciones
   - Descarga el paquete generado
   - Extrae en la carpeta `public/`

2. **Favicon.io** (https://favicon.io/favicon-converter/)
   - Convierte el SVG a PNG grande primero
   - Sube la imagen PNG
   - Descarga los favicons generados

---

### Opción 3: Usar la Imagen que Compartiste

Si tienes la imagen PNG del logo "Os":

1. **Guardar** la imagen en `public/images/logo-aran.png`

2. **Instalar sharp** (cuando tengas internet):
   ```bash
   npm install --save-dev sharp --force
   ```

3. **Ejecutar el script:**
   ```bash
   node scripts/generate-favicons.js
   ```

---

## 🎯 Archivos que deben estar en `public/`:

```
public/
├── favicon.svg ✅ (ya creado)
├── favicon.ico ⏳ (generar)
├── favicon-16x16.png ⏳ (generar)
├── favicon-32x32.png ⏳ (generar)
├── favicon-96x96.png ✅ (ya existe, reemplazar)
├── apple-touch-icon.png ✅ (ya existe, reemplazar)
├── safari-pinned-tab.svg ✅ (ya creado)
├── web-app-manifest-192x192.png ✅ (ya existe, reemplazar)
├── web-app-manifest-512x512.png ✅ (ya existe, reemplazar)
└── site.webmanifest ✅ (ya actualizado)
```

---

## 🔍 Verificar que funciona:

1. **Iniciar el servidor:**
   ```bash
   pnpm dev
   ```

2. **Abrir en el navegador:**
   ```
   http://localhost:3000
   ```

3. **Verificar el favicon:**
   - En la pestaña del navegador deberías ver el logo "Os"
   - En favoritos se verá el ícono
   - En dispositivos móviles al agregar a inicio

4. **Probar en diferentes navegadores:**
   - Chrome/Edge (usa favicon.svg o favicon.ico)
   - Firefox (usa favicon.svg o favicon.ico)
   - Safari (usa safari-pinned-tab.svg + apple-touch-icon)
   - Safari iOS (usa apple-touch-icon.png)

---

## 🎨 Personalización del Logo:

Si quieres ajustar el logo, edita `public/favicon.svg`:

```svg
<!-- Cambiar color del guion verde -->
<rect ... fill="#8B9F2E" />  <!-- Cambia este color -->

<!-- Cambiar texto -->
<text ...>Os</text>  <!-- Cambia el texto aquí -->

<!-- Cambiar tamaño de fuente -->
font-size="380"  <!-- Ajusta este valor -->
```

---

## 📱 PWA (Progressive Web App):

El `site.webmanifest` ya está configurado para que la app se pueda:
- Instalar en el escritorio
- Agregar a la pantalla de inicio en móviles
- Funcionar offline

---

## 🚀 Siguientes pasos:

1. [ ] Generar los archivos PNG faltantes
2. [ ] Reemplazar los PNG existentes con el nuevo logo
3. [ ] Probar en diferentes navegadores
4. [ ] Hacer commit de los cambios
5. [ ] Push a producción

---

**¿Necesitas ayuda?** El generador HTML en `public/generate-favicons.html` hace todo automáticamente cuando el servidor esté corriendo.
