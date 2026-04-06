"use client"
import { ServiceOrderForm } from "@/components/service-order-form"
import { OrdersDatabaseViewer } from "@/components/orders-database-viewer"
import { Button } from "@/components/ui/button"
import { useState, useRef } from "react"
import type { FormData } from "@/hooks/use-form-data"
import type { OrderRecord } from "@/lib/local-database"

export default function HomePage() {
  const [showDatabase, setShowDatabase] = useState(false)
  const loadFormDataRef = useRef<((data: FormData) => void) | null>(null)
  
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

  return (
    <main className="min-h-screen bg-background">
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
