import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { ReporteFallaSchema } from '@/lib/validations/inventario'

export async function POST(request: Request) {
  const user = await requireRole('tecnico', 'admin')

  try {
    const body = await request.json()
    const validated = ReporteFallaSchema.parse(body)
    const hora = new Date().toTimeString().slice(0, 8) // HH:MM:SS

    const { data: elem } = await supabaseAdmin()
      .from('elementos_puesto')
      .select('nombre, codigo_patrimonial, cliente_id')
      .eq('id', validated.elementoId)
      .single()

    if (!elem) return NextResponse.json({ error: 'Elemento no encontrado' }, { status: 404 })

    const titulo = `[DESPERFECTO EN GUARDIA] ${elem.nombre}`

    // Crear incidencia voluntaria — el técnico asume la trazabilidad del evento
    await supabaseAdmin()
      .from('incidencias')
      .insert({
        cliente_id:           elem.cliente_id,
        turno_creacion_id:    validated.turnoId,
        titulo,
        descripcion: [
          'El técnico reportó voluntariamente un daño ocurrido durante su turno.',
          `Detalle: "${validated.descripcionFalla}"`,
          `Activo: ${elem.codigo_patrimonial}`,
        ].join('\n\n'),
        severidad:            'medio',
        estado:               'abierto',
        elemento_afectado_id: validated.elementoId,
        tecnico_detector_id:  user.id,
        tecnico_imputado_id:  user.id,
        turno_imputado_id:    validated.turnoId,
      })

    // Asentar en el feed del libro de novedades del turno activo
    await supabaseAdmin()
      .from('libro_novedad')
      .insert({
        turno_id:    validated.turnoId,
        tipo:        'novedad',
        hora,
        descripcion: `[DAÑO DE MATERIAL] ${elem.nombre} (${elem.codigo_patrimonial}): ${validated.descripcionFalla}`,
      })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
