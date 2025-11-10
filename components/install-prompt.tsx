'use client'

/**
 * Componente que muestra un prompt para instalar la aplicación como PWA
 * Se activa automáticamente cuando el navegador detecta que la app se puede instalar
 */

import { useEffect, useState } from 'react'
import { X, Download, Smartphone } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Verificar si ya está instalada
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }

    // Escuchar el evento beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      const promptEvent = e as BeforeInstallPromptEvent
      setDeferredPrompt(promptEvent)
      
      // Esperar 5 segundos antes de mostrar el prompt
      setTimeout(() => {
        setShowPrompt(true)
        console.log('📱 La aplicación se puede instalar')
      }, 5000)
    }

    // Escuchar cuando se instala
    const handleAppInstalled = () => {
      setIsInstalled(true)
      setShowPrompt(false)
      console.log('✅ Aplicación instalada exitosamente')
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return

    try {
      // Mostrar el prompt de instalación
      await deferredPrompt.prompt()
      
      // Esperar la respuesta del usuario
      const { outcome } = await deferredPrompt.userChoice
      
      console.log(`📊 Usuario ${outcome === 'accepted' ? 'aceptó' : 'rechazó'} la instalación`)
      
      if (outcome === 'accepted') {
        setShowPrompt(false)
      }
      
      // Limpiar el prompt
      setDeferredPrompt(null)
    } catch (error) {
      console.error('Error al mostrar prompt de instalación:', error)
    }
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    // Volver a mostrar en 7 días
    localStorage.setItem('installPromptDismissed', Date.now().toString())
  }

  // No mostrar si ya está instalada o si fue descartada recientemente
  useEffect(() => {
    const dismissed = localStorage.getItem('installPromptDismissed')
    if (dismissed) {
      const dismissedTime = parseInt(dismissed)
      const sevenDays = 7 * 24 * 60 * 60 * 1000
      if (Date.now() - dismissedTime < sevenDays) {
        setShowPrompt(false)
      }
    }
  }, [])

  if (isInstalled || !showPrompt) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom-5 duration-500">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            {/* Ícono y mensaje */}
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="flex-shrink-0 bg-white/20 p-3 rounded-lg">
                <Smartphone className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold mb-1">
                  Instala ARAN Órdenes de Servicio
                </h3>
                <p className="text-sm text-blue-100 line-clamp-2">
                  Accede más rápido y trabaja sin conexión. Instala nuestra app en tu dispositivo.
                </p>
              </div>
            </div>

            {/* Botones */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleInstallClick}
                className="flex items-center gap-2 bg-white text-blue-700 px-6 py-2.5 rounded-lg font-semibold hover:bg-blue-50 transition-colors shadow-lg hover:shadow-xl transform hover:scale-105 transition-transform"
              >
                <Download className="w-5 h-5" />
                <span className="hidden sm:inline">Instalar Ahora</span>
                <span className="sm:hidden">Instalar</span>
              </button>
              
              <button
                onClick={handleDismiss}
                className="p-2.5 hover:bg-white/10 rounded-lg transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
