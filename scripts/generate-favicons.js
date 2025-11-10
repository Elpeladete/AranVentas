/**
 * Script para generar favicons desde el logo de Arán
 * Requiere: sharp (npm install sharp)
 * 
 * Uso: node scripts/generate-favicons.js
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const logoPath = path.join(publicDir, 'images', 'logo-aran.png');

// Verificar que existe el logo fuente
if (!fs.existsSync(logoPath)) {
  console.error('❌ Error: No se encontró el logo en public/images/logo-aran.png');
  console.log('📝 Por favor, guarda el logo en esa ubicación primero.');
  process.exit(1);
}

console.log('🚀 Generando favicons desde:', logoPath);

// Configuración de tamaños a generar
const sizes = [
  { name: 'favicon.ico', size: 32, format: 'png' }, // Se convertirá a .ico después
  { name: 'favicon-16x16.png', size: 16, format: 'png' },
  { name: 'favicon-32x32.png', size: 32, format: 'png' },
  { name: 'favicon-96x96.png', size: 96, format: 'png' },
  { name: 'apple-touch-icon.png', size: 180, format: 'png' },
  { name: 'web-app-manifest-192x192.png', size: 192, format: 'png' },
  { name: 'web-app-manifest-512x512.png', size: 512, format: 'png' },
];

async function generateFavicons() {
  try {
    console.log('📐 Generando íconos en diferentes tamaños...\n');

    for (const config of sizes) {
      const outputPath = path.join(publicDir, config.name);
      
      await sharp(logoPath)
        .resize(config.size, config.size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 } // Fondo transparente
        })
        .png()
        .toFile(outputPath);
      
      console.log(`✅ ${config.name} (${config.size}x${config.size})`);
    }

    // Generar también el favicon.ico desde el PNG de 32x32
    console.log('\n🔄 Generando favicon.ico...');
    const favicon32Path = path.join(publicDir, 'favicon-32x32.png');
    const faviconIcoPath = path.join(publicDir, 'favicon.ico');
    
    await sharp(logoPath)
      .resize(32, 32, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .toFile(faviconIcoPath);
    
    console.log('✅ favicon.ico generado');

    console.log('\n🎨 Generando favicon.svg...');
    // Para el SVG, vamos a crear uno optimizado manualmente
    const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="#ffffff" fill-opacity="0"/>
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" 
        font-family="system-ui, -apple-system, sans-serif" 
        font-size="400" font-weight="900" fill="#000000">Os</text>
  <rect x="40" y="240" width="60" height="32" fill="#8B9F2E"/>
</svg>`;
    
    fs.writeFileSync(path.join(publicDir, 'favicon.svg'), svgContent);
    console.log('✅ favicon.svg generado');

    console.log('\n✨ Todos los favicons generados exitosamente!');
    console.log('\n📋 Archivos generados:');
    console.log('   - favicon.ico (32x32)');
    console.log('   - favicon.svg (vectorial)');
    console.log('   - favicon-16x16.png');
    console.log('   - favicon-32x32.png');
    console.log('   - favicon-96x96.png');
    console.log('   - apple-touch-icon.png (180x180)');
    console.log('   - web-app-manifest-192x192.png');
    console.log('   - web-app-manifest-512x512.png');

  } catch (error) {
    console.error('❌ Error generando favicons:', error);
    process.exit(1);
  }
}

generateFavicons();
