import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getPlanoUrl } from '@/lib/utils/getPlanoUrl'
import PlanillaGenericaForm from '@/components/forms/PlanillaGenericaForm'
import Link from 'next/link'
import { CheckCircle2, Eye } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function PlanillaGenericaPage({ params }: { params: { tipoId: string } }) {
  const user = await requireRole('tecnico', 'admin')
  const admin = supabaseAdmin()

  const { data: tipo } = await admin
    .from('planilla_tipos')
    .select('id, nombre, slug, cliente_id, activo')
    .eq('id', params.tipoId)
    .maybeSingle()

  if (!tipo || !tipo.activo) {
    return <PlanillaNoDisponible />
  }

  let turnoActivo = (await admin
    .from('libro_turno')
    .select('id, turno, fecha, cliente_id, clientes(nombre_empresa)')
    .eq('tecnico_id', user.id)
    .eq('estado', 'abierto')
    .maybeSingle()).data

  let turnoEncargadoSinUnir = false
  if (!turnoActivo) {
    const { data: perfil } = await admin
      .from('users').select('cliente_id').eq('id', user.id).single()
    if (perfil?.cliente_id) {
      const { data: turnoEnc } = await admin
        .from('libro_turno')
        .select('id, turno, fecha, cliente_id, clientes(nombre_empresa)')
        .eq('cliente_id', perfil.cliente_id)
        .eq('estado', 'abierto')
        .neq('tecnico_id', user.id)
        .maybeSingle()
      if (turnoEnc) {
        const { data: participacion } = await admin
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

  const planillaEnviada = turnoActivo
    ? (await admin
        .from('planillas')
        .select('id, tipo')
        .eq('turno_id', turnoActivo.id)
        .eq('tipo', tipo.slug)
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
            Ya registraste la planilla de {tipo.nombre} para este turno.
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

  const { data: perfil } = await admin
    .from('users').select('nombre, apellido, dni').eq('id', user.id).single()

  const aclaracion = perfil
    ? `${perfil.nombre} ${perfil.apellido} — DNI ${perfil.dni}`
    : undefined

  const clienteData = turnoActivo?.clientes as unknown as { nombre_empresa: string } | null
  const clienteIdActivo = turnoActivo?.cliente_id ?? null

  // El tipo pertenece a un cliente puntual — si el turno abierto es de otro
  // cliente, no debe poder completarse (aunque no aparezca en su home, no
  // hay que confiar solo en eso: la URL es adivinable por id).
  if (clienteIdActivo && tipo.cliente_id !== clienteIdActivo) {
    return <PlanillaNoDisponible />
  }

  const [{ data: campos }, { data: itemsConfig }, planoUrl] = clienteIdActivo
    ? await Promise.all([
        admin
          .from('planilla_tipo_campos')
          .select('clave, etiqueta, tipo_campo, opciones, valor_min, valor_max')
          .eq('planilla_tipo_id', tipo.id)
          .order('orden', { ascending: true }),
        admin
          .from('planilla_items_config')
          .select('numero')
          .eq('cliente_id', clienteIdActivo)
          .eq('tipo', tipo.slug)
          .eq('activo', true)
          .order('orden', { ascending: true }),
        getPlanoUrl(clienteIdActivo),
      ])
    : [{ data: [] as { clave: string; etiqueta: string; tipo_campo: 'check' | 'select' | 'texto' | 'numero' | 'fecha' | 'ubicacion'; opciones: string[]; valor_min: number | null; valor_max: number | null }[] }, { data: [] as { numero: string }[] }, null]

  return (
    <div>
      <h1 className="text-xl font-condensed font-bold text-brand-ink mb-4">
        Planilla de {tipo.nombre}
      </h1>
      <PlanillaGenericaForm
        tipoId={tipo.id}
        tipoNombre={tipo.nombre}
        campos={campos ?? []}
        clienteId={clienteIdActivo}
        clienteNombre={clienteData?.nombre_empresa ?? null}
        turnoDefault={(turnoActivo?.turno as 'diurno' | 'nocturno') ?? (new Date().getHours() < 18 ? 'diurno' : 'nocturno')}
        aclaracion={aclaracion}
        items={itemsConfig ?? []}
        planoUrl={planoUrl}
      />
    </div>
  )
}

function PlanillaNoDisponible() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center px-4">
      <h1 className="text-xl font-condensed font-bold text-brand-ink">Planilla no disponible</h1>
      <p className="text-gray-500 text-sm">Este tipo de planilla ya no está habilitado.</p>
      <Link href="/tecnico/home" className="text-sm text-brand-blue underline min-h-[44px] flex items-center">
        Volver al inicio
      </Link>
    </div>
  )
}
