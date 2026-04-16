import React, { useState, useEffect, useRef } from 'react'
import { searchBySerialNumber, type InsumoData } from '@/lib/insumos-search'

interface SerieAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onSelect: (insumo: InsumoData) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  suppressSearch?: boolean
}

export function SerieAutocomplete({ 
  value, 
  onChange, 
  onSelect, 
  placeholder = "Buscar serie...",
  className = "",
  disabled = false,
  suppressSearch = false
}: SerieAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<InsumoData[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [, forceUpdate] = useState(0)
  const [searchTrigger, setSearchTrigger] = useState(0) // Se incrementa solo cuando el usuario escribe
  
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const userTypingRef = useRef(false) // true solo cuando el usuario está escribiendo manualmente
  
  // Handler para cambios manuales del usuario (no programáticos)
  const handleUserInput = (newValue: string) => {
    userTypingRef.current = true
    onChange(newValue)
    setSearchTrigger(prev => prev + 1)
  }
  
  // Buscar sugerencias solo cuando el usuario escribe manualmente
  useEffect(() => {
    if (searchTrigger === 0) return // No buscar en el render inicial
    
    const performSearch = async () => {
      if (!userTypingRef.current || suppressSearch) {
        return
      }
      
      if (value.length < 3) {
        setSuggestions([])
        setShowSuggestions(false)
        return
      }
      
      setLoading(true)
      try {
        const results = await searchBySerialNumber(value)
        setSuggestions(results)
        setShowSuggestions(results.length > 0)
        setSelectedIndex(-1)
      } catch (error) {
        console.error('Error buscando por serie:', error)
        setSuggestions([])
        setShowSuggestions(false)
      } finally {
        setLoading(false)
      }
    }
    
    const timeoutId = setTimeout(performSearch, 300)
    return () => clearTimeout(timeoutId)
  }, [searchTrigger])
  
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
  
  const handleSelectSuggestion = (insumo: InsumoData) => {
    userTypingRef.current = false
    onSelect(insumo)
    setShowSuggestions(false)
    setSelectedIndex(-1)
    setSuggestions([])
  }
  
  // Cerrar sugerencias al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        inputRef.current && 
        !inputRef.current.contains(event.target as Node) &&
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  // Actualizar posición de sugerencias al hacer scroll o resize
  useEffect(() => {
    if (!showSuggestions) return
    
    const updatePosition = () => {
      forceUpdate(prev => prev + 1)
    }
    
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [showSuggestions])
  
  return (
    <div className="relative flex-1">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => handleUserInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`${className} ${loading ? 'pr-8' : ''}`}
        disabled={disabled}
        type="text"
        style={{ 
          minHeight: '1.75rem'
        }}
      />
      
      {loading && (
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
      
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="fixed z-[9999] bg-white border-2 border-green-400 rounded-lg shadow-2xl overflow-y-auto"
          style={{
            left: '2rem',
            right: '2rem',
            top: inputRef.current ? `${inputRef.current.getBoundingClientRect().bottom + 4}px` : '0',
            maxHeight: '50vh',
            minWidth: '300px'
          }}
        >
          <div className="sticky top-0 bg-gradient-to-r from-green-600 to-green-500 text-white px-4 py-2 text-sm font-semibold shadow-md z-10">
            🔢 {suggestions.length} serie{suggestions.length !== 1 ? 's' : ''} encontrada{suggestions.length !== 1 ? 's' : ''}
          </div>
          <div className="divide-y divide-gray-100">
            {suggestions.map((insumo, index) => (
              <button
                key={`${insumo.numeroSerie}-${index}`}
                onClick={() => handleSelectSuggestion(insumo)}
                className={`w-full text-left px-4 py-3 hover:bg-green-50 focus:bg-green-50 focus:outline-none transition-colors ${
                  index === selectedIndex ? 'bg-green-100 border-l-4 border-green-600' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 mb-1 flex items-center gap-2 flex-wrap">
                      <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-sm font-mono">
                        SN: {insumo.numeroSerie}
                      </span>
                      <span className="bg-gray-100 px-2 py-0.5 rounded text-xs font-mono">
                        {insumo.codigoOriginal || '—'}
                      </span>
                      {insumo.codigoProveedor && (
                        <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs font-mono">
                          Prov: {insumo.codigoProveedor}
                        </span>
                      )}
                    </div>
                    <div className="text-gray-700 text-sm">
                      {insumo.descripcion}
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="text-green-600 font-semibold text-base">
                      ${new Intl.NumberFormat('es-CL', {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0
                      }).format(insumo.precioEstimado)}
                    </div>
                    <div className="text-xs text-gray-500">Precio est.</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <div className="sticky bottom-0 bg-gray-50 px-4 py-2 text-xs text-gray-600 border-t">
            💡 Usa ↑↓ para navegar • Enter para seleccionar • Esc para cerrar
          </div>
        </div>
      )}
      
      {showSuggestions && suggestions.length === 0 && value.length >= 3 && !loading && (
        <div 
          className="fixed z-[9999] bg-white border-2 border-gray-300 rounded-lg shadow-xl p-4"
          style={{
            left: '2rem',
            right: '2rem',
            top: inputRef.current ? `${inputRef.current.getBoundingClientRect().bottom + 4}px` : '0',
            minWidth: '300px'
          }}
        >
          <div className="text-center">
            <div className="text-4xl mb-2">🔍</div>
            <div className="text-sm text-gray-600 font-medium">
              No se encontraron series para <span className="font-bold text-gray-900">"{value}"</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
