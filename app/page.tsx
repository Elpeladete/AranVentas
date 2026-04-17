"use client"
import { ServiceOrderForm } from "@/components/service-order-form"
import { OrdersDatabaseViewer } from "@/components/orders-database-viewer"
import { Button } from "@/components/ui/button"
import { useState, useRef, useEffect } from "react"
import type { FormData } from "@/hooks/use-form-data"
import type { OrderRecord } from "@/lib/local-database"
import { getOdooClient, isOdooConfigured } from "@/lib/odoo-client"

export default function HomePage() {
  const [showDatabase, setShowDatabase] = useState(false)
  const [assignedCount, setAssignedCount] = useState(0)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const loadFormDataRef = useRef<((data: FormData) => void) | null>(null)
  
  // Verificar tareas asignadas al iniciar la app
  useEffect(() => {
    const checkAssignedTasks = async () => {
      try {
        if (!isOdooConfigured()) return

        let tecnicoNombre = ''
        try {
          const savedData = localStorage.getItem('aran-form-data')
          if (savedData) {
            const parsed = JSON.parse(savedData)
            tecnicoNombre = parsed.tecnicoNombre || ''
          }
        } catch { }

        if (!tecnicoNombre) return

        const client = getOdooClient()
        const result = await client.searchRead(
          'project.task',
          [
            ['stage_id', '=', 105],
            ['x_studio_tecnico_asignado', 'ilike', tecnicoNombre]
          ],
          ['id'],
          { limit: 50 }
        )

        if (result.success && Array.isArray(result.data) && result.data.length > 0) {
          setAssignedCount(result.data.length)
          console.log(`📋 ${result.data.length} tarea(s) asignada(s) encontrada(s) para ${tecnicoNombre}`)
        }
      } catch (error) {
        console.warn('No se pudieron verificar tareas asignadas:', error)
      }
    }

    checkAssignedTasks()
  }, [])

  const handleLoadFormData = (loadFn: (data: FormData) => void) => {
    loadFormDataRef.current = loadFn
  }
  
  const handleEditOrder = (order: OrderRecord) => {
    if (loadFormDataRef.current) {
      loadFormDataRef.current(order.formData)
    }
  }

  const handleLoadFromOdoo = (data: FormData) => {
    if (loadFormDataRef.current) {
      loadFormDataRef.current(data)
    }
  }

  const handleOpenPending = () => {
    setBannerDismissed(true)
    setShowDatabase(true)
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Banner de tareas asignadas */}
      {assignedCount > 0 && !bannerDismissed && (
        <div 
          className="animate-pulse-green cursor-pointer bg-green-500 text-white px-4 py-3 flex items-center justify-between shadow-lg"
          onClick={handleOpenPending}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">📋</span>
            <div>
              <p className="font-bold text-sm sm:text-base">
                {assignedCount === 1 
                  ? '¡Tenés 1 nuevo Servicio Asignado!' 
                  : `¡Tenés ${assignedCount} nuevos Servicios Asignados!`}
              </p>
              <p className="text-xs sm:text-sm opacity-90">Tocá aquí para ver las órdenes pendientes</p>
            </div>
          </div>
          <button 
            className="text-white/80 hover:text-white text-xl font-bold px-2"
            onClick={(e) => { e.stopPropagation(); setBannerDismissed(true) }}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
      )}

      <ServiceOrderForm 
        onShowDatabase={() => setShowDatabase(true)}
        onLoadFormData={handleLoadFormData}
      />
      
      {/* Visualizador de base de datos */}
      {showDatabase && (
        <OrdersDatabaseViewer
          onClose={() => setShowDatabase(false)}
          onEditOrder={handleEditOrder}
          onLoadFormData={handleLoadFromOdoo}
        />
      )}
    </main>
  )
}
