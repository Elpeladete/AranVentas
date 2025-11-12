"use client"
import { ServiceOrderForm } from "@/components/service-order-form"
import { OrdersDatabaseViewer } from "@/components/orders-database-viewer"
import { OdooConnectionTest } from "@/components/odoo-connection-test"
import { Button } from "@/components/ui/button"
import { useState, useRef } from "react"
import type { FormData } from "@/hooks/use-form-data"
import type { OrderRecord } from "@/lib/local-database"

export default function HomePage() {
  const [showDatabase, setShowDatabase] = useState(false)
  const [showOdooTest, setShowOdooTest] = useState(false)
  const loadFormDataRef = useRef<((data: FormData) => void) | null>(null)
  
  const handleLoadFormData = (loadFn: (data: FormData) => void) => {
    loadFormDataRef.current = loadFn
  }
  
  const handleEditOrder = (order: OrderRecord) => {
    if (loadFormDataRef.current) {
      loadFormDataRef.current(order.formData)
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <ServiceOrderForm 
        onShowDatabase={() => setShowDatabase(true)}
        onLoadFormData={handleLoadFormData}
      />
      
      {/* Botón flotante para prueba de Odoo */}
      <Button
        onClick={() => setShowOdooTest(!showOdooTest)}
        className="fixed bottom-4 right-4 z-50"
        variant="outline"
      >
        🔧 Probar Odoo
      </Button>
      
      {/* Test de conexión Odoo */}
      {showOdooTest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Prueba de Conexión Odoo</h2>
              <Button onClick={() => setShowOdooTest(false)} variant="ghost">✕</Button>
            </div>
            <OdooConnectionTest />
          </div>
        </div>
      )}
      
      {/* Visualizador de base de datos */}
      {showDatabase && (
        <OrdersDatabaseViewer
          onClose={() => setShowDatabase(false)}
          onEditOrder={handleEditOrder}
        />
      )}
    </main>
  )
}
