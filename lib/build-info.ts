/**
 * Información de compilación generada automáticamente
 */

export interface BuildInfo {
  buildTime: string
  buildDate: string
  commitHash: string
  branch: string
  version: string
  environment: string
  buildId: string
  repositoryUrl?: string
  commitUrl?: string
  commitMessage?: string
  vercelUrl?: string
}

// Función para obtener información de build
export const getBuildInfo = (): BuildInfo => {
  // Intentar cargar información generada en build time
  let generatedInfo: any = null;
  try {
    generatedInfo = require('./build-info.generated').generatedBuildInfo;
  } catch (error) {
    // Fallback si no existe el archivo generado (desarrollo local)
  }
  
  const now = new Date()
  const fallbackTime = now.toISOString()
  const fallbackDate = now.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
  
  // Obtener información de variables de entorno de Vercel
  const commitHash = generatedInfo?.shortCommitSha ||
                     process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.substring(0, 7) || 
                     process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 7) || 
                     'local-dev'
  
  const branch = generatedInfo?.commitRef ||
                 process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF || 
                 process.env.VERCEL_GIT_COMMIT_REF || 
                 'main'
  
  const environment = generatedInfo?.vercelEnv ||
                      process.env.NEXT_PUBLIC_VERCEL_ENV ||
                      process.env.VERCEL_ENV ||
                      process.env.NODE_ENV || 
                      'development'
  
  const version = generatedInfo?.version || '0.1.0'
  
  return {
    buildTime: generatedInfo?.buildTime || fallbackTime,
    buildDate: generatedInfo?.buildDate || fallbackDate,
    commitHash,
    branch,
    version,
    environment,
    buildId: generatedInfo?.buildId || `${commitHash}-${fallbackTime.substring(0, 10)}`,
    repositoryUrl: generatedInfo?.repositoryUrl,
    commitUrl: generatedInfo?.commitUrl,
    commitMessage: generatedInfo?.commitMessage,
    vercelUrl: generatedInfo?.vercelUrl || process.env.NEXT_PUBLIC_VERCEL_URL || process.env.VERCEL_URL
  }
}

// Información estática generada al momento de compilación
export const buildInfo = getBuildInfo()