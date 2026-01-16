import { NextResponse } from 'next/server'
import { getBuildInfo } from '@/lib/build-info'

export async function GET() {
  try {
    const buildInfo = getBuildInfo()
    
    return NextResponse.json({
      success: true,
      buildInfo: {
        buildId: buildInfo.buildId,
        commitHash: buildInfo.commitHash,
        buildDate: buildInfo.buildDate,
        version: buildInfo.version,
        environment: buildInfo.environment
      }
    })
  } catch (error) {
    console.error('Error obteniendo build info:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener información de build' },
      { status: 500 }
    )
  }
}
