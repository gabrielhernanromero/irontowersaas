import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { RelevoInventarioSchema } from '@/lib/validations/inventario'

export async function POST(request: Request) {
  const user = await requireRole('tecnico', 'admin')

  try {
    const body = await request.json()
    const validated = RelevoInventarioSchema.parse(body)
    const hora = new Date().toTimeString().slice(0, 8) // HH:MM:SS

    // Obtener el tecnico_id del turno saliente para imputación (una sola query)
    const { data: turnoAnterior } = await supabaseAdmin()
      .from('libro_turno')
      .select('tecnico_id')
      .eq('id', validated.turnoAnteriorId)
      .single()

    for (const control of validated.controles) {
      // 1. Insertar registro de auditoría (UNIQUE por turno+elemento previene duplicados)
      const { error: insError } = await supabaseAdmin()
        .from('control_inventario_turno')
        .insert({
          turno_id:          validated.turnoNuevoId,
          elemento_id:       control.elementoId,
          estado_operativo:  control.estadoOperativo,
          observacion:       control.observacion ?? null,
        })

      if (insError && insError.code !== '23505') {
        // 23505 = unique_violation: ya auditado, ignorar
        return NextResponse.json({ error: insError.message }, { status: 400 })
      }

      if (control.estadoOperativo === 'ok') continue

      // 2. Verificar que no exista ya una incidencia abierta para este elemento
      //    (evita crear tickets duplicados si el turno anterior ya la reportó)
      const { data: incExistente } = await supabaseAdmin()
        .from('incidencias')
        .select('id')
        .eq('elemento_afectado_id', control.elementoId)
        .eq('estado', 'abierto')
        .maybeSingle()

      if (incExistente) continue

      // 3. Obtener metadata del elemento para armar el ticket
      const { data: elem } = await supabaseAdmin()
        .from('elementos_puesto')
        .select('nombre, codigo_patrimonial')
        .eq('id', control.elementoId)
        .single()

      const esFaltante = control.estadoOperativo === 'faltante'
      const titulo = `${esFaltante ? '[FALTANTE CRÍTICO]' : '[FALLA DE INVENTARIO]'} ${elem?.nombre}`

      // 4. Crear incidencia automatizada con imputación al turno anterior
      await supabaseAdmin()
        .from('incidencias')
        .insert({
          cliente_id:            validated.clienteId,
          turno_creacion_id:     validated.turnoNuevoId,
          titulo,
          descripcion: [
            'Incidencia de control patrimonial generada durante el relevo de guardia.',
            `Hallazgo: "${control.observacion}"`,
            `Código patrimonial: ${elem?.codigo_patrimonial}`,
          ].join('\n\n'),
          severidad:             esFaltante ? 'alto' : 'medio',
          estado:                'abierto',
          elemento_afectado_id:  control.elementoId,
          tecnico_detector_id:   user.id,
          tecnico_imputado_id:   turnoAnterior?.tecnico_id ?? null,
          turno_imputado_id:     validated.turnoAnteriorId,
        })

      // 5. Asentar rastro legal en el libro de novedades del turno entrante
      await supabaseAdmin()
        .from('libro_novedad')
        .insert({
          turno_id:    validated.turnoNuevoId,
          tipo:        esFaltante ? 'alerta' : 'novedad',
          hora,
          descripcion: `${titulo}. Código: ${elem?.codigo_patrimonial}. ${control.observacion}`,
        })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
