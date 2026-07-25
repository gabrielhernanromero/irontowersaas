'use client'

import { useState } from 'react'
import FotoLightbox, { FotoThumb } from '@/components/ui/FotoLightbox'

export default function FotoCell({ url }: { url: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <FotoThumb url={url} onClick={() => setOpen(true)} className="w-10 h-10 mx-auto" />
      {open && <FotoLightbox url={url} onClose={() => setOpen(false)} />}
    </>
  )
}
