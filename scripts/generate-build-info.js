#!/usr/bin/env node

/**
 * Script de build personalizado para generar información de build
 * Se ejecuta automáticamente durante el proceso de build de Vercel
 */

const fs = require('fs');
const path = require('path');

function generateBuildInfo() {
  const now = new Date();
  const buildTime = now.toISOString();
  
  // Obtener información de Git y Vercel
  const buildInfo = {
    buildTime,
    buildDate: now.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: '2-digit',  
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }),
    // Variables de Vercel (disponibles durante el build)
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || 'local-dev',
    commitRef: process.env.VERCEL_GIT_COMMIT_REF || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF || 'main',
    commitMessage: process.env.VERCEL_GIT_COMMIT_MESSAGE || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_MESSAGE || 'Local development',
    repoOwner: process.env.VERCEL_GIT_REPO_OWNER || process.env.NEXT_PUBLIC_VERCEL_GIT_REPO_OWNER || 'Elpeladete',
    repoSlug: process.env.VERCEL_GIT_REPO_SLUG || process.env.NEXT_PUBLIC_VERCEL_GIT_REPO_SLUG || 'AranServices',
    vercelEnv: process.env.VERCEL_ENV || process.env.NEXT_PUBLIC_VERCEL_ENV || 'development',
    vercelUrl: process.env.VERCEL_URL || process.env.NEXT_PUBLIC_VERCEL_URL || 'localhost'
  };

  // Función para escapar strings de manera segura para TypeScript
  function escapeString(str) {
    return str
      .replace(/\\/g, '\\\\')    // Escapes backslashes
      .replace(/"/g, '\\"')      // Escapes double quotes
      .replace(/\n/g, '\\n')     // Escapes newlines
      .replace(/\r/g, '\\r')     // Escapes carriage returns
      .replace(/\t/g, '\\t')     // Escapes tabs
      .replace(/\u2028/g, '\\u2028') // Line separator
      .replace(/\u2029/g, '\\u2029'); // Paragraph separator
  }

  // Limpiar commit message para evitar problemas de sintaxis
  const cleanCommitMessage = escapeString(buildInfo.commitMessage || 'No commit message')
    .substring(0, 200); // Limitar longitud para evitar mensajes muy largos

  // Generar archivo de build info
  const buildInfoPath = path.join(__dirname, '..', 'lib', 'build-info.generated.ts');
  const buildInfoContent = `/**
 * Información de build generada automáticamente
 * Generado el: ${buildInfo.buildDate}
 * NO EDITAR - Este archivo se regenera en cada build
 */

export const generatedBuildInfo = {
  buildTime: "${buildInfo.buildTime}",
  buildDate: "${buildInfo.buildDate}",
  commitSha: "${buildInfo.commitSha}",
  commitRef: "${buildInfo.commitRef}",
  commitMessage: "${cleanCommitMessage}",
  repoOwner: "${buildInfo.repoOwner}",
  repoSlug: "${buildInfo.repoSlug}",
  vercelEnv: "${buildInfo.vercelEnv}",
  vercelUrl: "${buildInfo.vercelUrl}",
  shortCommitSha: "${buildInfo.commitSha.substring(0, 7)}",
  buildId: "${buildInfo.commitSha.substring(0, 7)}-${buildTime.substring(0, 10)}",
  repositoryUrl: "https://github.com/${buildInfo.repoOwner}/${buildInfo.repoSlug}",
  commitUrl: "https://github.com/${buildInfo.repoOwner}/${buildInfo.repoSlug}/commit/${buildInfo.commitSha}"
} as const;
`;

  // Crear directorio lib si no existe
  const libDir = path.join(__dirname, '..', 'lib');
  if (!fs.existsSync(libDir)) {
    fs.mkdirSync(libDir, { recursive: true });
  }

  // Escribir archivo
  fs.writeFileSync(buildInfoPath, buildInfoContent, 'utf8');
  
  console.log('✅ Build info generada exitosamente:');
  console.log(`   📅 Build Date: ${buildInfo.buildDate}`);
  console.log(`   🏷️  Commit: ${buildInfo.commitSha.substring(0, 7)}`);
  console.log(`   🌿 Branch: ${buildInfo.commitRef}`);
  console.log(`   🌍 Environment: ${buildInfo.vercelEnv}`);
  console.log(`   📝 File: ${buildInfoPath}`);
  
  return buildInfo;
}

// Ejecutar si se llama directamente
if (require.main === module) {
  generateBuildInfo();
}

module.exports = generateBuildInfo;