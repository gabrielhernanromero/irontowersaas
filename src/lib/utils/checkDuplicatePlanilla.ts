import { supabaseAdmin } from '@/lib/supabase/admin'
import type { TipoPlanilla, Turno } from '@/types/database'

export async function checkDuplicatePlanilla(
  tecnicoId: string,
  tipo: TipoPlanilla,
  fecha: string,
  turno: Turno
): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .from('planillas')
    .select('id')
    .eq('tecnico_id', tecnicoId)
    .eq('tipo', tipo)
    .eq('fecha', fecha)
    .eq('turno', turno)
    .maybeSingle()

  if (error) throw new Error(`Error checking duplicate: ${error.message}`)
  return data !== null
}
