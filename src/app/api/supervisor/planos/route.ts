import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { checkRateLimit, LIMITS } from '@/lib/rateLimit'

// El bucket "planos" es privado (expone el layout físico del predio del
// cliente) — se sirve siempre con signed URL, nunca con URL pública.
const SIGNED_URL_TTL_SECONDS = 3600

export async function GET(req: NextRequest) {
  try { await requireRole('supervisor', 'admin') } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const clienteId = req.nextUrl.searchParams.get('cliente_id')
  if (!clienteId) return NextResponse.json({ error: 'cliente_id requerido' }, { status: 400 })

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('planos_planta')
    .select('id, cliente_id, path, nombre, created_at')
    .eq('cliente_id', clienteId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ plano: null })

  const { data: signed } = await admin.storage
    .from('planos')
    .createSignedUrl(data.path, SIGNED_URL_TTL_SECONDS)

  return NextResponse.json({ plano: { ...data, url: signed?.signedUrl ?? null } })
}

export async function POST(req: NextRequest) {
  let user
  try { user = await requireRole('supervisor', 'admin') } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
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
  const clienteId = formData.get('cliente_id') as string | null
  const nombre = formData.get('nombre') as string | null

  if (!file) return NextResponse.json({ error: 'No se envió archivo' }, { status: 400 })
  if (!clienteId) return NextResponse.json({ error: 'cliente_id requerido' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = file.type === 'image/png' ? 'png' : 'jpg'
  const path = `${clienteId}/${Date.now()}.${ext}`

  const admin = supabaseAdmin()

  const { error: uploadErr } = await admin.storage
    .from('planos')
    .upload(path, buffer, { contentType: file.type })

  if (uploadErr) {
    return NextResponse.json({ error: 'Error al subir el plano' }, { status: 500 })
  }

  const { data: plano, error: dbErr } = await admin
    .from('planos_planta')
    .upsert(
      { cliente_id: clienteId, path, nombre: nombre || null },
      { onConflict: 'cliente_id' }
    )
    .select('id, cliente_id, path, nombre, created_at')
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  const { data: signed } = await admin.storage
    .from('planos')
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)

  return NextResponse.json({ ok: true, plano: { ...plano, url: signed?.signedUrl ?? null } }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  try { await requireRole('supervisor', 'admin') } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const clienteId = searchParams.get('cliente_id')
  if (!clienteId) return NextResponse.json({ error: 'cliente_id requerido' }, { status: 400 })

  const { error } = await supabaseAdmin()
    .from('planos_planta')
    .delete()
    .eq('cliente_id', clienteId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
