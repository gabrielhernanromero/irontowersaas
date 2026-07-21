import { supabaseServer } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { respuestaEsNovedad, type CampoDef } from '@/lib/validations/planillaGenerica'
import FotoCell from './FotoCell'

export default async function PlanillaDetallePage({
  params,
}: {
  params: { id: string }
}) {
  const sb = supabaseServer()

  const { data: planilla } = await sb
    .from('planillas')
    .select(`
      *,
      users!tecnico_id(nombre, apellido),
      clientes(nombre_empresa, direccion, cuit)
    `)
    .eq('id', params.id)
    .single()

  if (!planilla) notFound()

  const [{ data: hidrantes }, { data: extintores }, { data: respuestasGenerico }] = await Promise.all([
    sb.from('planilla_hidrantes').select('*').eq('planilla_id', params.id).order('numero'),
    sb.from('planilla_extintores').select('*').eq('planilla_id', params.id).order('numero'),
    sb.from('planilla_item_respuestas').select('*').eq('planilla_id', params.id).order('numero'),
  ])

  // Motor genérico: la planilla trae su propio snapshot de campos configurados
  // al momento del envío — no depende de la config actual del supervisor.
  const camposGenerico = (planilla.snapshot_config as { campos?: CampoDef[] } | null)?.campos
  const esGenerico = !hidrantes?.length && !extintores?.length && !!camposGenerico?.length

  // Obtener URL firmada de la firma (60 segundos)
  let firmaUrl: string | null = null
  if (planilla.firma_url) {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/storage/signed-url?path=${encodeURIComponent(planilla.firma_url)}`,
      { cache: 'no-store' }
    )
    if (res.ok) {
      const { url } = await res.json()
      firmaUrl = url
    }
  }

  const items = hidrantes ?? extintores ?? []
  const esHidrante = (planilla.tipo as string) === 'hidrantes'

  return (
    <div className="max-w-3xl">
      {/* Encabezado */}
      <div className="bg-white rounded-xl p-5 mb-4 border border-gray-100">
        <h1 className="text-xl font-condensed font-bold text-brand-ink capitalize mb-3">
          Planilla de {planilla.tipo}
        </h1>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-gray-500">Cliente</dt>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <dd className="font-medium">{(planilla as any).clientes?.nombre_empresa}</dd>
          <dt className="text-gray-500">Técnico</dt>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <dd>{(planilla as any).users?.nombre} {(planilla as any).users?.apellido}</dd>
          <dt className="text-gray-500">Fecha</dt>
          <dd>{planilla.fecha} · turno {planilla.turno}</dd>
          <dt className="text-gray-500">Estado</dt>
          <dd>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                planilla.inmutable
                  ? 'bg-green-100 text-green-700'
                  : 'bg-yellow-100 text-yellow-700'
              }`}
            >
              {planilla.inmutable ? 'Enviada' : 'Borrador'}
            </span>
          </dd>
        </dl>
      </div>

      {/* Tabla de ítems */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-4">
        <div className="overflow-x-auto">
          {esGenerico ? (
            <table className="w-full text-sm">
              <thead className="bg-brand-ink text-white">
                <tr>
                  <th className="px-3 py-2 text-left">N°</th>
                  {camposGenerico!.map((campo) => (
                    <th key={campo.clave} className="px-3 py-2">{campo.etiqueta}</th>
                  ))}
                  <th className="px-3 py-2 text-left">Observaciones</th>
                  <th className="px-3 py-2">Foto</th>
                </tr>
              </thead>
              <tbody>
                {(respuestasGenerico ?? []).map((item) => {
                  const respuestas = (item.respuestas ?? {}) as Record<string, unknown>
                  const observaciones = (item.observaciones ?? {}) as Record<string, string | null>
                  const hasNo = camposGenerico!.some((c) => respuestaEsNovedad(c, respuestas[c.clave]))

                  return (
                    <tr
                      key={item.id as string}
                      className={`border-b border-gray-100 ${hasNo ? 'bg-red-50' : ''}`}
                    >
                      <td className="px-3 py-2 font-mono">{item.numero as string}</td>
                      {camposGenerico!.map((campo) => (
                        <td key={campo.clave} className="px-3 py-2 text-center">
                          {campo.tipo_campo === 'check' || campo.tipo_campo === undefined
                            ? cell(respuestas[campo.clave] as boolean)
                            : String(respuestas[campo.clave] ?? '—')}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-gray-600 text-xs">
                        {camposGenerico!
                          .map((c) => observaciones[c.clave] ? `${c.etiqueta}: ${observaciones[c.clave]}` : null)
                          .filter(Boolean).join(' | ') || '—'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {item.foto_url ? <FotoCell url={item.foto_url as string} /> : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-brand-ink text-white">
                <tr>
                  <th className="px-3 py-2 text-left">N°</th>
                  {esHidrante ? (
                    <>
                      <th className="px-3 py-2">Gabinete</th>
                      <th className="px-3 py-2">Manga</th>
                      <th className="px-3 py-2">Lanza</th>
                      <th className="px-3 py-2">Válvula</th>
                    </>
                  ) : (
                    <>
                      <th className="px-3 py-2">Tipo</th>
                      <th className="px-3 py-2">Señal.</th>
                      <th className="px-3 py-2">Acceso</th>
                      <th className="px-3 py-2">Pres/Pes</th>
                    </>
                  )}
                  <th className="px-3 py-2 text-left">Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: Record<string, unknown>, i: number) => {
                  const hasNo = esHidrante
                    ? !item.gabinete || !item.manga || !item.lanza || !item.valvula
                    : !item.senalizacion || !item.acceso || !item.presion_peso

                  return (
                    <tr
                      key={item.id as string}
                      className={`border-b border-gray-100 ${hasNo ? 'bg-red-50' : ''}`}
                    >
                      <td className="px-3 py-2 font-mono">{item.numero as string}</td>
                      {esHidrante ? (
                        <>
                          <td className="px-3 py-2 text-center">{cell(item.gabinete as boolean)}</td>
                          <td className="px-3 py-2 text-center">{cell(item.manga as boolean)}</td>
                          <td className="px-3 py-2 text-center">{cell(item.lanza as boolean)}</td>
                          <td className="px-3 py-2 text-center">{cell(item.valvula as boolean)}</td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-2">{item.tipo as string}</td>
                          <td className="px-3 py-2 text-center">{cell(item.senalizacion as boolean)}</td>
                          <td className="px-3 py-2 text-center">{cell(item.acceso as boolean)}</td>
                          <td className="px-3 py-2 text-center">{cell(item.presion_peso as boolean)}</td>
                        </>
                      )}
                      <td className="px-3 py-2 text-gray-600 text-xs">
                        {esHidrante
                          ? [
                              item.obs_gabinete ? `Gabinete: ${item.obs_gabinete}` : null,
                              item.obs_manga ? `Manga: ${item.obs_manga}` : null,
                              item.obs_lanza ? `Lanza: ${item.obs_lanza}` : null,
                              item.obs_valvula ? `Válvula: ${item.obs_valvula}` : null,
                            ].filter(Boolean).join(' | ') || '—'
                          : [
                              item.obs_senalizacion ? `Señal.: ${item.obs_senalizacion}` : null,
                              item.obs_acceso ? `Acceso: ${item.obs_acceso}` : null,
                              item.obs_presion_peso ? `Pres/Pes: ${item.obs_presion_peso}` : null,
                            ].filter(Boolean).join(' | ') || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Firma */}
      {firmaUrl && (
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <p className="text-sm font-medium text-brand-ink mb-2">Firma del técnico</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={firmaUrl} alt="Firma" className="max-w-xs border border-gray-200 rounded" />
        </div>
      )}
    </div>
  )
}

function cell(value: boolean) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
        value ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
      }`}
    >
      {value ? 'SI' : 'NO'}
    </span>
  )
}
