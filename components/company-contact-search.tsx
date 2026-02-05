/**
 * Componente de búsqueda de contactos asociados a una empresa
 * Con opción para crear nuevo contacto
 */

"use client"

import React, { useState, useEffect, useRef } from 'react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Plus, Search, UserPlus } from 'lucide-react'
import { 
  searchContactsByCompany,
  createOdooContact,
  type OdooContact,
  type CreateContactParams 
} from "@/lib/odoo-api-client"
import { toast } from "@/lib/toast"

interface CompanyContactSearchProps {
  companyId: number | null
  companyName: string
  value: string
  onValueChange: (value: string) => void
  onContactSelect: (contact: OdooContact) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function CompanyContactSearch({
  companyId,
  companyName,
  value,
  onValueChange,
  onContactSelect,
  placeholder = "Escribe al menos 4 caracteres para buscar contacto...",
  disabled = false,
  className = ""
}: CompanyContactSearchProps) {
  const [suggestions, setSuggestions] = useState<OdooContact[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newContactName, setNewContactName] = useState('')
  const [newContactPhone, setNewContactPhone] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout>()

  // Buscar cuando cambie el valor (con debounce)
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    // Solo buscar si hay empresa seleccionada y al menos 4 caracteres
    if (companyId && value && value.length >= 4) {
      debounceRef.current = setTimeout(() => {
        performSearch(value)
      }, 500)
    } else if (companyId && value && value.length >= 2) {
      // Con 2-3 caracteres, buscar pero sin debounce tan largo
      debounceRef.current = setTimeout(() => {
        performSearch(value)
      }, 300)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [value, companyId])

  const performSearch = async (searchTerm: string) => {
    if (!companyId) {
      console.log('⚠️ No hay empresa seleccionada')
      return
    }

    try {
      setIsSearching(true)
      console.log(`🔍 Buscando contactos de empresa ${companyId} con término: "${searchTerm}"`)
      
      const result = await searchContactsByCompany(companyId, searchTerm)
      
      if (result.success) {
        setSuggestions(result.contacts)
        setShowSuggestions(true)
        console.log(`✅ ${result.contacts.length} contactos encontrados`)
      } else {
        console.error('❌ Error en búsqueda:', result.error)
        setSuggestions([])
      }
    } catch (error) {
      console.error('❌ Error buscando contactos:', error)
      setSuggestions([])
    } finally {
      setIsSearching(false)
    }
  }

  const handleSelectContact = (contact: OdooContact) => {
    console.log('✅ Contacto seleccionado:', contact)
    onValueChange(contact.name)
    onContactSelect(contact)
    setShowSuggestions(false)
  }

  const handleCreateContact = async () => {
    if (!companyId) {
      toast.error('No hay empresa seleccionada')
      return
    }

    if (!newContactName || newContactName.trim().length < 2) {
      toast.error('El nombre debe tener al menos 2 caracteres')
      return
    }

    try {
      setIsCreating(true)
      console.log('📝 Creando nuevo contacto...')
      
      const params: CreateContactParams = {
        name: newContactName.trim(),
        phone: newContactPhone.trim() || undefined,
        parent_id: companyId
      }
      
      const result = await createOdooContact(params)
      
      if (result.success && result.contact) {
        console.log('✅ Contacto creado exitosamente:', result.contact)
        toast.success('Contacto creado', {
          description: `${result.contact.name} asociado a ${companyName}`,
          duration: 4000
        })
        
        // Seleccionar el nuevo contacto
        handleSelectContact(result.contact)
        
        // Cerrar diálogo y limpiar
        setShowCreateDialog(false)
        setNewContactName('')
        setNewContactPhone('')
      } else {
        console.error('❌ Error al crear contacto:', result.error)
        toast.error('Error al crear contacto', {
          description: result.error || 'Error desconocido'
        })
      }
    } catch (error) {
      console.error('❌ Error creando contacto:', error)
      toast.error('Error al crear contacto')
    } finally {
      setIsCreating(false)
    }
  }

  const openCreateDialog = () => {
    // Pre-llenar el nombre con lo que el usuario escribió
    setNewContactName(value)
    setShowCreateDialog(true)
    setShowSuggestions(false)
  }

  // Cerrar sugerencias cuando se hace clic fuera
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
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const showCreateButton = companyId && value.length >= 2 && !isSearching

  return (
    <>
      <div className="relative w-full">
        <Input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          placeholder={companyId ? placeholder : "Escribe el nombre del contacto..."}
          disabled={disabled}
          className={className}
        />
        
        {/* Indicador de búsqueda */}
        {isSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Search className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Lista de sugerencias */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            ref={suggestionsRef}
            className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border rounded-md shadow-lg max-h-60 overflow-auto"
          >
            {suggestions.map((contact) => (
              <button
                key={contact.id}
                type="button"
                onClick={() => handleSelectContact(contact)}
                className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 border-b last:border-b-0"
              >
                <div className="font-medium">👤 {contact.name}</div>
                {contact.phone && (
                  <div className="text-sm text-muted-foreground">
                    📱 {contact.phone}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Botón para crear nuevo contacto */}
        {showCreateButton && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openCreateDialog}
            className="absolute right-3 top-1/2 -translate-y-1/2"
          >
            <UserPlus className="h-4 w-4 mr-1" />
            Crear nuevo
          </Button>
        )}

        {/* Mensaje cuando no hay empresa seleccionada pero hay texto */}
        {!companyId && value && value.length >= 2 && (
          <div className="absolute z-50 w-full mt-1 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3 text-sm">
            💡 Si la empresa no existe en Odoo, podrás crearla junto con este contacto
          </div>
        )}
      </div>

      {/* Diálogo para crear nuevo contacto */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear nuevo contacto</DialogTitle>
            <DialogDescription>
              Crear contacto asociado a: <strong>{companyName}</strong>
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-contact-name">
                Nombre del contacto <span className="text-red-500">*</span>
              </Label>
              <Input
                id="new-contact-name"
                value={newContactName}
                onChange={(e) => setNewContactName(e.target.value)}
                placeholder="Ej: Juan Pérez"
                autoFocus
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="new-contact-phone">Teléfono (opcional)</Label>
              <Input
                id="new-contact-phone"
                value={newContactPhone}
                onChange={(e) => setNewContactPhone(e.target.value)}
                placeholder="Ej: 2615551234"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              disabled={isCreating}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleCreateContact}
              disabled={isCreating || !newContactName.trim()}
            >
              {isCreating ? (
                <>
                  <Search className="h-4 w-4 mr-2 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear contacto
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
