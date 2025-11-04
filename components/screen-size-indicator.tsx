"use client"

import React, { useState, useEffect } from 'react'

interface ScreenSizeIndicatorProps {
  position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right'
  compact?: boolean
  className?: string
}

export function ScreenSizeIndicator({ 
  position = 'top-right', 
  compact = true,
  className = '' 
}: ScreenSizeIndicatorProps) {
  const [screenSize, setScreenSize] = useState({ width: 0, height: 0 })
  const [expanded, setExpanded] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    
    const updateSize = () => {
      setScreenSize({
        width: window.innerWidth,
        height: window.innerHeight
      })
    }

    // Actualizar al montar
    updateSize()

    // Actualizar cuando cambia el tamaño
    window.addEventListener('resize', updateSize)
    window.addEventListener('orientationchange', updateSize)

    return () => {
      window.removeEventListener('resize', updateSize)
      window.removeEventListener('orientationchange', updateSize)
    }
  }, [])

  const positionClasses = {
    'bottom-left': 'bottom-2 left-2',
    'bottom-right': 'bottom-2 right-2',
    'top-left': 'top-2 left-2', 
    'top-right': 'top-2 right-2'
  }

  const getDeviceType = () => {
    const width = screenSize.width
    if (width < 640) return { name: 'Mobile', color: 'text-green-400', icon: '📱' }
    if (width < 768) return { name: 'Phablet', color: 'text-blue-400', icon: '📱' }
    if (width < 1024) return { name: 'Tablet', color: 'text-yellow-400', icon: '📱' }
    if (width < 1280) return { name: 'Laptop', color: 'text-purple-400', icon: '💻' }
    if (width < 1536) return { name: 'Desktop', color: 'text-cyan-400', icon: '🖥️' }
    return { name: 'Large', color: 'text-red-400', icon: '🖥️' }
  }

  const getTailwindBreakpoint = () => {
    const width = screenSize.width
    if (width < 640) return { name: 'xs', color: 'text-green-400' }
    if (width < 768) return { name: 'sm', color: 'text-blue-400' }
    if (width < 1024) return { name: 'md', color: 'text-yellow-400' }
    if (width < 1280) return { name: 'lg', color: 'text-purple-400' }
    if (width < 1536) return { name: 'xl', color: 'text-cyan-400' }
    return { name: '2xl', color: 'text-red-400' }
  }

  const getOrientation = () => {
    if (!isMounted) return 'landscape'
    return screenSize.width > screenSize.height ? 'landscape' : 'portrait'
  }

  const getAspectRatio = () => {
    if (screenSize.width === 0 || screenSize.height === 0) return '0:0'
    const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b)
    const divisor = gcd(screenSize.width, screenSize.height)
    return `${screenSize.width / divisor}:${screenSize.height / divisor}`
  }

  // No renderizar hasta que esté montado en el cliente
  if (!isMounted) {
    return null
  }

  const deviceType = getDeviceType()
  const breakpoint = getTailwindBreakpoint()
  const orientation = getOrientation()
  const aspectRatio = getAspectRatio()

  if (compact && !expanded) {
    return (
      <div 
        className={`fixed ${positionClasses[position]} z-50 ${className}`}
        onClick={() => setExpanded(true)}
      >
        <div className="bg-gray-800 text-white text-xs px-2 py-1 rounded cursor-pointer hover:bg-gray-700 transition-colors font-mono">
          {screenSize.width}×{screenSize.height}
        </div>
      </div>
    )
  }

  return (
    <div className={`fixed ${positionClasses[position]} z-50 ${className}`}>
      <div className="bg-gray-900 text-white text-xs rounded-lg shadow-lg border border-gray-700 max-w-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
          <span className="font-semibold text-cyan-400">Screen Info</span>
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
            <span className="text-gray-400">Resolución:</span>
            <span className={`${deviceType.color} font-mono font-semibold`}>
              {screenSize.width}×{screenSize.height}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-400">Dispositivo:</span>
            <span className={`${deviceType.color} font-mono`}>
              {deviceType.icon} {deviceType.name}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-400">Breakpoint:</span>
            <span className={`${breakpoint.color} font-mono font-semibold`}>
              {breakpoint.name}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-400">Orientación:</span>
            <span className="text-purple-400 font-mono">
              {orientation === 'landscape' ? '🖼️' : '📱'} {orientation}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-400">Aspecto:</span>
            <span className="text-yellow-400 font-mono">
              {aspectRatio}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-400">DPR:</span>
            <span className="text-green-400 font-mono">
              {window.devicePixelRatio}×
            </span>
          </div>

          {/* Breakpoints Reference */}
          <div className="pt-1 border-t border-gray-700 mt-2">
            <div className="text-gray-500 text-[10px] space-y-0.5">
              <div className="flex justify-between">
                <span>xs (&lt;640px)</span>
                <span className="text-green-400">Mobile</span>
              </div>
              <div className="flex justify-between">
                <span>sm (640px+)</span>
                <span className="text-blue-400">Phablet</span>
              </div>
              <div className="flex justify-between">
                <span>md (768px+)</span>
                <span className="text-yellow-400">Tablet</span>
              </div>
              <div className="flex justify-between">
                <span>lg (1024px+)</span>
                <span className="text-purple-400">Laptop</span>
              </div>
              <div className="flex justify-between">
                <span>xl (1280px+)</span>
                <span className="text-cyan-400">Desktop</span>
              </div>
              <div className="flex justify-between">
                <span>2xl (1536px+)</span>
                <span className="text-red-400">Large</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Hook para acceder al tamaño de pantalla
export function useScreenSize() {
  const [screenSize, setScreenSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const updateSize = () => {
      setScreenSize({
        width: window.innerWidth,
        height: window.innerHeight
      })
    }

    updateSize()
    window.addEventListener('resize', updateSize)
    window.addEventListener('orientationchange', updateSize)

    return () => {
      window.removeEventListener('resize', updateSize)
      window.removeEventListener('orientationchange', updateSize)
    }
  }, [])

  return screenSize
}
