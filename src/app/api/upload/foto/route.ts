import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { checkRateLimit, LIMITS } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  const {
    data: { user },
    error: authErr,
  } = await supabaseServer().auth.getUser()

  if (authErr || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const rl = checkRateLimit(`upload:${user.id}`, LIMITS.upload)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Demasiadas subidas. Esperá un momento.' }, {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
    })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: 'No se envió archivo' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = file.type === 'image/png' ? 'png' : 'jpg'
  const path = `${user.id}/${Date.now()}.${ext}`

  const { error } = await supabaseAdmin()
    .storage.from('fotos')
    .upload(path, buffer, { contentType: file.type })

  if (error) {
    return NextResponse.json({ error: 'Error al subir la foto' }, { status: 500 })
  }

  const { data: { publicUrl } } = supabaseAdmin()
    .storage.from('fotos')
    .getPublicUrl(path)

  return NextResponse.json({ path: publicUrl }, { status: 201 })
}
