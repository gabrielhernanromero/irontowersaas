import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { alertarSupervisores } from '@/lib/alertas/createAlerta'

function getTurnoActual(): 'diurno' | 'nocturno' {
  return new Date().getHours() < 18 ? 'diurno' : 'nocturno'
}

function getFechaHoy(): string {
  return new Date().toISOString().split('T')[0]
}

export async function GET(req: NextRequest) {
  // Regla 5: verificar CRON_SECRET
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const admin = supabaseAdmin()
  const turno = getTurnoActual()
  const fecha = getFechaHoy()

  // Obtener todos los técnicos activos
  const { data: tecnicos, error: tecnicosErr } = await admin
    .from('users')
    .select('id, nombre, apellido')
    .eq('rol', 'tecnico')
    .eq('activo', true)

  if (tecnicosErr || !tecnicos?.length) {
    return NextResponse.json({ ok: true, alertados: 0 })
  }

  // Obtener quiénes ya enviaron planilla en este turno
  const { data: enviadas } = await admin
    .from('planillas')
    .select('tecnico_id')
    .eq('fecha', fecha)
    .eq('turno', turno)
    .eq('inmutable', true)

  const tecnicosConPlanilla = new Set((enviadas ?? []).map((p) => p.tecnico_id))

  // Técnicos que NO enviaron
  const pendientes = tecnicos.filter((t) => !tecnicosConPlanilla.has(t.id))

  let alertados = 0
  for (const tecnico of pendientes) {
    await alertarSupervisores(
      'planilla_pendiente',
      `${tecnico.nombre} ${tecnico.apellido} no envió planilla del turno ${turno} (${fecha})`,
    )
    alertados++
  }

  return NextResponse.json({ ok: true, turno, fecha, alertados })
}
