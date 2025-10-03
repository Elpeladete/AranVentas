"use client"

import React, { useState, useEffect } from 'react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { InsumoAutocomplete } from "@/components/insumo-autocomplete"
import { ArticuloAutocomplete } from "@/components/articulo-autocomplete"
import type { InsumoData } from "@/lib/insumos-search"

interface InsumoRow {
  cantidad: string
  numeroSerie: string
  codigo: string
  articulo: string
  precioNeto: string
}

interface InsumosTableProps {
  value: string
  onChange: (value: string) => void
  className?: string
}

export function InsumosTable({ value, onChange, className = "" }: InsumosTableProps) {
  // Inicializar con 12 filas vacías
  const [rows, setRows] = useState<InsumoRow[]>(() => {
    // Si hay un valor existente, intentar parsearlo
    if (value && value.trim()) {
      try {
        // Parsear el valor existente (formato: cantidad;serie;codigo;articulo;precio|cantidad2;serie2...)
        const lines = value.split('|').filter(line => line.trim())
        const parsedRows = lines.map(line => {
          const parts = line.split(';')
          return {
            cantidad: parts[0] || '',
            numeroSerie: parts[1] || '',
            codigo: parts[2] || '',
            articulo: parts[3] || '',
            precioNeto: parts[4] || ''
          }
        })
        
        // Completar hasta 12 filas
        while (parsedRows.length < 12) {
          parsedRows.push({
            cantidad: '',
            numeroSerie: '',
            codigo: '',
            articulo: '',
            precioNeto: ''
          })
        }
        
        return parsedRows
      } catch (error) {
        console.error('Error parseando insumos:', error)
      }
    }
    
    // Crear 12 filas vacías por defecto
    return Array.from({ length: 12 }, () => ({
      cantidad: '',
      numeroSerie: '',
      codigo: '',
      articulo: '',
      precioNeto: ''
    }))
  })

    // Actualizar el valor concatenado cada vez que cambian las filas
  useEffect(() => {
    const concatenatedValue = rows
      .filter(row => 
        row.cantidad.trim() || 
        row.numeroSerie.trim() || 
        row.codigo.trim() || 
        row.articulo.trim() || 
        row.precioNeto.trim()
      )
      .map(row => `${row.cantidad};${row.numeroSerie};${row.codigo};${row.articulo};${row.precioNeto}`)
      .join('|')
    
    // Log para verificar el envío de datos
    console.log('📊 InsumosTable: Datos concatenados para envío:', {
      rowsCount: rows.filter(row => 
        row.cantidad.trim() || 
        row.numeroSerie.trim() || 
        row.codigo.trim() || 
        row.articulo.trim() || 
        row.precioNeto.trim()
      ).length,
      concatenatedValue: concatenatedValue,
      rawRows: rows.slice(0, 3) // Solo las primeras 3 filas para no spam
    })
    
    onChange(concatenatedValue)
  }, [rows, onChange])

  const updateCell = (rowIndex: number, field: keyof InsumoRow, value: string) => {
    // Aplicar validaciones según el tipo de campo
    let validatedValue = value
    
    if (field === 'cantidad') {
      // Solo números enteros positivos
      validatedValue = value.replace(/[^\d]/g, '')
    } else if (field === 'precioNeto') {
      // Solo números con hasta 2 decimales (formato moneda)
      validatedValue = value.replace(/[^\d.,]/g, '').replace(',', '.')
      
      // Limitar a 2 decimales
      const parts = validatedValue.split('.')
      if (parts.length > 2) {
        validatedValue = parts[0] + '.' + parts[1]
      }
      if (parts[1] && parts[1].length > 2) {
        validatedValue = parts[0] + '.' + parts[1].substring(0, 2)
      }
    }
    // Los campos numeroSerie, codigo y articulo no necesitan validación especial (texto libre)
    
    setRows(prevRows => {
      const newRows = [...prevRows]
      newRows[rowIndex] = { ...newRows[rowIndex], [field]: validatedValue }
      return newRows
    })
  }

  const handleInsumoSelect = (rowIndex: number, insumo: InsumoData) => {
    setRows(prevRows => {
      const newRows = [...prevRows]
      newRows[rowIndex] = {
        ...newRows[rowIndex],
        codigo: insumo.codigoOriginal,
        articulo: insumo.descripcion,
        precioNeto: insumo.precioEstimado.toString()
      }
      return newRows
    })
    
    console.log('🎯 Insumo seleccionado desde código:', {
      rowIndex,
      codigo: insumo.codigoOriginal,
      descripcion: insumo.descripcion,
      precio: insumo.precioEstimado
    })
  }

  const handleArticuloSelect = (rowIndex: number, insumo: InsumoData) => {
    setRows(prevRows => {
      const newRows = [...prevRows]
      newRows[rowIndex] = {
        ...newRows[rowIndex],
        codigo: insumo.codigoOriginal,
        articulo: insumo.descripcion,
        precioNeto: insumo.precioEstimado.toString()
      }
      return newRows
    })
    
    console.log('🎯 Insumo seleccionado desde descripción:', {
      rowIndex,
      codigo: insumo.codigoOriginal,
      descripcion: insumo.descripcion,
      precio: insumo.precioEstimado
    })
  }

  const clearRow = (rowIndex: number) => {
    setRows(prevRows => {
      const newRows = [...prevRows]
      newRows[rowIndex] = {
        cantidad: '',
        numeroSerie: '',
        codigo: '',
        articulo: '',
        precioNeto: ''
      }
      return newRows
    })
  }

  const addRow = () => {
    setRows(prevRows => [
      ...prevRows,
      {
        cantidad: '',
        numeroSerie: '',
        codigo: '',
        articulo: '',
        precioNeto: ''
      }
    ])
  }

  return (
    <div className={`w-full ${className}`}>
      {/* Header de la tabla */}
      <div className="mb-2">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Insumos y Equipos</h3>
        <p className="text-xs text-gray-500">Complete los datos de los insumos utilizados</p>
      </div>

      {/* Tabla */}
      <div className="border border-gray-300 rounded-lg overflow-hidden">
        {/* Header Row */}
        <div className="grid bg-gray-100 border-b border-gray-300" style={{ gridTemplateColumns: '1fr 2.6fr 2.6fr 4fr 2fr' }}>
          <div className="p-2 text-xs font-semibold text-gray-700 border-r border-gray-300">
            Cantidad
          </div>
          <div className="p-2 text-xs font-semibold text-gray-700 border-r border-gray-300">
            N° de Serie
          </div>
          <div className="p-2 text-xs font-semibold text-gray-700 border-r border-gray-300">
            Código
          </div>
          <div className="p-2 text-xs font-semibold text-gray-700 border-r border-gray-300">
            Artículo
          </div>
          <div className="p-2 text-xs font-semibold text-gray-700">
            Precio Neto
          </div>
        </div>

        {/* Data Rows */}
        <div className="max-h-56 overflow-y-auto">
          {rows.map((row, rowIndex) => (
            <div key={rowIndex} className="grid border-b border-gray-200 hover:bg-gray-50 items-start" style={{ gridTemplateColumns: '1fr 2.6fr 2.6fr 4fr 2fr', minHeight: '1.75rem' }}>
              <div className="border-r border-gray-200 flex items-start">
                <Input
                  value={row.cantidad}
                  onChange={(e) => updateCell(rowIndex, 'cantidad', e.target.value)}
                  placeholder="0"
                  className="border-0 rounded-none text-xs min-h-7 focus:ring-1 focus:ring-blue-500 text-left"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  title="Solo números enteros"
                />
              </div>
              <div className="border-r border-gray-200 flex items-start">
                <Input
                  value={row.numeroSerie}
                  onChange={(e) => updateCell(rowIndex, 'numeroSerie', e.target.value)}
                  placeholder="ABC123"
                  className="border-0 rounded-none text-xs min-h-7 focus:ring-1 focus:ring-blue-500 text-right"
                  type="text"
                  title="Número de serie (alfanumérico)"
                />
              </div>
              <div className="border-r border-gray-200">
                <InsumoAutocomplete
                  value={row.codigo}
                  onChange={(value) => updateCell(rowIndex, 'codigo', value)}
                  onSelect={(insumo) => handleInsumoSelect(rowIndex, insumo)}
                  placeholder="Buscar código..."
                  className="border-0 rounded-none text-xs focus:ring-1 focus:ring-blue-500 text-right w-full"
                />
              </div>
              <div className="border-r border-gray-200">
                <ArticuloAutocomplete
                  value={row.articulo}
                  onChange={(value) => updateCell(rowIndex, 'articulo', value)}
                  onSelect={(insumo) => handleArticuloSelect(rowIndex, insumo)}
                  placeholder="Buscar descripción..."
                  className="border-0 rounded-none text-xs p-1 focus:ring-1 focus:ring-blue-500 text-left resize-none overflow-hidden w-full"
                />
              </div>
              <div className="flex items-start">
                <Input
                  value={row.precioNeto}
                  onChange={(e) => updateCell(rowIndex, 'precioNeto', e.target.value)}
                  placeholder="0.00"
                  className="border-0 rounded-none text-xs min-h-7 focus:ring-1 focus:ring-blue-500 text-right flex-1"
                  type="text"
                  inputMode="decimal"
                  title="Precio en formato 0.00 (máximo 2 decimales)"
                />
                {rowIndex < 12 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => clearRow(rowIndex)}
                    className="h-7 w-7 p-0 hover:bg-red-50 hover:text-red-600"
                    title="Limpiar fila"
                  >
                    ×
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer con subtotal */}
      <div className="bg-gray-50 border-t border-gray-300 p-2">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">
            Total de items: {rows.filter(row => 
              row.cantidad.trim() || 
              row.numeroSerie.trim() || 
              row.codigo.trim() || 
              row.articulo.trim() || 
              row.precioNeto.trim()
            ).length}
          </span>
          <span className="text-sm font-bold text-green-700">
            Subtotal: ${(() => {
              const total = rows.reduce((sum, row) => {
                const price = parseFloat(row.precioNeto) || 0
                return sum + price
              }, 0)
              return total.toFixed(2)
            })()}
          </span>
        </div>
      </div>

      {/* Botones de acción */}
      <div className="mt-2 flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addRow}
          className="text-xs"
        >
          ➕ Agregar fila
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setRows(Array.from({ length: 12 }, () => ({
            cantidad: '',
            numeroSerie: '',
            codigo: '',
            articulo: '',
            precioNeto: ''
          })))}
          className="text-xs text-red-600 hover:text-red-700"
        >
          🗑️ Limpiar todo
        </Button>
      </div>

      {/* Debug info (solo en desarrollo) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
          <strong>Debug:</strong> {value || 'Sin datos'}
        </div>
      )}
    </div>
  )
}