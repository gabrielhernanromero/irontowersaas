'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { UserPlus, X, Eye, EyeOff, CheckCircle2, Sun, Moon, Copy, Check, Building2 } from 'lucide-react'
import type { Cliente, UserConEmpresa } from '@/types/database'

const Schema = z.object({
  nombre: z.string().min(1, 'Requerido'),
  apellido: z.string().min(1, 'Requerido'),
  dni: z.string().min(7, 'DNI inválido').max(9),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  turno_habitual: z.enum(['diurno', 'nocturno']),
  cliente_id: z.string().optional(),
})
type FormData = z.infer<typeof Schema>

interface Props {
  tecnicos: UserConEmpresa[]
  empresas: Pick<Cliente, 'id' | 'nombre_empresa'>[]
}

export default function UsuariosClient({ tecnicos: inicial, empresas }: Props) {
  const router = useRouter()
  const [tecnicos, setTecnicos] = useState(inicial)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPass, setShowPass] = useState(false)
  const [creado, setCreado] = useState<{ nombre: string; email: string; password: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(Schema),
    defaultValues: { turno_habitual: 'diurno', cliente_id: '' },
  })

  async function onSubmit(data: FormData) {
    setError(null)
    setSubmitting(true)
    try {
      const payload = {
        ...data,
        cliente_id: data.cliente_id || undefined,
      }
      const res = await fetch('/api/admin/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Error al crear el usuario'); return }

      const empresa = empresas.find(e => e.id === data.cliente_id) ?? null
      setCreado({ nombre: `${data.nombre} ${data.apellido}`, email: data.email, password: data.password })
      setShowForm(false)
      reset()
      router.refresh()
      setTecnicos(prev => [...prev, {
        id: json.id,
        nombre: data.nombre,
        apellido: data.apellido,
        dni: data.dni,
        email: data.email,
        rol: 'tecnico' as const,
        activo: true,
        turno_habitual: data.turno_habitual,
        cliente_id: data.cliente_id ?? null,
        created_at: new Date().toISOString(),
        clientes: empresa ? { id: empresa.id, nombre_empresa: empresa.nombre_empresa } : null,
      }].sort((a, b) => a.apellido.localeCompare(b.apellido)))
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  function copyCredentials() {
    if (!creado) return
    navigator.clipboard.writeText(`Usuario: ${creado.email}\nContraseña: ${creado.password}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      {/* Banner de éxito */}
      {creado && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-green-600 shrink-0" />
            <p className="font-semibold text-green-800">Cuenta creada para {creado.nombre}</p>
          </div>
          <div className="bg-white rounded-lg border border-green-200 p-3 font-mono text-sm">
            <p className="text-gray-600">Usuario: <span className="text-brand-ink font-semibold">{creado.email}</span></p>
            <p className="text-gray-600 mt-1">Contraseña: <span className="text-brand-ink font-semibold">{creado.password}</span></p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={copyCredentials}
              className="flex items-center gap-2 text-sm bg-green-600 text-white px-3 py-2 rounded-lg"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copiado' : 'Copiar credenciales'}
            </button>
            <button
              onClick={() => setCreado(null)}
              className="text-sm text-gray-500 px-3 py-2 rounded-lg border border-gray-200"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Botón nuevo técnico */}
      {!showForm && (
        <button
          onClick={() => { setShowForm(true); setError(null) }}
          className="flex items-center gap-2 bg-brand-orange text-white font-semibold px-4 py-3 rounded-xl self-start"
        >
          <UserPlus size={18} />
          Nuevo técnico
        </button>
      )}

      {/* Formulario */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-brand-ink">Nuevo técnico</h2>
            <button onClick={() => { setShowForm(false); reset(); setError(null) }} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre <span className="text-red-500">*</span></label>
                <input {...register('nombre')} type="text" placeholder="Juan"
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm" />
                {errors.nombre && <p className="text-red-600 text-xs mt-1">{errors.nombre.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Apellido <span className="text-red-500">*</span></label>
                <input {...register('apellido')} type="text" placeholder="García"
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm" />
                {errors.apellido && <p className="text-red-600 text-xs mt-1">{errors.apellido.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">DNI <span className="text-red-500">*</span></label>
                <input {...register('dni')} type="text" inputMode="numeric" placeholder="30123456"
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm" />
                {errors.dni && <p className="text-red-600 text-xs mt-1">{errors.dni.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Turno habitual <span className="text-red-500">*</span></label>
                <select {...register('turno_habitual')} className="w-full border border-gray-300 rounded-lg p-2.5 text-sm">
                  <option value="diurno">Diurno</option>
                  <option value="nocturno">Nocturno</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Empresa asignada <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <select {...register('cliente_id')} className="w-full border border-gray-300 rounded-lg p-2.5 text-sm">
                <option value="">Sin asignar</option>
                {empresas.map(e => (
                  <option key={e.id} value={e.id}>{e.nombre_empresa}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Email <span className="text-red-500">*</span></label>
              <input {...register('email')} type="email" placeholder="juan@irontower.com.ar"
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm" />
              {errors.email && <p className="text-red-600 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Contraseña temporal <span className="text-red-500">*</span>
                <span className="text-gray-400 font-normal ml-1">(se la pasás al técnico)</span>
              </label>
              <div className="relative">
                <input {...register('password')} type={showPass ? 'text' : 'password'} placeholder="Mínimo 6 caracteres"
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm pr-10" />
                <button type="button" onClick={() => setShowPass(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-red-600 text-xs mt-1">{errors.password.message}</p>}
            </div>

            {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}

            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={submitting}
                className="bg-brand-orange text-white font-semibold px-5 py-2.5 rounded-lg text-sm disabled:opacity-60">
                {submitting ? 'Creando...' : 'Crear técnico'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); reset(); setError(null) }}
                className="px-4 py-2.5 rounded-lg text-sm border border-gray-200 text-gray-600">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabla de técnicos */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {tecnicos.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            <p className="text-sm">No hay técnicos registrados todavía.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Técnico</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden lg:table-cell">Empresa</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">DNI</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Turno</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tecnicos.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-brand-ink">{t.apellido}, {t.nombre}</p>
                    <p className="text-xs text-gray-400">{t.email}</p>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {t.clientes ? (
                      <span className="flex items-center gap-1.5 text-xs text-gray-600">
                        <Building2 size={12} className="text-gray-400" />
                        {t.clientes.nombre_empresa}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400 italic">Sin asignar</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{t.dni ?? '—'}</td>
                  <td className="px-4 py-3">
                    {t.turno_habitual ? (
                      <span className="flex items-center gap-1.5 text-xs font-medium">
                        {t.turno_habitual === 'diurno'
                          ? <><Sun size={13} className="text-amber-500" /> Diurno</>
                          : <><Moon size={13} className="text-indigo-500" /> Nocturno</>}
                      </span>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${t.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {t.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
