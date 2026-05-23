import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { ReporteFallaSchema } from '@/lib/validations/inventario'

export async function POST(request: Request) {
  const user = await requireRole('tecnico', 'admin')

  try {
    const body = await request.json()
    const validated = ReporteFallaSchema.parse(body)
    const hora = new Date().toTimeString().slice(0, 8) // HH:MM:SS

    // ── Contexto: turno y elemento ────────────────────────────────────────────
    const [{ data: turno, error: turnoErr }, { data: elem, error: elemErr }] = await Promise.all([
      supabaseAdmin()
        .from('libro_turno')
        .select('id, cliente_id')
        .eq('id', validated.turnoId)
        .single(),
      supabaseAdmin()
        .from('elementos_puesto')
        .select('nombre, codigo_patrimonial')
        .eq('id', validated.elementoId)
        .single(),
    ])

    if (turnoErr || !turno) return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 })
    if (elemErr || !elem) return NextResponse.json({ error: 'Elemento no encontrado' }, { status: 404 })

    // ── Verificar estado actual del elemento ──────────────────────────────────
    const { data: incExistente } = await supabaseAdmin()
      .from('incidencias')
      .select('id, severidad')
      .eq('elemento_afectado_id', validated.elementoId)
      .eq('estado', 'abierto')
      .maybeSingle()

    const existeFalla    = incExistente?.severidad === 'medio'
    const existeExtravío = incExistente?.severidad === 'alto'

    // Extravío ya reportado — bloquear todo
    if (existeExtravío) {
      return NextResponse.json(
        { error: 'Este elemento ya tiene un extravío reportado.' },
        { status: 409 }
      )
    }

    // Spam de falla — solo bloquear si intenta crear otra falla sobre una falla abierta
    if (validated.tipo === 'dañado' && existeFalla) {
      return NextResponse.json(
        { error: 'Ya existe una falla reportada para este elemento. Podés escalarla a extravío.' },
        { status: 409 }
      )
    }

    const esExtraviado = validated.tipo === 'extraviado'
    const severidad    = esExtraviado ? 'alto' : 'medio'
    const tipoLabel    = esExtraviado ? 'ALERTA DE EXTRAVÍO' : 'DESPERFECTO EN GUARDIA'
    const titulo       = `[${tipoLabel}] ${elem.nombre}`

    // ── Escalada: extravío sobre falla → cerrar falla anterior ────────────────
    if (esExtraviado && existeFalla && incExistente) {
      const { error: closeErr } = await supabaseAdmin()
        .from('incidencias')
        .update({ estado: 'resuelto', turno_cierre_id: validated.turnoId })
        .eq('id', incExistente.id)

      if (closeErr) {
        console.error('[reportar-falla] error cerrando falla anterior:', JSON.stringify(closeErr))
      }
    }

    // ── 1. Crear incidencia nueva ─────────────────────────────────────────────
    const { data: nuevaInc, error: incErr } = await supabaseAdmin()
      .from('incidencias')
      .insert({
        cliente_id:           turno.cliente_id,
        turno_creacion_id:    validated.turnoId,
        titulo,
        descripcion: [
          esExtraviado
            ? 'El técnico reportó el extravío de este equipo durante su turno.'
            : 'El técnico reportó voluntariamente un daño ocurrido durante su turno.',
          esExtraviado && existeFalla
            ? 'NOTA: Se escaló desde una falla reportada previamente en este mismo turno.'
            : '',
          `Detalle: "${validated.descripcionFalla}"`,
          `Activo: ${elem.codigo_patrimonial}`,
        ].filter(Boolean).join('\n\n'),
        severidad,
        estado:               'abierto',
        elemento_afectado_id: validated.elementoId,
        tecnico_detector_id:  user.id,
        tecnico_imputado_id:  user.id,
        turno_imputado_id:    validated.turnoId,
        foto_url:             validated.fotoUrl ?? null,
      })
      .select('id')
      .single()

    if (incErr) {
      console.error('[reportar-falla] incidencias insert error:', JSON.stringify(incErr))
      return NextResponse.json(
        { error: `Error al registrar la incidencia: ${incErr.message}` },
        { status: 500 }
      )
    }

    // ── 2. Estampar en el libro de novedades del turno ────────────────────────
    const descripcionNovedad = esExtraviado && existeFalla
      ? `[${tipoLabel}] ${elem.nombre} (${elem.codigo_patrimonial}): ${validated.descripcionFalla} — ESCALADO desde falla previa`
      : `[${tipoLabel}] ${elem.nombre} (${elem.codigo_patrimonial}): ${validated.descripcionFalla}`

    const { error: novedadErr } = await supabaseAdmin()
      .from('libro_novedad')
      .insert({
        turno_id:     validated.turnoId,
        tipo:         'novedad',
        hora,
        descripcion:  descripcionNovedad,
        incidencia_id: nuevaInc?.id ?? null,
      })

    if (novedadErr) {
      console.error('[reportar-falla] libro_novedad insert error:', JSON.stringify(novedadErr))
    }

    // ── Invalidar caché del frontend ──────────────────────────────────────────
    revalidatePath('/tecnico/elementos')
    revalidatePath('/tecnico/libro-guardia')

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno'
    console.error('[reportar-falla] unexpected error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
