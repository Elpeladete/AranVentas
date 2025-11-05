"use client"

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { searchTecnicos, type TecnicoSearchResult } from "@/lib/tecnicos-search"
import { Search, User, Briefcase, IdCard, Loader2 } from 'lucide-react'

interface TecnicoAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onSelect?: (tecnico: TecnicoSearchResult) => void
  placeholder?: string
  className?: string
}

export function TecnicoAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Buscar técnico...",
  className = ""
}: TecnicoAutocompleteProps) {
  const [isSearching, setIsSearching] = useState(false)
  const [results, setResults] = useState<TecnicoSearchResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Buscar técnicos cuando el valor cambia
  useEffect(() => {
    const search = async () => {
      if (!value || value.trim().length < 2) {
        setResults([])
        setShowResults(false)
        return
      }

      setIsSearching(true)
      try {
        const searchResults = await searchTecnicos(value, 8)
        setResults(searchResults)
        setShowResults(searchResults.length > 0)
        setSelectedIndex(-1)
      } catch (error) {
        console.error('Error buscando técnicos:', error)
        setResults([])
      } finally {
        setIsSearching(false)
      }
    }

    const timeoutId = setTimeout(search, 300)
    return () => clearTimeout(timeoutId)
  }, [value])

  // Cerrar resultados al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Manejar selección de técnico
  const handleSelect = (tecnico: TecnicoSearchResult) => {
    onChange(tecnico.nombre)
    setShowResults(false)
    
    if (onSelect) {
      onSelect(tecnico)
    }
  }

  // Manejar navegación con teclado
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showResults || results.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleSelect(results[selectedIndex])
        }
        break
      case 'Escape':
        setShowResults(false)
        break
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Input con ícono */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) {
              setShowResults(true)
            }
          }}
          placeholder={placeholder}
          className="pl-10 pr-10"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-500 animate-spin" />
        )}
      </div>

      {/* Lista de resultados */}
      {showResults && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-[320px] overflow-y-auto">
          <div className="p-2 space-y-1">
            {results.map((tecnico, index) => (
              <button
                key={`${tecnico.nombre}-${index}`}
                onClick={() => handleSelect(tecnico)}
                className={`w-full text-left px-3 py-2.5 rounded-md transition-colors ${
                  index === selectedIndex
                    ? 'bg-blue-50 border-blue-200 border'
                    : 'hover:bg-gray-50 border border-transparent'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Ícono de técnico */}
                  <div className="flex-shrink-0 mt-0.5">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <User className="h-4 w-4 text-blue-600" />
                    </div>
                  </div>

                  {/* Información del técnico */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900 truncate">
                      {tecnico.nombre}
                    </div>
                    
                    {/* Información adicional */}
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                      {tecnico.cargo && (
                        <div className="flex items-center gap-1 text-xs text-gray-600">
                          <Briefcase className="h-3 w-3" />
                          <span>{tecnico.cargo}</span>
                        </div>
                      )}
                      {tecnico.dni && (
                        <div className="flex items-center gap-1 text-xs text-gray-600">
                          <IdCard className="h-3 w-3" />
                          <span>DNI: {tecnico.dni}</span>
                        </div>
                      )}
                    </div>

                    {/* Email si está disponible */}
                    {tecnico.email && (
                      <div className="text-xs text-gray-500 mt-1 truncate">
                        📧 {tecnico.email}
                      </div>
                    )}
                  </div>

                  {/* Badge de match score */}
                  <div className="flex-shrink-0">
                    <div className={`text-xs px-2 py-1 rounded ${
                      tecnico.matchScore >= 80
                        ? 'bg-green-100 text-green-700'
                        : tecnico.matchScore >= 60
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {Math.round(tecnico.matchScore)}%
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Footer con info */}
          <div className="border-t border-gray-100 p-2 bg-gray-50">
            <div className="flex items-center justify-between text-xs text-gray-500 px-2">
              <span>💡 Usa ↑↓ para navegar, Enter para seleccionar</span>
              <span>{results.length} resultado{results.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
      )}

      {/* Mensaje cuando no hay resultados */}
      {showResults && value.trim().length >= 2 && !isSearching && results.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center">
          <User className="h-8 w-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm text-gray-600 mb-1">
            No se encontraron técnicos que coincidan con "{value}"
          </p>
          <p className="text-xs text-gray-500">
            Puedes escribir el nombre manualmente
          </p>
        </div>
      )}
    </div>
  )
}
