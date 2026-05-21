import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { AbrirTurnoSchema } from '@/lib/validations/libroTurno'

async function uploadFirma(dataUrl: string, userId: string, prefix: string): Promise<string> {
  const base64 = dataUrl.split(',')[1]
  if (!base64) throw new Error('dataUrl inválido')
  const buffer = Buffer.from(base64, 'base64')
  const path = `${userId}/${prefix}-${Date.now()}.png`
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

  const parsed = AbrirTurnoSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', issues: parsed.error.flatten() }, { status: 422 })
  }

  const { fecha, turno, tecnico_nombre, tecnico_dni, horario_inicio, cliente_id, turno_saliente_id, relevo_firma_dataurl } = parsed.data

  // Verificar que no hay turno abierto propio
  const { data: turnoAbierto } = await supabaseAdmin()
    .from('libro_turno')
    .select('id')
    .eq('tecnico_id', user.id)
    .eq('estado', 'abierto')
    .maybeSingle()

  if (turnoAbierto) {
    return NextResponse.json({ error: 'Ya tenés un turno abierto. Cerralo antes de iniciar uno nuevo.' }, { status: 409 })
  }

  // Firmar relevo del turno saliente si corresponde
  if (turno_saliente_id && relevo_firma_dataurl) {
    try {
      const firmaPath = await uploadFirma(relevo_firma_dataurl, user.id, 'relevo')
      await supabaseAdmin()
        .from('libro_turno')
        .update({
          estado: 'cerrado',
          firma_relevo_url: firmaPath,
          relevo_nombre: tecnico_nombre,
          relevo_dni: tecnico_dni,
        })
        .eq('id', turno_saliente_id)
        .in('estado', ['cerrado', 'pendiente_relevo'])
    } catch {
      return NextResponse.json({ error: 'Error al registrar la firma del relevo' }, { status: 500 })
    }
  }

  // Crear el nuevo turno
  const { data: nuevoTurno, error: insertErr } = await supabaseAdmin()
    .from('libro_turno')
    .insert({
      fecha,
      turno,
      tecnico_id: user.id,
      tecnico_nombre,
      tecnico_dni,
      horario_inicio,
      cliente_id: cliente_id ?? null,
      estado: 'abierto',
    })
    .select()
    .single()

  if (insertErr || !nuevoTurno) {
    return NextResponse.json({ error: 'Error al crear el turno' }, { status: 500 })
  }

  // Novedad de apertura automática
  await supabaseAdmin()
    .from('libro_novedad')
    .insert({
      turno_id: nuevoTurno.id,
      tecnico_id: user.id,
      tipo: 'apertura',
      hora: horario_inicio,
      descripcion: 'Apertura de guardia',
    })

  return NextResponse.json(nuevoTurno, { status: 201 })
}
