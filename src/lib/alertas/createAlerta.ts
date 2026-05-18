import { supabaseAdmin } from '@/lib/supabase/admin'
import type { TipoAlerta } from '@/types/database'

export async function alertarSupervisores(
  tipo: TipoAlerta,
  mensaje: string,
  planillaId?: string
): Promise<void> {
  const admin = supabaseAdmin()

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
  }))

  const { error: insertErr } = await admin.from('alertas').insert(alertas)
  if (insertErr) throw new Error(`Error inserting alertas: ${insertErr.message}`)
}
