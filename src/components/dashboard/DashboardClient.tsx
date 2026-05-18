'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { Planilla, Alerta } from '@/types/database'

interface Props {
  initialPlanillas: Planilla[]
  initialAlertas: Alerta[]
}

export default function DashboardClient({ initialPlanillas, initialAlertas }: Props) {
  const [planillas, setPlanillas] = useState<Planilla[]>(initialPlanillas)
  const [alertas, setAlertas] = useState<Alerta[]>(initialAlertas)

  useEffect(() => {
    const client = supabase()

    const planillasChannel = client
      .channel('planillas-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'planillas' },
        (payload) => {
          setPlanillas((prev) => [payload.new as Planilla, ...prev].slice(0, 20))
        }
      )
      .subscribe()

    const alertasChannel = client
      .channel('alertas-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'alertas' },
        (payload) => {
          setAlertas((prev) => [payload.new as Alerta, ...prev])
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'alertas' },
        (payload) => {
          setAlertas((prev) =>
            prev.map((a) => (a.id === payload.new.id ? (payload.new as Alerta) : a))
          )
        }
      )
      .subscribe()

    return () => {
      client.removeChannel(planillasChannel)
      client.removeChannel(alertasChannel)
    }
  }, [])

  const alertasNoLeidas = alertas.filter((a) => !a.leida)
  const planillasHoy = planillas.filter(
    (p) => p.fecha === new Date().toISOString().split('T')[0]
  )

  return (
    <div className="flex flex-col gap-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard
          label="Planillas hoy"
          value={planillasHoy.length}
          color="blue"
        />
        <KpiCard
          label="Alertas sin leer"
          value={alertasNoLeidas.length}
          color={alertasNoLeidas.length > 0 ? 'red' : 'green'}
        />
        <KpiCard
          label="Total planillas"
          value={planillas.length}
          color="gray"
        />
      </div>

      {/* Alertas recientes */}
      {alertasNoLeidas.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-brand-ink mb-3">
            Alertas recientes ({alertasNoLeidas.length})
          </h2>
          <div className="flex flex-col gap-2">
            {alertasNoLeidas.slice(0, 5).map((alerta) => (
              <div
                key={alerta.id}
                className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800"
              >
                {alerta.mensaje}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Planillas recientes */}
      <section>
        <h2 className="text-base font-semibold text-brand-ink mb-3">Planillas recientes</h2>
        {!planillas.length && (
          <p className="text-gray-500 text-sm">No hay planillas aún.</p>
        )}
        <div className="flex flex-col gap-2">
          {planillas.slice(0, 10).map((p) => (
            <a
              key={p.id}
              href={`/supervisor/planillas/${p.id}`}
              className="bg-white border border-gray-100 rounded-lg p-3 flex justify-between items-center hover:bg-gray-50"
            >
              <span className="font-medium text-brand-ink capitalize text-sm">{p.tipo}</span>
              <span className="text-xs text-gray-400">
                {p.fecha} · {p.turno}
              </span>
            </a>
          ))}
        </div>
      </section>
    </div>
  )
}

function KpiCard({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: 'blue' | 'red' | 'green' | 'gray'
}) {
  const colors = {
    blue: 'bg-blue-50 text-brand-blue',
    red: 'bg-red-50 text-red-700',
    green: 'bg-green-50 text-green-700',
    gray: 'bg-gray-50 text-gray-600',
  }

  return (
    <div className={`rounded-xl p-4 ${colors[color]}`}>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-sm mt-1">{label}</p>
    </div>
  )
}
