# Favicon Setup para ARAN Tecnologías

## Archivos necesarios basados en tu logo:

Para implementar completamente el favicon, necesitas convertir tu imagen adjunta a estos tamaños y formatos:

### Archivos requeridos en /public/:

1. **favicon.ico** (16x16, 32x32, 48x48) - El favicon tradicional
2. **favicon-16x16.png** - Favicon pequeño
3. **favicon-32x32.png** - Favicon mediano  
4. **apple-touch-icon.png** (180x180) - Para dispositivos Apple
5. **android-chrome-192x192.png** - Para Android
6. **android-chrome-512x512.png** - Para Android (alta resolución)
7. **safari-pinned-tab.svg** - Para Safari (opcional, como SVG monocromático)

## Herramientas recomendadas para conversión:

### Online (Recomendado):
- **RealFaviconGenerator.net** - Sube tu imagen y genera todos los tamaños automáticamente
- **Favicon.io** - Otra herramienta online gratuita

### Usando código:
Si tienes ImageMagick instalado, puedes usar estos comandos:

```bash
# Crear favicon.ico con múltiples tamaños
convert aran-logo.png -resize 16x16 favicon-16.png
convert aran-logo.png -resize 32x32 favicon-32.png
convert aran-logo.png -resize 48x48 favicon-48.png
convert favicon-16.png favicon-32.png favicon-48.png favicon.ico

# Crear otros tamaños
convert aran-logo.png -resize 180x180 apple-touch-icon.png
convert aran-logo.png -resize 192x192 android-chrome-192x192.png
convert aran-logo.png -resize 512x512 android-chrome-512x512.png
```

## Estado actual:

✅ Configuración en layout.tsx actualizada
✅ Manifest de PWA creado
⏳ Pendiente: Convertir tu imagen adjunta a los formatos necesarios

## Próximos pasos:

1. Guarda tu imagen adjunta como archivo (ej: aran-logo.png)
2. Ve a https://realfavicongenerator.net/
3. Sube tu imagen
4. Descarga el paquete generado
5. Reemplaza los archivos en la carpeta /public/

Los archivos de configuración ya están listos para recibir tus favicons! 🚀