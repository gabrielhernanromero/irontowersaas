import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             'Iron Tower OS',
    short_name:       'Iron Tower',
    description:      'Sistema de gestión de operaciones de campo',
    start_url:        '/',
    display:          'standalone',
    background_color: '#ffffff',
    theme_color:      '#E8721C',
    orientation:      'portrait',
    icons: [
      {
        src:     '/icon',
        sizes:   '512x512',
        type:    'image/png',
        purpose: 'any',
      },
      {
        src:     '/icon',
        sizes:   '192x192',
        type:    'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
