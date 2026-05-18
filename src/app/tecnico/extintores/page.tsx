import { requireRole } from '@/lib/auth/requireRole'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import ExtintoresForm from '@/components/forms/ExtintoresForm'
import type { Cliente } from '@/types/database'
import Link from 'next/link'
import { CheckCircle2, Eye } from 'lucide-react'

function getTurnoActual(): 'diurno' | 'nocturno' {
  return new Date().getHours() < 18 ? 'diurno' : 'nocturno'
}

export default async function ExtintoresPage() {
  const user = await requireRole('tecnico', 'admin')
  const hoy = new Date().toISOString().split('T')[0]
  const turno = getTurnoActual()

  const [{ data: clientes }, { data: planillaEnviada }] = await Promise.all([
    supabaseServer()
      .from('clientes')
      .select('id, nombre_empresa, cuit, direccion, contacto_nombre, contacto_email, contacto_telefono')
      .order('nombre_empresa'),
    supabaseAdmin()
      .from('planillas')
      .select('id, tipo, fecha, turno, inmutable')
      .eq('tecnico_id', user.id)
      .eq('tipo', 'extintores')
      .eq('fecha', hoy)
      .eq('turno', turno)
      .eq('inmutable', true)
      .maybeSingle(),
  ])

  if (planillaEnviada) {
    return (
      <div className="flex flex-col items-center justify-center gap-5 py-16 text-center px-4">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="text-green-600" size={36} />
        </div>
        <div>
          <h1 className="text-xl font-condensed font-bold text-brand-ink">Planilla ya enviada</h1>
          <p className="text-gray-500 text-sm mt-1">
            Ya registraste la planilla de extintores para el turno {turno} del {hoy}.
          </p>
        </div>
        <Link
          href={`/tecnico/historial/${planillaEnviada.id}`}
          className="flex items-center gap-2 bg-brand-ink text-white font-bold px-6 py-3 rounded-xl text-sm min-h-[48px]"
        >
          <Eye size={18} />
          Ver planilla enviada
        </Link>
        <Link href="/tecnico/home" className="text-sm text-brand-blue underline min-h-[44px] flex items-center">
          Volver al inicio
        </Link>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-xl font-condensed font-bold text-brand-ink mb-4">
        Planilla de Extintores
      </h1>
      <ExtintoresForm clientes={(clientes as Cliente[]) ?? []} />
    </div>
  )
}
