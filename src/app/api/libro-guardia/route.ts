import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { LibroGuardiaSchema } from '@/lib/validations/libroGuardia'

export async function POST(req: NextRequest) {
  const {
    data: { user },
    error: authErr,
  } = await supabaseServer().auth.getUser()

  if (authErr || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = LibroGuardiaSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', issues: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const {
    planilla_id,
    fecha,
    turno,
    horario_inicio,
    horario_fin,
    sin_novedades,
    hora,
    descripcion,
    riesgo_detectado,
    medidas_adoptadas,
    observaciones_generales,
  } = parsed.data

  const foto_url = (body as { foto_url?: string }).foto_url ?? null

  const { data, error } = await supabaseAdmin()
    .from('libro_guardia')
    .insert({
      planilla_id: planilla_id ?? null,
      tecnico_id: user.id,
      fecha,
      turno,
      horario_inicio,
      horario_fin,
      sin_novedades,
      // horario_inicio usado como fallback hasta que se aplique la migración DROP NOT NULL
      hora: sin_novedades ? horario_inicio : hora,
      descripcion: sin_novedades ? null : descripcion,
      riesgo_detectado: sin_novedades ? null : riesgo_detectado,
      medidas_adoptadas: sin_novedades ? null : medidas_adoptadas,
      observaciones_generales: observaciones_generales ?? null,
      foto_url: sin_novedades ? null : foto_url,
    })
    .select()
    .single()

  if (error) {
    console.error('libro_guardia insert error:', error)
    return NextResponse.json({ error: 'Error al registrar el libro de guardia' }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
