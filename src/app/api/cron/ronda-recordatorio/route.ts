import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  // Verificar secret del cron
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const ahora = new Date()

  // 1. Obtener todos los turnos activos con la config de rondas del cliente
  const { data: turnos, error: turnosErr } = await supabaseAdmin()
    .from('libro_turno')
    .select(`
      id, tecnico_id, cliente_id, created_at,
      clientes!inner(id, frecuencia_ronda_minutos, aviso_ronda_minutos, nombre_empresa)
    `)
    .in('estado', ['abierto', 'pendiente_relevo'])

  if (turnosErr || !turnos?.length) {
    return NextResponse.json({ ok: true, avisados: 0, mensaje: 'Sin turnos activos' })
  }

  // Filtrar solo los que tienen frecuencia configurada
  const turnosConConfig = turnos.filter(
    (t: any) => t.clientes?.frecuencia_ronda_minutos != null
  )

  if (!turnosConConfig.length) {
    return NextResponse.json({ ok: true, avisados: 0, mensaje: 'Sin clientes con frecuencia configurada' })
  }

  let avisados = 0
  const alertasInsert: { tipo: string; mensaje: string; destinatario_id: string; leida: boolean }[] = []

  for (const turno of turnosConConfig) {
    const cliente          = (turno as any).clientes
    const frecuenciaMin    = cliente.frecuencia_ronda_minutos as number
    const avisoMin         = (cliente.aviso_ronda_minutos as number) ?? 10

    // 2. Última ronda completada del turno
    const { data: lastRonda } = await supabaseAdmin()
      .from('rondas')
      .select('id, hora_inicio, hora_fin, completa')
      .eq('turno_id', turno.id)
      .order('hora_inicio', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Si hay una ronda en curso (sin hora_fin), no avisar
    if (lastRonda && !lastRonda.hora_fin && !lastRonda.completa) continue

    // Tiempo de referencia: fin de última ronda o inicio del turno
    const refTime = lastRonda?.hora_fin
      ? new Date(lastRonda.hora_fin)
      : new Date(turno.created_at)

    const minutosTranscurridos = (ahora.getTime() - refTime.getTime()) / 60000

    // ¿Estamos en la ventana de aviso?
    // Avisa cuando: (frecuencia - aviso) <= transcurrido < frecuencia
    const ventanaInicio = frecuenciaMin - avisoMin
    if (minutosTranscurridos < ventanaInicio || minutosTranscurridos >= frecuenciaMin) continue

    // 3. Evitar avisos duplicados — chequear si ya se envió en los últimos avisoMin minutos
    const ventanaDesde = new Date(ahora.getTime() - avisoMin * 60 * 1000).toISOString()
    const { data: alertaReciente } = await supabaseAdmin()
      .from('alertas')
      .select('id')
      .eq('destinatario_id', turno.tecnico_id)
      .eq('tipo', 'ronda_proxima')
      .gte('created_at', ventanaDesde)
      .limit(1)
      .maybeSingle()

    if (alertaReciente) continue  // Ya fue avisado

    // 4. Crear alerta para el técnico
    const minutosRestantes = Math.round(frecuenciaMin - minutosTranscurridos)
    alertasInsert.push({
      tipo:            'ronda_proxima',
      mensaje:         `Próxima ronda en ${minutosRestantes} min — ${cliente.nombre_empresa}`,
      destinatario_id: turno.tecnico_id,
      leida:           false,
    })
    avisados++
  }

  if (alertasInsert.length > 0) {
    await supabaseAdmin().from('alertas').insert(alertasInsert)
  }

  return NextResponse.json({ ok: true, avisados, timestamp: ahora.toISOString() })
}
