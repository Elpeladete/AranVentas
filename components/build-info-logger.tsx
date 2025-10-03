"use client"

import { useEffect } from 'react'
import { logBuildInfo } from '@/components/build-info'

export function BuildInfoLogger() {
  useEffect(() => {
    // Mostrar información de build en la consola al cargar la aplicación
    logBuildInfo()
  }, [])

  return null
}