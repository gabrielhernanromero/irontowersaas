import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { CampoDef } from '@/lib/validations/planillaGenerica'

interface ItemFoto {
  numero: string
  label: string
  observacion: string | null
  foto_url: string | null
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try { await requireRole('supervisor', 'admin') } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const admin = supabaseAdmin()

  const { data: planilla } = await admin
    .from('planillas')
    .select('id, tipo, snapshot_config')
    .eq('id', params.id)
    .single()

  if (!planilla) return NextResponse.json({ error: 'Planilla no encontrada' }, { status: 404 })

  const [{ data: hidrantes }, { data: extintores }, { data: respuestasGenerico }] = await Promise.all([
    admin.from('planilla_hidrantes').select('*').eq('planilla_id', params.id).order('numero'),
    admin.from('planilla_extintores').select('*').eq('planilla_id', params.id).order('numero'),
    admin.from('planilla_item_respuestas').select('*').eq('planilla_id', params.id).order('numero'),
  ])

  const camposGenerico = (planilla.snapshot_config as { campos?: CampoDef[] } | null)?.campos
  const esGenerico = !hidrantes?.length && !extintores?.length && !!camposGenerico?.length
  const esHidrante = planilla.tipo === 'hidrantes'

  let items: ItemFoto[] = []

  if (esGenerico) {
    items = (respuestasGenerico ?? []).map((item) => {
      const observaciones = (item.observaciones ?? {}) as Record<string, string | null>
      const observacion = camposGenerico!
        .map((c) => observaciones[c.clave] ? `${c.etiqueta}: ${observaciones[c.clave]}` : null)
        .filter(Boolean).join(' | ') || null
      return {
        numero: item.numero as string,
        label: `Ítem ${item.numero}`,
        observacion,
        foto_url: (item.foto_url as string | null) ?? null,
      }
    })
  } else if (esHidrante) {
    items = (hidrantes ?? []).map((item) => ({
      numero: item.numero,
      label: `Hidrante ${item.numero}`,
      observacion: [
        item.obs_gabinete ? `Gabinete: ${item.obs_gabinete}` : null,
        item.obs_manga ? `Manga: ${item.obs_manga}` : null,
        item.obs_lanza ? `Lanza: ${item.obs_lanza}` : null,
        item.obs_valvula ? `Válvula: ${item.obs_valvula}` : null,
      ].filter(Boolean).join(' | ') || null,
      foto_url: item.foto_url ?? null,
    }))
  } else {
    items = (extintores ?? []).map((item) => ({
      numero: item.numero,
      label: `Extintor ${item.numero}${item.tipo ? ` · ${item.tipo}` : ''}`,
      observacion: [
        item.obs_senalizacion ? `Señal.: ${item.obs_senalizacion}` : null,
        item.obs_acceso ? `Acceso: ${item.obs_acceso}` : null,
        item.obs_presion_peso ? `Pres/Pes: ${item.obs_presion_peso}` : null,
      ].filter(Boolean).join(' | ') || null,
      foto_url: item.foto_url ?? null,
    }))
  }

  const conObservacionOFoto = items.filter((i) => i.observacion || i.foto_url)

  return NextResponse.json({ items: conObservacionOFoto })
}
