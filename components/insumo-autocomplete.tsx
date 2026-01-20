import React, { useState, useEffect, useRef } from 'react'
import { searchInsumos, type InsumoData } from '@/lib/insumos-search'

interface InsumoAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onSelect: (insumo: InsumoData) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function InsumoAutocomplete({ 
  value, 
  onChange, 
  onSelect, 
  placeholder = "Buscar código...",
  className = "",
  disabled = false
}: InsumoAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<InsumoData[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [, forceUpdate] = useState(0) // Para forzar actualización de posición
  const [justSelected, setJustSelected] = useState(false) // Flag para evitar reabrir
  
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  
  // Buscar sugerencias cuando cambia el valor
  useEffect(() => {
    const performSearch = async () => {
      if (value.length < 3) {
        setSuggestions([])
        setShowSuggestions(false)
        // Resetear flag cuando el usuario borra el texto
        setJustSelected(false)
        return
      }
      
      // No mostrar sugerencias si acabamos de seleccionar
      if (justSelected) {
        return // No resetear el flag, se mantiene hasta que el usuario escriba
      }
      
      setLoading(true)
      try {
        const results = await searchInsumos(value)
        setSuggestions(results)
        setShowSuggestions(results.length > 0)
        setSelectedIndex(-1)
      } catch (error) {
        console.error('Error buscando insumos:', error)
        setSuggestions([])
        setShowSuggestions(false)
      } finally {
        setLoading(false)
      }
    }
    
    // Debounce la búsqueda
    const timeoutId = setTimeout(performSearch, 300)
    return () => clearTimeout(timeoutId)
  }, [value, justSelected])
  
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
    setJustSelected(true) // Marcar que acabamos de seleccionar
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
    <div className="relative">
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`${className} ${loading ? 'pr-8' : ''} resize-none overflow-hidden`}
        disabled={disabled}
        rows={1}
        style={{ 
          lineHeight: '1.2',
          whiteSpace: 'normal',
          wordWrap: 'break-word',
          minHeight: '1.75rem',
          maxHeight: '4rem'
        }}
        onInput={(e) => {
          // Auto-ajustar altura del textarea
          const target = e.target as HTMLTextAreaElement
          target.style.height = '1.75rem'
          target.style.height = Math.min(target.scrollHeight, 64) + 'px' // max 4rem = 64px
        }}
      />
      
      {loading && (
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
      
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="fixed z-[9999] bg-white border-2 border-blue-400 rounded-lg shadow-2xl overflow-y-auto"
          style={{
            left: '2rem',
            right: '2rem',
            top: inputRef.current ? `${inputRef.current.getBoundingClientRect().bottom + 4}px` : '0',
            maxHeight: '50vh',
            minWidth: '300px'
          }}
        >
          <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-500 text-white px-4 py-2 text-sm font-semibold shadow-md z-10">
            📦 {suggestions.length} resultado{suggestions.length !== 1 ? 's' : ''} encontrado{suggestions.length !== 1 ? 's' : ''}
          </div>
          <div className="divide-y divide-gray-100">
            {suggestions.map((insumo, index) => (
              <button
                key={`${insumo.codigoOriginal}-${index}`}
                onClick={() => handleSelectSuggestion(insumo)}
                className={`w-full text-left px-4 py-3 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none transition-colors ${
                  index === selectedIndex ? 'bg-blue-100 border-l-4 border-blue-600' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                      <span className="bg-gray-100 px-2 py-0.5 rounded text-sm font-mono">
                        {insumo.codigoOriginal}
                      </span>
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
              No se encontraron insumos para <span className="font-bold text-gray-900">"{value}"</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}