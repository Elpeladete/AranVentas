import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'sonner'
import './globals.css'

export const metadata: Metadata = {
  title: 'ARAN Tecnologías - Sistema de Órdenes de Servicio',
  description: 'Sistema digital para la gestión de órdenes de servicio técnico de ARAN Tecnologías',
  generator: 'AranServices',
  keywords: ['ARAN', 'tecnologías', 'servicio técnico', 'órdenes', 'formulario'],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        {children}
        <Toaster position="top-right" richColors closeButton />
        <Analytics />
      </body>
    </html>
  )
}
