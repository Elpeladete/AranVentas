"use client"
import { ServiceOrderForm } from "@/components/service-order-form"
import { OrdersDatabaseViewer } from "@/components/orders-database-viewer"
import { Button } from "@/components/ui/button"
import { useState } from "react"

export default function HomePage() {
  const [showDatabase, setShowDatabase] = useState(false)

  return (
    <main className="min-h-screen bg-background">
      <ServiceOrderForm onShowDatabase={() => setShowDatabase(true)} />
      
      {/* Visualizador de base de datos */}
      {showDatabase && (
        <OrdersDatabaseViewer
          onClose={() => setShowDatabase(false)}
        />
      )}
    </main>
  )
}
