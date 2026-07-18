import { supabaseAdmin } from '@/lib/supabase/admin'
import type { TipoPlanilla } from '@/types/database'

export async function validateItemsMatchCatalog(
  clienteId: string,
  tipo: TipoPlanilla,
  numerosEnviados: string[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await supabaseAdmin()
    .from('planilla_items_config')
    .select('numero')
    .eq('cliente_id', clienteId)
    .eq('tipo', tipo)
    .eq('activo', true)

  if (error) throw new Error(`Error checking catalog: ${error.message}`)

  const catalogoNumeros = (data ?? []).map((d) => d.numero)
  const catalogo = new Set(catalogoNumeros)
  const enviados = new Set(numerosEnviados)

  const coincide =
    catalogo.size === enviados.size && catalogoNumeros.every((n) => enviados.has(n))

  if (!coincide) {
    return {
      ok: false,
      error: 'El listado de ítems cambió desde que abriste el formulario. Volvé a cargar la página e intentá de nuevo.',
    }
  }

  return { ok: true }
}
