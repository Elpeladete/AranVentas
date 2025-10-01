/**
 * Componente de búsqueda inteligente de contactos Odoo
 * Se integra con el campo de razón social para autocompletar datos
 */

"use client"

import React, { useState, useEffect, useRef } from 'react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  searchOdooContacts, 
  getOdooContactDetails, 
  isOdooConfigured,
  testOdooConnection,
  type OdooContact 
} from "@/lib/odoo-integration"

interface OdooContactSearchProps {
  value: string
  onValueChange: (value: string) => void
  onContactSelect: (contact: OdooContact) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function OdooContactSearch({
  value,
  onValueChange,
  onContactSelect,
  placeholder = "Escribe la razón social...",
  disabled = false,
  className = ""
}: OdooContactSearchProps) {
  const [suggestions, setSuggestions] = useState<OdooContact[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [odooConnected, setOdooConnected] = useState<boolean | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout>()

  // Verificar estado de Odoo al cargar
  useEffect(() => {
    checkOdooConnection()
  }, [])

  // Búsqueda con debounce
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (!value || value.length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    debounceRef.current = setTimeout(() => {
      if (odooConnected) {
        performSearch(value)
      }
    }, 500) // 500ms de debounce

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [value, odooConnected])

  // Cerrar sugerencias al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        suggestionsRef.current && 
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const checkOdooConnection = async () => {
    if (!isOdooConfigured()) {
      setOdooConnected(false)
      return
    }

    try {
      const result = await testOdooConnection()
      setOdooConnected(result.success)
      if (!result.success) {
        setSearchError(result.error || 'Error de conexión con Odoo')
      }
    } catch (error) {
      setOdooConnected(false)
      setSearchError('No se pudo conectar con Odoo')
    }
  }

  const performSearch = async (searchTerm: string) => {
    setIsSearching(true)
    setSearchError(null)
    
    try {
      console.log('🔍 Buscando contactos:', searchTerm)
      
      const result = await searchOdooContacts(searchTerm)
      
      if (result.success) {
        setSuggestions(result.contacts)
        setShowSuggestions(result.contacts.length > 0)
        console.log(`✅ Encontrados ${result.contacts.length} contactos`)
      } else {
        setSearchError(result.error || 'Error en la búsqueda')
        setSuggestions([])
        setShowSuggestions(false)
      }
    } catch (error) {
      console.error('❌ Error en búsqueda:', error)
      setSearchError('Error al buscar contactos')
      setSuggestions([])
      setShowSuggestions(false)
    } finally {
      setIsSearching(false)
    }
  }

  const handleContactClick = async (contact: OdooContact) => {
    try {
      // Obtener detalles completos del contacto
      const fullContact = await getOdooContactDetails(contact.id)
      
      if (fullContact) {
        onContactSelect(fullContact)
        onValueChange(fullContact.name)
        
        console.log('✅ Contacto seleccionado:', fullContact)
      } else {
        // Usar datos básicos si no se pueden obtener detalles
        onContactSelect(contact)
        onValueChange(contact.name)
      }
      
      setShowSuggestions(false)
      setSuggestions([])
    } catch (error) {
      console.error('❌ Error seleccionando contacto:', error)
      // Usar datos básicos como fallback
      onContactSelect(contact)
      onValueChange(contact.name)
      setShowSuggestions(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    onValueChange(newValue)
    
    if (newValue.length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }

  const handleInputFocus = () => {
    if (suggestions.length > 0) {
      setShowSuggestions(true)
    }
  }

  const getOdooStatusIndicator = () => {
    if (odooConnected === null) {
      return <span className="text-xs text-gray-400">🔄 Verificando Odoo...</span>
    }
    
    if (odooConnected) {
      return <span className="text-xs text-green-600">✅ Odoo conectado</span>
    }
    
    return <span className="text-xs text-red-600">❌ Odoo desconectado</span>
  }

  return (
    <div className="relative">
      {/* Input principal */}
      <div className="relative">
        <Input
          ref={inputRef}
          value={value}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          placeholder={placeholder}
          disabled={disabled}
          className={`${className} ${odooConnected ? 'border-green-200' : 'border-gray-200'}`}
        />
        
        {/* Indicador de búsqueda */}
        {isSearching && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        
        {/* Indicador de Odoo */}
        {odooConnected && !isSearching && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <span className="text-green-500 text-sm">🔍</span>
          </div>
        )}
      </div>

      {/* Estado de conexión Odoo */}
      <div className="flex items-center justify-between mt-1">
        <div>
          {getOdooStatusIndicator()}
        </div>
        
        {searchError && (
          <span className="text-xs text-red-600">⚠️ {searchError}</span>
        )}
      </div>

      {/* Lista de sugerencias */}
      {showSuggestions && suggestions.length > 0 && (
        <div 
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          <div className="p-2 border-b bg-gray-50">
            <span className="text-xs font-medium text-gray-600">
              📋 Contactos encontrados en Odoo ({suggestions.length})
            </span>
          </div>
          
          {suggestions.map((contact) => (
            <div
              key={contact.id}
              onClick={() => handleContactClick(contact)}
              className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">
                      {contact.name}
                    </span>
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${
                        contact.is_company ? 'border-blue-200 text-blue-700' : 'border-green-200 text-green-700'
                      }`}
                    >
                      {contact.is_company ? '🏢 Empresa' : '👤 Persona'}
                    </Badge>
                  </div>
                  
                  <div className="mt-1 space-y-1">
                    {contact.vat && (
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">CUIT:</span> {contact.vat}
                      </div>
                    )}
                    
                    {contact.phone && (
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Tel:</span> {contact.phone}
                      </div>
                    )}
                    
                    {contact.city && (
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Ciudad:</span> {contact.city}
                      </div>
                    )}
                    
                    {contact.email && (
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Email:</span> {contact.email}
                      </div>
                    )}
                  </div>
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-2 text-blue-600 hover:text-blue-800"
                >
                  Seleccionar →
                </Button>
              </div>
            </div>
          ))}
          
          <div className="p-2 bg-gray-50 text-center">
            <span className="text-xs text-gray-500">
              💡 Haz clic en un contacto para autocompletar los datos
            </span>
          </div>
        </div>
      )}
      
      {/* Mensaje cuando no hay sugerencias */}
      {showSuggestions && suggestions.length === 0 && !isSearching && value.length >= 2 && (
        <div 
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4"
        >
          <div className="text-center text-gray-500">
            <span className="text-2xl">🔍</span>
            <p className="mt-2 text-sm">
              No se encontraron contactos para "<strong>{value}</strong>"
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Verifica la ortografía o ingresa manualmente los datos
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// Hook personalizado para usar la búsqueda de Odoo
export function useOdooContactSearch() {
  const [selectedContact, setSelectedContact] = useState<OdooContact | null>(null)
  
  const handleContactSelect = (contact: OdooContact) => {
    setSelectedContact(contact)
    console.log('🎯 Contacto seleccionado para autocompletado:', contact)
  }
  
  const clearSelectedContact = () => {
    setSelectedContact(null)
  }
  
  return {
    selectedContact,
    handleContactSelect,
    clearSelectedContact
  }
}