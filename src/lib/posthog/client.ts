import posthog from 'posthog-js'

export function initPostHog() {
  if (typeof window === 'undefined') return
  if (posthog.__loaded) return

  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    capture_pageview: false, // lo manejamos manualmente con el App Router
    capture_pageleave: true,
    autocapture: true,
    session_recording: {
      maskAllInputs: true,   // no grabar campos de formularios (firmas, etc.)
    },
    loaded: (ph) => {
      if (process.env.NODE_ENV === 'development') ph.opt_out_capturing()
    },
  })
}

export { posthog }
