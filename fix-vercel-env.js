/**
 * Script para configurar variables de entorno en Vercel sin line breaks
 * Usar: node fix-vercel-env.js
 */

const { execSync } = require('child_process');

// Valores sin line breaks
const variables = [
  { name: 'ODOO_URL', value: 'https://arantecnologias.odoo.com' },
  { name: 'ODOO_DB', value: 'arantecnologias' },
  { name: 'ODOO_USERNAME', value: 'martinaused@arantecnologias.com.ar' },
  { name: 'NEXT_PUBLIC_ODOO_URL', value: 'https://arantecnologias.odoo.com' },
  { name: 'NEXT_PUBLIC_ODOO_DB', value: 'arantecnologias' },
  { name: 'NEXT_PUBLIC_ODOO_USERNAME', value: 'martinaused@arantecnologias.com.ar' },
];

const environments = ['production', 'preview', 'development'];

console.log('🔧 Eliminando variables existentes...\n');

// Eliminar variables existentes
for (const variable of variables) {
  for (const env of environments) {
    try {
      execSync(`vercel env rm ${variable.name} ${env} --yes`, { 
        stdio: 'inherit',
        encoding: 'utf-8'
      });
    } catch (error) {
      // Ignorar si no existe
    }
  }
}

console.log('\n✅ Variables eliminadas\n');
console.log('📝 Creando variables nuevas...\n');

// Crear variables nuevas
for (const variable of variables) {
  for (const env of environments) {
    try {
      console.log(`   Creando ${variable.name} en ${env}...`);
      
      // Usar printf en lugar de echo para evitar line breaks
      const command = process.platform === 'win32'
        ? `echo|set /p="${variable.value}" | vercel env add ${variable.name} ${env}`
        : `printf '%s' "${variable.value}" | vercel env add ${variable.name} ${env}`;
      
      execSync(command, { 
        stdio: 'inherit',
        encoding: 'utf-8',
        shell: 'cmd.exe' // Usar cmd.exe en Windows
      });
      
    } catch (error) {
      console.error(`❌ Error en ${variable.name} ${env}:`, error.message);
    }
  }
}

console.log('\n✅ Variables configuradas correctamente');
console.log('\n📦 Creando nuevo deployment...\n');

try {
  execSync('vercel', { stdio: 'inherit' });
  console.log('\n✅ Deployment completado');
} catch (error) {
  console.error('❌ Error en deployment:', error.message);
}
