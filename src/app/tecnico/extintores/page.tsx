import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getPlanoUrl } from '@/lib/utils/getPlanoUrl'
import ExtintoresForm from '@/components/forms/ExtintoresForm'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CheckCircle2, Eye } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ExtintoresPage() {
  const user = await requireRole('tecnico', 'admin')

  let turnoActivo = (await supabaseAdmin()
    .from('libro_turno')
    .select('id, turno, fecha, cliente_id, clientes(nombre_empresa)')
    .eq('tecnico_id', user.id)
    .eq('estado', 'abierto')
    .maybeSingle()).data

  // Apoyo: si no tiene turno propio, usar el del encargado SOLO si ya se unió al turno
  let turnoEncargadoSinUnir = false
  if (!turnoActivo) {
    const { data: perfil } = await supabaseAdmin()
      .from('users').select('cliente_id').eq('id', user.id).single()
    if (perfil?.cliente_id) {
      const { data: turnoEnc } = await supabaseAdmin()
        .from('libro_turno')
        .select('id, turno, fecha, cliente_id, clientes(nombre_empresa)')
        .eq('cliente_id', perfil.cliente_id)
        .eq('estado', 'abierto')
        .neq('tecnico_id', user.id)
        .maybeSingle()
      if (turnoEnc) {
        const { data: participacion } = await supabaseAdmin()
          .from('participaciones_turno')
          .select('id')
          .eq('turno_id', turnoEnc.id)
          .eq('usuario_id', user.id)
          .maybeSingle()
        if (participacion) {
          turnoActivo = turnoEnc
        } else {
          turnoEncargadoSinUnir = true
        }
      }
    }
  }

  if (turnoEncargadoSinUnir) {
    return (
      <div className="flex flex-col items-center justify-center gap-5 py-16 text-center px-4">
        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
          <CheckCircle2 className="text-amber-500" size={36} />
        </div>
        <div>
          <h1 className="text-xl font-condensed font-bold text-brand-ink">Primero uníte al turno</h1>
          <p className="text-gray-500 text-sm mt-1">
            Debés registrarte como apoyo antes de poder enviar planillas.
          </p>
        </div>
        <Link
          href="/tecnico/libro-guardia"
          className="flex items-center gap-2 bg-brand-ink text-white font-bold px-6 py-3 rounded-xl text-sm min-h-[48px]"
        >
          Ir al Libro de Guardia
        </Link>
      </div>
    )
  }

  // Si el supervisor activó el motor genérico para Extintores en este cliente,
  // el envío pasa por la ruta genérica (columnas configurables) en vez de este form
  if (turnoActivo?.cliente_id) {
    const { data: tipoGenerico } = await supabaseAdmin()
      .from('planilla_tipos')
      .select('id, usa_motor_generico')
      .eq('cliente_id', turnoActivo.cliente_id)
      .eq('slug', 'extintores')
      .maybeSingle()
    if (tipoGenerico?.usa_motor_generico) {
      redirect(`/tecnico/planilla/${tipoGenerico.id}`)
    }
  }

  // Busca por turno_id — más robusto que cliente+fecha+turno
  const planillaEnviada = turnoActivo
    ? (await supabaseAdmin()
        .from('planillas')
        .select('id, tipo')
        .eq('turno_id', turnoActivo.id)
        .eq('tipo', 'extintores')
        .eq('inmutable', true)
        .maybeSingle()
      ).data
    : null

  if (planillaEnviada) {
    return (
      <div className="flex flex-col items-center justify-center gap-5 py-16 text-center px-4">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="text-green-600" size={36} />
        </div>
        <div>
          <h1 className="text-xl font-condensed font-bold text-brand-ink">Planilla ya enviada</h1>
          <p className="text-gray-500 text-sm mt-1">
            Ya registraste la planilla de extintores para este turno.
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

  const { data: perfil } = await supabaseAdmin()
    .from('users').select('nombre, apellido, dni').eq('id', user.id).single()

  const aclaracion = perfil
    ? `${perfil.nombre} ${perfil.apellido} — DNI ${perfil.dni}`
    : undefined

  const clienteData = turnoActivo?.clientes as unknown as { nombre_empresa: string } | null

  const clienteIdActivo = turnoActivo?.cliente_id ?? null
  const [{ data: itemsConfig }, planoUrl] = clienteIdActivo
    ? await Promise.all([
        supabaseAdmin()
          .from('planilla_items_config')
          .select('numero, tipo_extintor')
          .eq('cliente_id', clienteIdActivo)
          .eq('tipo', 'extintores')
          .eq('activo', true)
          .order('orden', { ascending: true }),
        getPlanoUrl(clienteIdActivo),
      ])
    : [{ data: [] as { numero: string; tipo_extintor: string | null }[] }, null]

  return (
    <div>
      <h1 className="text-xl font-condensed font-bold text-brand-ink mb-4">
        Planilla de Extintores
      </h1>
      <ExtintoresForm
        clienteId={turnoActivo?.cliente_id ?? null}
        clienteNombre={clienteData?.nombre_empresa ?? null}
        turnoDefault={(turnoActivo?.turno as 'diurno' | 'nocturno') ?? (new Date().getHours() < 18 ? 'diurno' : 'nocturno')}
        aclaracion={aclaracion}
        items={itemsConfig ?? []}
        planoUrl={planoUrl}
      />
    </div>
  )
}
