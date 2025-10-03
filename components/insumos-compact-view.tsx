"use client"

import React from 'react'

interface InsumosCompactViewProps {
  value: string
}

export function InsumosCompactView({ value }: InsumosCompactViewProps) {
  try {
    const lines = value.split('|').filter(line => line.trim())
    
    if (lines.length === 0) {
      return (
        <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
          Sin insumos registrados
        </div>
      )
    }
    
    return (
      <div className="w-full h-full overflow-hidden bg-transparent">
        {/* Filas de datos - sin header, ya que está en la imagen de fondo */}
        <div className="max-h-[200px] overflow-y-auto">
          {lines.slice(0, 14).map((line, idx) => {
            const parts = line.split(';')
            return (
              <div key={idx} className="grid gap-px bg-transparent" style={{ gridTemplateColumns: '1fr 3.5fr 3.5fr 4fr 2fr' }}>
                {/* Cantidad - 50% más pequeña - Justificada a la izquierda */}
                <div className="bg-white/90 px-1 py-0.5 text-xs truncate text-left font-medium border border-gray-200 leading-none">
                  {parts[0] || ''}
                </div>
                {/* N° de Serie - Tamaño normal - Justificada a la derecha */}
                <div className="bg-white/90 px-1 py-0.5 text-xs truncate text-right border border-gray-200 leading-none">
                  {parts[1] || ''}
                </div>
                {/* Código - Mismo tamaño que Serie - Justificada a la derecha */}
                <div className="bg-white/90 px-1 py-0.5 text-xs truncate text-right border border-gray-200 leading-none">
                  {parts[2] || ''}
                </div>
                {/* Artículo - Expandida con texto en múltiples líneas */}
                <div className="bg-white/90 px-1 py-0.5 text-xs text-left border border-gray-200 leading-tight">
                  <div className="break-words whitespace-normal overflow-hidden max-h-6">
                    {parts[3] || ''}
                  </div>
                </div>
                {/* Precio - Tamaño normal - Justificada a la derecha */}
                <div className="bg-white/90 px-1 py-0.5 text-xs truncate text-right font-semibold text-green-700 border border-gray-200 leading-none">
                  {parts[4] ? (() => {
                    const price = parseFloat(parts[4])
                    return isNaN(price) ? parts[4] : `$${price.toFixed(2)}`
                  })() : ''}
                </div>
              </div>
            )
          })}
          
          {/* Indicador de más elementos */}
          {lines.length > 14 && (
            <div className="text-center text-xs text-blue-600 py-0.5 bg-blue-50/80 border border-gray-200">
              +{lines.length - 14} item{lines.length - 14 !== 1 ? 's' : ''} más
            </div>
          )}
        </div>
        
        {/* Footer discreto con resumen y subtotal */}
        <div className="bg-black/10 px-1 py-0.5 text-xs text-gray-800 border-t border-gray-300">
          <div className="flex justify-between items-center">
            <span className="font-medium">
              {lines.length} insumo{lines.length !== 1 ? 's' : ''}
            </span>
            <span className="font-bold text-green-700">
              Subtotal: ${(() => {
                const total = lines.reduce((sum, line) => {
                  const parts = line.split(';')
                  const price = parseFloat(parts[4]) || 0
                  return sum + price
                }, 0)
                return total.toFixed(2)
              })()}
            </span>
          </div>
        </div>
      </div>
    )
  } catch (error) {
    return (
      <div className="w-full h-full flex items-center justify-center text-red-500 text-xs">
        Error al mostrar insumos
      </div>
    )
  }
}