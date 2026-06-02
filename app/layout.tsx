import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'sonner'
import { BuildInfoDisplay } from '@/components/build-info'
import { BuildInfoLogger } from '@/components/build-info-logger'
import { ClientOnly } from '@/components/client-only'
import { OfflineStatus } from '@/components/offline-status'
import { OfflineDataInitializer } from '@/components/offline-data-initializer'
import { SyncStatusLogger } from '@/components/sync-status-logger'
import { ServiceWorkerRegistration } from '@/components/service-worker-registration'
import { UpdateNotification } from '@/components/update-notification'
import './globals.css'

export const metadata: Metadata = {
  title: 'ARAN Tecnologías - Notas de Venta / Facturas Proforma',
  description: 'Sistema digital para la generación de Notas de Venta y Facturas Proforma de ARAN Tecnologías',
  generator: 'AranVentas',
  keywords: ['ARAN', 'tecnologías', 'notas de venta', 'facturas proforma', 'ventas'],

  icons: {
    icon: [
      {
        url: '/favicon.svg',
        type: 'image/svg+xml',
      },
      {
        url: '/favicon.ico',
        sizes: 'any',
      },
      {
        url: '/favicon-16x16.png',
        sizes: '16x16',
        type: 'image/png',
      },
      {
        url: '/favicon-32x32.png',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        url: '/favicon-96x96.png',
        sizes: '96x96',
        type: 'image/png',
      }
    ],
    apple: {
      url: '/apple-touch-icon.png',
      sizes: '180x180',
      type: 'image/png',
    },
    other: [
      {
        rel: 'mask-icon',
        url: '/safari-pinned-tab.svg',
        color: '#000000',
      }
    ]
  },
  manifest: '/site.webmanifest',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable} overflow-x-hidden`}>
        {children}
        <Toaster position="top-right" richColors closeButton />
        <BuildInfoDisplay position="bottom-left" compact={true} />
        <ClientOnly>
          <OfflineStatus />
          <OfflineDataInitializer />
          <SyncStatusLogger />
          <ServiceWorkerRegistration />
          <UpdateNotification />
        </ClientOnly>
        <BuildInfoLogger />
        <Analytics />
      </body>
    </html>
  )
}
