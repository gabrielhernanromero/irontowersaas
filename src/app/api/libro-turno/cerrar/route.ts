import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { CerrarTurnoSchema } from '@/lib/validations/libroTurno'

async function uploadFirma(dataUrl: string, userId: string): Promise<string> {
  const base64 = dataUrl.split(',')[1]
  if (!base64) throw new Error('dataUrl inválido')
  const buffer = Buffer.from(base64, 'base64')
  const path = `${userId}/cierre-${Date.now()}.png`
  const { error } = await supabaseAdmin()
    .storage.from('firmas')
    .upload(path, buffer, { contentType: 'image/png' })
  if (error) throw new Error('Error al subir firma')
  return path
}

export async function POST(req: NextRequest) {
  const { data: { user }, error: authErr } = await supabaseServer().auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = CerrarTurnoSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', issues: parsed.error.flatten() }, { status: 422 })
  }

  const { turno_id, horario_fin, firma_cierre_dataurl } = parsed.data

  // Verificar que el turno pertenece al técnico y está abierto
  const { data: turno } = await supabaseAdmin()
    .from('libro_turno')
    .select('id, estado, tecnico_id, tecnico_nombre, tecnico_dni')
    .eq('id', turno_id)
    .single()

  if (!turno) return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 })
  if (turno.tecnico_id !== user.id) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  if (turno.estado !== 'abierto') return NextResponse.json({ error: 'El turno no está abierto' }, { status: 409 })

  // Verificar que se enviaron ambas planillas del turno
  const { data: planillasEnviadas } = await supabaseAdmin()
    .from('planillas')
    .select('tipo')
    .eq('turno_id', turno_id)
    .eq('inmutable', true)

  const tiposEnviados = (planillasEnviadas ?? []).map((p) => p.tipo)
  const faltantes: string[] = []
  if (!tiposEnviados.includes('hidrantes')) faltantes.push('Hidrantes')
  if (!tiposEnviados.includes('extintores')) faltantes.push('Extintores')

  if (faltantes.length > 0) {
    return NextResponse.json(
      { error: `Debés enviar las planillas antes de cerrar el turno: ${faltantes.join(', ')}` },
      { status: 422 },
    )
  }

  // Subir firma de cierre
  let firmaCierreUrl: string
  try {
    firmaCierreUrl = await uploadFirma(firma_cierre_dataurl, user.id)
  } catch {
    return NextResponse.json({ error: 'Error al subir la firma' }, { status: 500 })
  }

  // Novedad de cierre auto-generada con datos del técnico del turno
  const descripcionCierre = `Cierre de guardia — ${turno.tecnico_nombre}, DNI ${turno.tecnico_dni}`

  await supabaseAdmin()
    .from('libro_novedad')
    .insert({
      turno_id,
      tecnico_id: user.id,
      tipo: 'cierre',
      hora: horario_fin,
      descripcion: descripcionCierre,
    })

  // Cerrar el turno
  const { data: turnoCerrado, error: updateErr } = await supabaseAdmin()
    .from('libro_turno')
    .update({
      estado: 'pendiente_relevo',
      horario_fin,
      firma_cierre_url: firmaCierreUrl,
    })
    .eq('id', turno_id)
    .select()
    .single()

  if (updateErr) return NextResponse.json({ error: 'Error al cerrar el turno' }, { status: 500 })

  return NextResponse.json(turnoCerrado, { status: 200 })
}
