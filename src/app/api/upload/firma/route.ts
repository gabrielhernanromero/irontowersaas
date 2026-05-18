import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const {
    data: { user },
    error: authErr,
  } = await supabaseServer().auth.getUser()

  if (authErr || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: 'No se envió archivo' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const path = `${user.id}/${Date.now()}.png`

  const { error } = await supabaseAdmin()
    .storage.from('firmas')
    .upload(path, buffer, { contentType: 'image/png' })

  if (error) {
    return NextResponse.json({ error: 'Error al subir la firma' }, { status: 500 })
  }

  return NextResponse.json({ path }, { status: 201 })
}
