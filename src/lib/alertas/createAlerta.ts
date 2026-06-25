import { supabaseAdmin } from '@/lib/supabase/admin'
import type { TipoAlerta } from '@/types/database'

export async function alertarSupervisores(
  tipo: TipoAlerta,
  mensaje: string,
  planillaIdOrOptions?: string | { planillaId?: string; turnoId?: string }
): Promise<void> {
  const admin = supabaseAdmin()

  const planillaId = typeof planillaIdOrOptions === 'string'
    ? planillaIdOrOptions
    : planillaIdOrOptions?.planillaId
  const turnoId = typeof planillaIdOrOptions === 'object'
    ? planillaIdOrOptions?.turnoId
    : undefined

  const { data: supervisores, error: fetchErr } = await admin
    .from('users')
    .select('id')
    .in('rol', ['admin', 'supervisor'])
    .eq('activo', true)

  if (fetchErr) throw new Error(`Error fetching supervisores: ${fetchErr.message}`)
  if (!supervisores?.length) return

  const alertas = supervisores.map((s) => ({
    tipo,
    mensaje,
    leida: false,
    destinatario_id: s.id,
    planilla_id: planillaId ?? null,
    turno_id: turnoId ?? null,
  }))

  const { error: insertErr } = await admin.from('alertas').insert(alertas)
  if (insertErr) throw new Error(`Error inserting alertas: ${insertErr.message}`)
}
