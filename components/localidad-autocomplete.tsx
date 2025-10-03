"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { searchLocalidades, type LocalidadSearchResult } from "@/lib/localidades-search"

interface LocalidadAutocompleteProps {
  value: string
  onValueChange: (value: string) => void
  onLocalidadSelect?: (localidad: LocalidadSearchResult) => void
  placeholder?: string
  className?: string
}

export function LocalidadAutocomplete({
  value,
  onValueChange,
  onLocalidadSelect,
  placeholder = "Buscar localidad...",
  className
}: LocalidadAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<LocalidadSearchResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Buscar sugerencias cuando cambie el valor
  useEffect(() => {
    const searchSuggestions = async () => {
      if (value && value.trim().length >= 2) {
        setIsLoading(true)
        try {
          const results = await searchLocalidades(value, 8)
          setSuggestions(results)
          setIsOpen(results.length > 0)
          setSelectedIndex(-1)
        } catch (error) {
          console.error('Error buscando localidades:', error)
          setSuggestions([])
          setIsOpen(false)
        } finally {
          setIsLoading(false)
        }
      } else {
        setSuggestions([])
        setIsOpen(false)
        setSelectedIndex(-1)
      }
    }

    // Debounce la búsqueda
    const timeoutId = setTimeout(searchSuggestions, 300)
    return () => clearTimeout(timeoutId)
  }, [value])

  // Manejar selección de sugerencia
  const handleSelectSuggestion = (localidad: LocalidadSearchResult) => {
    onValueChange(localidad.municipio)
    onLocalidadSelect?.(localidad)
    setIsOpen(false)
    setSuggestions([])
    setSelectedIndex(-1)
    
    // Opcional: Enfocar de vuelta el input
    setTimeout(() => {
      inputRef.current?.focus()
    }, 100)
  }

  // Navegación con teclado
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        )
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          handleSelectSuggestion(suggestions[selectedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        setSelectedIndex(-1)
        break
    }
  }

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        inputRef.current && 
        !inputRef.current.contains(event.target as Node) &&
        listRef.current && 
        !listRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
        setSelectedIndex(-1)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Formatear puntaje como porcentaje para debugging
  const formatScore = (score: number) => `${Math.round(score)}%`

  return (
    <div className="relative w-full">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn("w-full", className)}
        autoComplete="off"
      />
      
      {/* Indicador de carga */}
      {isLoading && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
        </div>
      )}

      {/* Lista de sugerencias */}
      {isOpen && suggestions.length > 0 && (
        <div
          ref={listRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto"
        >
          {suggestions.map((localidad, index) => (
            <div
              key={`${localidad.municipio}-${localidad.provincia}`}
              className={cn(
                "px-3 py-2 cursor-pointer hover:bg-blue-50 border-b border-gray-100 last:border-b-0",
                selectedIndex === index && "bg-blue-100"
              )}
              onClick={() => handleSelectSuggestion(localidad)}
            >
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="font-medium text-gray-900">
                    {localidad.municipio}
                  </span>
                  <span className="text-sm text-gray-600">
                    {localidad.provincia}, {localidad.pais}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {/* Score de coincidencia para debugging */}
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                    {formatScore(localidad.matchScore)}
                  </span>
                  {/* Indicador de país */}
                  <span className={cn(
                    "text-xs px-2 py-1 rounded-full",
                    localidad.pais === 'Argentina' ? "bg-blue-100 text-blue-700" :
                    localidad.pais === 'Uruguay' ? "bg-green-100 text-green-700" :
                    localidad.pais === 'Paraguay' ? "bg-yellow-100 text-yellow-700" :
                    "bg-gray-100 text-gray-700"
                  )}>
                    {localidad.pais === 'Argentina' ? '🇦🇷' :
                     localidad.pais === 'Uruguay' ? '🇺🇾' :
                     localidad.pais === 'Paraguay' ? '🇵🇾' : '🌍'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mensaje cuando no hay resultados */}
      {isOpen && !isLoading && suggestions.length === 0 && value.length >= 2 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
          <div className="px-3 py-2 text-gray-500 text-center">
            No se encontraron localidades que coincidan con "{value}"
          </div>
        </div>
      )}
    </div>
  )
}