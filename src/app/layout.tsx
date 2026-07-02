import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister'
import SessionGuard from '@/components/SessionGuard'
import { ToastProvider } from '@/lib/toast/context'
import ToastContainer from '@/components/ui/ToastContainer'
import PWAUpdatePrompt from '@/components/PWAUpdatePrompt'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title:       'Iron Tower OS',
  description: 'Sistema de gestión de operaciones de campo — Iron Tower',
  appleWebApp: {
    capable:       true,
    statusBarStyle: 'black-translucent',
    title:         'Iron Tower',
  },
}

export const viewport: Viewport = {
  themeColor:    '#E8721C',
  width:         'device-width',
  initialScale:  1,
  maximumScale:  1,
  userScalable:  false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <ToastProvider>
          <ServiceWorkerRegister />
          <SessionGuard />
          <PWAUpdatePrompt />
          <ToastContainer />
          {children}
        </ToastProvider>
      </body>
    </html>
  )
}
