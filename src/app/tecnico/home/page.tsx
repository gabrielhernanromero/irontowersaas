import { getSession } from '@/lib/auth/getSession'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import Link from 'next/link'
import {
  Droplets, FlameKindling, CheckCircle2, ChevronRight,
  BookOpen, AlertTriangle, CircleDot, Lock,
} from 'lucide-react'

function getTurnoActual(): 'diurno' | 'nocturno' {
  return new Date().getHours() < 18 ? 'diurno' : 'nocturno'
}

export default async function TecnicoHome() {
  const { user } = await getSession()
  const turno = getTurnoActual()
  const hoy = new Date().toISOString().split('T')[0]

  const [{ data: planillasHoy }, { data: turnoActivo }] = await Promise.all([
    supabaseServer()
      .from('planillas')
      .select('tipo, inmutable, id')
      .eq('tecnico_id', user!.id)
      .eq('fecha', hoy)
      .eq('turno', turno),
    supabaseAdmin()
      .from('libro_turno')
      .select('id, folio_numero, horario_inicio')
      .eq('tecnico_id', user!.id)
      .eq('estado', 'abierto')
      .maybeSingle(),
  ])

  const enviada = (tipo: string) => planillasHoy?.find((p) => p.tipo === tipo && p.inmutable)
  const hidrantesEnviada = enviada('hidrantes')
  const extintoresEnviada = enviada('extintores')
  const turnoAbierto = !!turnoActivo

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div>
        <h1 className="text-2xl font-condensed font-bold text-brand-ink">
          Hola, {user?.nombre}
        </h1>
        <span className="inline-block mt-1 px-3 py-1 rounded-full text-sm font-medium bg-brand-blue text-white capitalize">
          Turno {turno}
        </span>
      </div>

      {/* Estado del turno — aviso prominente */}
      {turnoAbierto ? (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-3">
          <CircleDot size={16} className="text-green-500 animate-pulse shrink-0" />
          <p className="text-sm text-green-800">
            Turno activo — Folio #{turnoActivo.folio_numero} · Inicio {turnoActivo.horario_inicio?.slice(0, 5)}
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
          <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Sin turno abierto</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Antes de enviar planillas debés abrir tu turno en el Libro de Guardia.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {/* Hidrantes */}
        <PlanillaCard
          label="Planilla Hidrantes"
          sublabel="48 puntos de control"
          icon={<Droplets size={24} className="text-white" />}
          iconBg={hidrantesEnviada ? 'bg-green-500' : 'bg-brand-blue'}
          enviada={!!hidrantesEnviada}
          turnoAbierto={turnoAbierto}
          href={hidrantesEnviada ? `/tecnico/historial/${hidrantesEnviada.id}` : '/tecnico/hidrantes'}
        />

        {/* Extintores */}
        <PlanillaCard
          label="Planilla Extintores"
          sublabel="113 puntos de control"
          icon={<FlameKindling size={24} className="text-white" />}
          iconBg={extintoresEnviada ? 'bg-green-500' : 'bg-brand-orange'}
          enviada={!!extintoresEnviada}
          turnoAbierto={turnoAbierto}
          href={extintoresEnviada ? `/tecnico/historial/${extintoresEnviada.id}` : '/tecnico/extintores'}
        />

        {/* Libro de Guardia */}
        <Link
          href="/tecnico/libro-guardia"
          className="flex items-center gap-4 bg-white rounded-xl p-5 shadow-sm border border-gray-100 min-h-[88px] active:bg-gray-50"
        >
          <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-brand-ink">
            <BookOpen className="text-white" size={24} />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-brand-ink text-lg">Libro de Guardia</p>
            <p className="text-sm text-gray-500">
              {turnoAbierto ? 'Ver novedades · Agregar · Cerrar turno' : 'Abrir turno para empezar'}
            </p>
          </div>
          <ChevronRight size={18} className="text-gray-300 shrink-0" />
        </Link>
      </div>
    </div>
  )
}

function PlanillaCard({
  label, sublabel, icon, iconBg, enviada, turnoAbierto, href,
}: {
  label: string
  sublabel: string
  icon: React.ReactNode
  iconBg: string
  enviada: boolean
  turnoAbierto: boolean
  href: string
}) {
  const bloqueada = !turnoAbierto && !enviada

  if (bloqueada) {
    return (
      <div className="flex items-center gap-4 bg-white rounded-xl p-5 shadow-sm border border-gray-100 min-h-[88px] opacity-60">
        <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-gray-300">
          <Lock size={22} className="text-white" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-brand-ink text-lg">{label}</p>
          <p className="text-sm text-gray-400">Abrí tu turno primero</p>
        </div>
      </div>
    )
  }

  return (
    <Link
      href={href}
      className={`flex items-center gap-4 bg-white rounded-xl p-5 shadow-sm border min-h-[88px] active:bg-gray-50 ${
        enviada ? 'border-green-200' : 'border-gray-100'
      }`}
    >
      <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>
        {enviada ? <CheckCircle2 size={24} className="text-white" /> : icon}
      </div>
      <div className="flex-1">
        <p className="font-semibold text-brand-ink text-lg">{label}</p>
        <p className={`text-sm ${enviada ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
          {enviada ? 'Enviada — Ver detalle' : `${sublabel} · Pendiente`}
        </p>
      </div>
      <ChevronRight size={18} className="text-gray-300 shrink-0" />
    </Link>
  )
}
