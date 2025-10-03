import React, { useState, useEffect, useRef } from 'react'
import { searchInsumos, type InsumoData } from '@/lib/insumos-search'

interface ArticuloAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onSelect: (insumo: InsumoData) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function ArticuloAutocomplete({ 
  value, 
  onChange, 
  onSelect, 
  placeholder = "Buscar descripción...",
  className = "",
  disabled = false
}: ArticuloAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<InsumoData[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  
  // Buscar sugerencias cuando cambia el valor
  useEffect(() => {
    const performSearch = async () => {
      if (value.length < 3) {
        setSuggestions([])
        setShowSuggestions(false)
        return
      }
      
      setLoading(true)
      try {
        const results = await searchInsumos(value)
        setSuggestions(results)
        setShowSuggestions(results.length > 0)
        setSelectedIndex(-1)
      } catch (error) {
        console.error('Error buscando insumos por descripción:', error)
        setSuggestions([])
        setShowSuggestions(false)
      } finally {
        setLoading(false)
      }
    }
    
    // Debounce la búsqueda
    const timeoutId = setTimeout(performSearch, 300)
    return () => clearTimeout(timeoutId)
  }, [value])
  
  // Manejar selección con teclado
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1)
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0) {
          handleSelectSuggestion(suggestions[selectedIndex])
        }
        break
      case 'Escape':
        setShowSuggestions(false)
        setSelectedIndex(-1)
        break
    }
  }
  
  // Manejar selección de sugerencia
  const handleSelectSuggestion = (insumo: InsumoData) => {
    onSelect(insumo)
    setShowSuggestions(false)
    setSelectedIndex(-1)
  }
  
  // Cerrar sugerencias al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        textareaRef.current && 
        !textareaRef.current.contains(event.target as Node) &&
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  return (
    <div className="relative">
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`${className} ${loading ? 'pr-8' : ''}`}
          disabled={disabled}
          rows={1}
          style={{ 
            lineHeight: '1.2',
            whiteSpace: 'normal',
            wordWrap: 'break-word'
          }}
        />
        
        {loading && (
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>
      
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto"
        >
          {suggestions.map((insumo, index) => (
            <button
              key={`${insumo.codigoOriginal}-${index}`}
              onClick={() => handleSelectSuggestion(insumo)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 focus:bg-blue-50 focus:outline-none ${
                index === selectedIndex ? 'bg-blue-100' : ''
              }`}
            >
              <div className="font-medium text-gray-900">
                {insumo.codigoOriginal}
              </div>
              <div className="text-gray-600 truncate">
                {insumo.descripcion}
              </div>
              <div className="text-green-600 text-xs">
                Precio estimado: ${new Intl.NumberFormat('es-CL', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0
                }).format(insumo.precioEstimado)}
              </div>
            </button>
          ))}
        </div>
      )}
      
      {showSuggestions && suggestions.length === 0 && value.length >= 3 && !loading && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-3">
          <div className="text-sm text-gray-500 text-center">
            No se encontraron artículos para "{value}"
          </div>
        </div>
      )}
    </div>
  )
}