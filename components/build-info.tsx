"use client"

import React, { useState } from 'react'
import { buildInfo } from '@/lib/build-info'
import { useUpdateChecker } from '@/hooks/use-update-checker'
import { RefreshCw } from 'lucide-react'

interface BuildInfoDisplayProps {
  position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right'
  compact?: boolean
  className?: string
}

export function BuildInfoDisplay({ 
  position = 'bottom-right', 
  compact = true,
  className = '' 
}: BuildInfoDisplayProps) {
  const [expanded, setExpanded] = useState(false)
  const { updateAvailable, checkForUpdates, reloadApp } = useUpdateChecker()

  const positionClasses = {
    'bottom-left': 'bottom-2 left-2',
    'bottom-right': 'bottom-2 right-2',
    'top-left': 'top-2 left-2', 
    'top-right': 'top-2 right-2'
  }

  const formatBuildId = () => {
    return `${buildInfo.commitHash}-${buildInfo.buildTime.substring(0, 10)}`
  }

  if (compact && !expanded) {
    return (
      <div 
        className={`fixed ${positionClasses[position]} z-50 ${className}`}
        onClick={() => setExpanded(true)}
      >
        <div className="bg-gray-800 text-white text-xs px-2 py-1 rounded cursor-pointer hover:bg-gray-700 transition-colors relative">
          {updateAvailable && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
            </span>
          )}
          v{buildInfo.version} • {buildInfo.commitHash}
        </div>
      </div>
    )
  }

  return (
    <div className={`fixed ${positionClasses[position]} z-50 ${className}`}>
      <div className="bg-gray-900 text-white text-xs rounded-lg shadow-lg border border-gray-700 max-w-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
          <span className="font-semibold text-blue-400">Build Info</span>
          {compact && (
            <button
              onClick={() => setExpanded(false)}
              className="text-gray-400 hover:text-white ml-2"
            >
              ✕
            </button>
          )}
        </div>
        
        {/* Content */}
        <div className="px-3 py-2 space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-400">Versión:</span>
            <span className="text-green-400 font-mono">v{buildInfo.version}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-400">Commit:</span>
            <span className="text-blue-400 font-mono">{buildInfo.commitHash}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-400">Branch:</span>
            <span className="text-yellow-400 font-mono">{buildInfo.branch}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-400">Build:</span>
            <span className="text-purple-400 font-mono">{buildInfo.buildDate}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-400">Env:</span>
            <span className={`font-mono ${
              buildInfo.environment === 'production' ? 'text-red-400' : 
              buildInfo.environment === 'development' ? 'text-orange-400' : 'text-gray-400'
            }`}>
              {buildInfo.environment}
            </span>
          </div>
          
          {buildInfo.vercelUrl && (
            <div className="flex justify-between">
              <span className="text-gray-400">URL:</span>
              <span className="text-cyan-400 font-mono text-xs truncate max-w-32">
                {buildInfo.vercelUrl}
              </span>
            </div>
          )}
          
          <div className="pt-1 border-t border-gray-700">
            <div className="text-gray-500 text-center">
              Build ID: <span className="font-mono">{buildInfo.buildId}</span>
            </div>
            {buildInfo.commitMessage && (
              <div className="text-gray-600 text-xs text-center mt-1 truncate">
                "{buildInfo.commitMessage.substring(0, 30)}..."
              </div>
            )}
          </div>
          
          {/* Enlaces útiles */}
          {buildInfo.commitUrl && (
            <div className="pt-1 border-t border-gray-700">
              <div className="flex justify-center space-x-2">
                <a
                  href={buildInfo.commitUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 text-xs underline"
                >
                  Ver Commit
                </a>
                {buildInfo.repositoryUrl && (
                  <a
                    href={buildInfo.repositoryUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 text-xs underline"
                  >
                    Repositorio
                  </a>
                )}
              </div>
            </div>
          )}
          
          {/* Botón de actualización */}
          <div className="pt-2 border-t border-gray-700">
            {updateAvailable ? (
              <button
                onClick={reloadApp}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-1.5 px-3 rounded text-xs font-medium flex items-center justify-center gap-1 transition-colors"
              >
                <RefreshCw className="h-3 w-3" />
                Actualizar disponible
              </button>
            ) : (
              <button
                onClick={() => checkForUpdates(true)}
                className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 py-1.5 px-3 rounded text-xs font-medium flex items-center justify-center gap-1 transition-colors"
              >
                <RefreshCw className="h-3 w-3" />
                Buscar actualizaciones
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Hook para acceder a la información de build
export function useBuildInfo() {
  return buildInfo
}

// Función utilitaria para mostrar info rápida en consola
export function logBuildInfo() {
  console.group('🏗️ Build Information')
  console.log('Version:', buildInfo.version)
  console.log('Commit:', buildInfo.commitHash)
  console.log('Branch:', buildInfo.branch)
  console.log('Build Date:', buildInfo.buildDate)
  console.log('Environment:', buildInfo.environment)
  console.log('Build ID:', `${buildInfo.commitHash}-${buildInfo.buildTime.substring(0, 10)}`)
  console.groupEnd()
}