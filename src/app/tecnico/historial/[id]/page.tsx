import { supabaseServer } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/getSession'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, Clock, ArrowLeft, Lock } from 'lucide-react'

export default async function PlanillaDetalleTecnicoPage({
  params,
}: {
  params: { id: string }
}) {
  const { user } = await getSession()
  const sb = supabaseServer()

  const { data: planilla } = await sb
    .from('planillas')
    .select('*, clientes(nombre_empresa, direccion)')
    .eq('id', params.id)
    .eq('tecnico_id', user!.id) // técnico solo ve SUS planillas
    .single()

  if (!planilla) notFound()

  const [{ data: hidrantes }, { data: extintores }] = await Promise.all([
    sb.from('planilla_hidrantes').select('*').eq('planilla_id', params.id).order('numero'),
    sb.from('planilla_extintores').select('*').eq('planilla_id', params.id).order('numero'),
  ])

  const esHidrante = planilla.tipo === 'hidrantes'
  const items = (esHidrante ? hidrantes : extintores) ?? []

  // Firma: signed URL de 60 segundos
  let firmaUrl: string | null = null
  if (planilla.firma_url) {
    const { data } = await sb.storage.from('firmas').createSignedUrl(planilla.firma_url, 60)
    firmaUrl = data?.signedUrl ?? null
  }

  return (
    <div className="max-w-xl pb-8">
      {/* Volver */}
      <Link
        href="/tecnico/historial"
        className="flex items-center gap-1 text-sm text-gray-500 mb-4"
      >
        <ArrowLeft size={16} />
        Historial
      </Link>

      {/* Estado */}
      {planilla.inmutable ? (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
          <Lock className="text-green-600 shrink-0" size={20} />
          <div>
            <p className="font-semibold text-green-800 text-sm">Planilla enviada</p>
            <p className="text-green-700 text-xs">
              Esta planilla está cerrada y no puede modificarse.
            </p>
          </div>
          <CheckCircle2 className="text-green-500 shrink-0 ml-auto" size={22} />
        </div>
      ) : (
        <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4">
          <Clock className="text-yellow-600 shrink-0" size={20} />
          <div>
            <p className="font-semibold text-yellow-800 text-sm">No enviada</p>
            <p className="text-yellow-700 text-xs">Esta planilla no fue enviada correctamente.</p>
          </div>
        </div>
      )}

      {/* Encabezado */}
      <div className="bg-white rounded-xl p-4 mb-4 border border-gray-100">
        <h1 className="text-lg font-condensed font-bold text-brand-ink capitalize mb-3">
          Planilla de {planilla.tipo}
        </h1>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-gray-500">Cliente</dt>
          <dd className="font-medium truncate">{(planilla as any).clientes?.nombre_empresa}</dd>
          <dt className="text-gray-500">Fecha</dt>
          <dd>{planilla.fecha}</dd>
          <dt className="text-gray-500">Turno</dt>
          <dd className="capitalize">{planilla.turno}</dd>
        </dl>
      </div>

      {/* Ítems */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brand-ink text-white text-xs">
              <tr>
                <th className="px-3 py-2 text-left">N°</th>
                {esHidrante ? (
                  <>
                    <th className="px-2 py-2">Gab.</th>
                    <th className="px-2 py-2">Manga</th>
                    <th className="px-2 py-2">Lanza</th>
                    <th className="px-2 py-2">Válv.</th>
                  </>
                ) : (
                  <>
                    <th className="px-2 py-2 text-left">Tipo</th>
                    <th className="px-2 py-2">Señal.</th>
                    <th className="px-2 py-2">Acc.</th>
                    <th className="px-2 py-2">P/P</th>
                  </>
                )}
                <th className="px-3 py-2 text-left">Obs.</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: Record<string, unknown>, i: number) => {
                const hasNo = esHidrante
                  ? !item.gabinete || !item.manga || !item.lanza || !item.valvula
                  : !item.senalizacion || !item.acceso || !item.presion_peso

                const obs = esHidrante
                  ? [
                      item.obs_gabinete ? `Gab: ${item.obs_gabinete}` : null,
                      item.obs_manga ? `Manga: ${item.obs_manga}` : null,
                      item.obs_lanza ? `Lanza: ${item.obs_lanza}` : null,
                      item.obs_valvula ? `Válv: ${item.obs_valvula}` : null,
                    ].filter(Boolean).join(' · ')
                  : [
                      item.obs_senalizacion ? `Señal: ${item.obs_senalizacion}` : null,
                      item.obs_acceso ? `Acc: ${item.obs_acceso}` : null,
                      item.obs_presion_peso ? `P/P: ${item.obs_presion_peso}` : null,
                    ].filter(Boolean).join(' · ')

                return (
                  <tr
                    key={item.id as string}
                    className={`border-b border-gray-100 ${i % 2 === 1 ? 'bg-gray-50' : ''} ${hasNo ? 'bg-red-50' : ''}`}
                  >
                    <td className="px-3 py-2 font-mono text-xs">{item.numero as string}</td>
                    {esHidrante ? (
                      <>
                        <td className="px-2 py-2 text-center">{badge(item.gabinete as boolean)}</td>
                        <td className="px-2 py-2 text-center">{badge(item.manga as boolean)}</td>
                        <td className="px-2 py-2 text-center">{badge(item.lanza as boolean)}</td>
                        <td className="px-2 py-2 text-center">{badge(item.valvula as boolean)}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-2 py-2 text-xs">{item.tipo as string}</td>
                        <td className="px-2 py-2 text-center">{badge(item.senalizacion as boolean)}</td>
                        <td className="px-2 py-2 text-center">{badge(item.acceso as boolean)}</td>
                        <td className="px-2 py-2 text-center">{badge(item.presion_peso as boolean)}</td>
                      </>
                    )}
                    <td className="px-3 py-2 text-gray-500 text-xs">{obs || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Firma */}
      {firmaUrl && (
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <p className="text-sm font-medium text-brand-ink mb-1">Firma del técnico</p>
          {planilla.firma_aclaracion && (
            <p className="text-xs text-gray-500 mb-2">{planilla.firma_aclaracion}</p>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={firmaUrl}
            alt="Firma"
            className="max-w-[200px] border border-gray-200 rounded"
          />
        </div>
      )}
    </div>
  )
}

function badge(value: boolean) {
  return (
    <span
      className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold ${
        value ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
      }`}
    >
      {value ? 'SI' : 'NO'}
    </span>
  )
}
