import { supabaseAdmin } from '@/lib/supabase/admin'
import type { TipoPlanilla } from '@/types/database'

export async function checkDuplicatePlanilla(
  tecnicoId: string,
  tipo: TipoPlanilla,
  turnoId: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .from('planillas')
    .select('id')
    .eq('tecnico_id', tecnicoId)
    .eq('tipo', tipo)
    .eq('turno_id', turnoId)
    .eq('inmutable', true)
    .maybeSingle()

  if (error) throw new Error(`Error checking duplicate: ${error.message}`)
  return data !== null
}
