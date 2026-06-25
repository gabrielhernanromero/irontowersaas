import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const Schema = z.object({
  scan_id:              z.string().uuid(),
  descripcion:          z.string().min(3, 'La descripción debe tener al menos 3 caracteres'),
  es_incidencia:        z.boolean().optional(),
  incidencia_severidad: z.enum(['bajo', 'medio', 'alto']).optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { data: { user }, error: authErr } = await supabaseServer().auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 422 })
  }

  const { scan_id, descripcion, es_incidencia, incidencia_severidad } = parsed.data

  // Verificar que la ronda pertenece al técnico
  const { data: ronda } = await supabaseAdmin()
    .from('rondas')
    .select('id, tecnico_id, cliente_id, turno_id, numero_ronda')
    .eq('id', params.id)
    .single()

  if (!ronda)                        return NextResponse.json({ error: 'Ronda no encontrada' }, { status: 404 })
  if (ronda.tecnico_id !== user.id)  return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  if (!ronda.turno_id)               return NextResponse.json({ error: 'La ronda no tiene turno asociado' }, { status: 409 })

  // Verificar turno activo
  const { data: turno } = await supabaseAdmin()
    .from('libro_turno')
    .select('id, estado')
    .eq('id', ronda.turno_id)
    .single()

  if (!turno || turno.estado !== 'abierto') {
    return NextResponse.json({ error: 'El turno está cerrado' }, { status: 409 })
  }

  // Obtener nombre del punto desde el scan
  const { data: scan } = await supabaseAdmin()
    .from('ronda_scans')
    .select('id, puntos_control(nombre)')
    .eq('id', scan_id)
    .eq('ronda_id', params.id)
    .single()

  if (!scan) return NextResponse.json({ error: 'Scan no encontrado en esta ronda' }, { status: 404 })

  const puntoNombre = (scan.puntos_control as unknown as { nombre: string } | null)?.nombre ?? 'Punto de control'

  const hora = new Date().toLocaleTimeString('es-AR', {
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  })

  // Crear incidencia si corresponde
  let incidenciaId: string | null = null
  if (es_incidencia) {
    const { data: inc } = await supabaseAdmin()
      .from('incidencias')
      .insert({
        cliente_id:        ronda.cliente_id,
        turno_creacion_id: ronda.turno_id,
        titulo:            `Ronda #${ronda.numero_ronda} — ${puntoNombre}`,
        descripcion,
        severidad:         incidencia_severidad ?? 'medio',
        estado:            'abierto',
      })
      .select('id')
      .single()

    if (inc) incidenciaId = inc.id
  }

  // Crear novedad en el libro de guardia
  const { data: novedad, error: novErr } = await supabaseAdmin()
    .from('libro_novedad')
    .insert({
      turno_id:     ronda.turno_id,
      tecnico_id:   user.id,
      tipo:         'novedad',
      hora,
      descripcion:  `[Ronda #${ronda.numero_ronda} — ${puntoNombre}] ${descripcion}`,
      incidencia_id: incidenciaId,
    })
    .select('id, descripcion, hora, incidencia_id')
    .single()

  if (novErr || !novedad) {
    return NextResponse.json({ error: 'Error al registrar la novedad' }, { status: 500 })
  }

  // Vincular la novedad al scan (columna novedad_id debe existir en ronda_scans)
  await supabaseAdmin()
    .from('ronda_scans')
    .update({ novedad_id: novedad.id })
    .eq('id', scan_id)

  return NextResponse.json({ ok: true, novedad, incidencia_id: incidenciaId }, { status: 201 })
}
