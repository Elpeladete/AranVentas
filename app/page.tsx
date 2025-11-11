"use client"
import { ServiceOrderForm } from "@/components/service-order-form"
import { OrdersDatabaseViewer } from "@/components/orders-database-viewer"
import { OdooConnectionTest } from "@/components/odoo-connection-test"
import { Button } from "@/components/ui/button"
import { useState } from "react"

export default function HomePage() {
  const [showDatabase, setShowDatabase] = useState(false)
  const [showOdooTest, setShowOdooTest] = useState(false)

  return (
    <main className="min-h-screen bg-background">
      <ServiceOrderForm onShowDatabase={() => setShowDatabase(true)} />
      
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
        />
      )}
    </main>
  )
}
