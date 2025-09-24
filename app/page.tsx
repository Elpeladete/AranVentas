"use client"
import { ServiceOrderForm } from "@/components/service-order-form"
import { OrdersDatabaseViewer } from "@/components/orders-database-viewer"
import { Button } from "@/components/ui/button"
import { useState } from "react"

export default function HomePage() {
  const [showDatabase, setShowDatabase] = useState(false)

  return (
    <main className="min-h-screen bg-background">
      {/* Botón flotante para abrir base de datos */}
      <div className="fixed top-4 right-4 z-40">
        <Button
          onClick={() => setShowDatabase(true)}
          variant="outline"
          size="sm"
          className="shadow-lg bg-white hover:bg-gray-50"
          title="Ver base de datos local"
        >
          <span className="mr-2">🗃️</span>
          Base de Datos
        </Button>
      </div>

      <ServiceOrderForm />
      
      {/* Visualizador de base de datos */}
      {showDatabase && (
        <OrdersDatabaseViewer
          onClose={() => setShowDatabase(false)}
        />
      )}
    </main>
  )
}
