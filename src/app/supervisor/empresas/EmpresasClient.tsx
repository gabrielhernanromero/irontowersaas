'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Building2, Plus, X, Sun, Moon, ChevronDown, ChevronUp, Users } from 'lucide-react'
import type { EmpresaConTecnicos } from './page'

const Schema = z.object({
  nombre_empresa: z.string().min(1, 'Requerido'),
  cuit: z.string().min(11, 'CUIT inválido').max(13),
  direccion: z.string().min(1, 'Requerido'),
  contacto_nombre: z.string().min(1, 'Requerido'),
  contacto_email: z.string().email('Email inválido'),
  contacto_telefono: z.string().min(1, 'Requerido'),
})
type FormData = z.infer<typeof Schema>

export default function EmpresasClient({ empresas: inicial }: { empresas: EmpresaConTecnicos[] }) {
  const router = useRouter()
  const [empresas, setEmpresas] = useState(inicial)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(inicial[0]?.id ?? null)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(Schema),
  })

  async function onSubmit(data: FormData) {
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/empresas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Error al crear la empresa'); return }

      const nueva: EmpresaConTecnicos = { ...json.empresa, tecnicos: [] }
      setEmpresas(prev => [...prev, nueva].sort((a, b) => a.nombre_empresa.localeCompare(b.nombre_empresa)))
      setExpanded(json.empresa.id)
      setShowForm(false)
      reset()
      router.refresh()
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* Botón nueva empresa */}
      {!showForm && (
        <button
          onClick={() => { setShowForm(true); setError(null) }}
          className="flex items-center gap-2 bg-brand-orange text-white font-semibold px-4 py-3 rounded-xl self-start"
        >
          <Plus size={18} />
          Nueva empresa
        </button>
      )}

      {/* Formulario */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-brand-ink">Nueva empresa contratante</h2>
            <button onClick={() => { setShowForm(false); reset(); setError(null) }} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Nombre de la empresa <span className="text-red-500">*</span></label>
                <input
                  {...register('nombre_empresa')}
                  type="text"
                  placeholder="Empresa S.A."
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm"
                />
                {errors.nombre_empresa && <p className="text-red-600 text-xs mt-1">{errors.nombre_empresa.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">CUIT <span className="text-red-500">*</span></label>
                <input
                  {...register('cuit')}
                  type="text"
                  placeholder="30-12345678-9"
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm"
                />
                {errors.cuit && <p className="text-red-600 text-xs mt-1">{errors.cuit.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Dirección <span className="text-red-500">*</span></label>
                <input
                  {...register('direccion')}
                  type="text"
                  placeholder="Av. Ejemplo 1234, CABA"
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm"
                />
                {errors.direccion && <p className="text-red-600 text-xs mt-1">{errors.direccion.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Contacto <span className="text-red-500">*</span></label>
                <input
                  {...register('contacto_nombre')}
                  type="text"
                  placeholder="Carlos Méndez"
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm"
                />
                {errors.contacto_nombre && <p className="text-red-600 text-xs mt-1">{errors.contacto_nombre.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Email contacto <span className="text-red-500">*</span></label>
                <input
                  {...register('contacto_email')}
                  type="email"
                  placeholder="contacto@empresa.com"
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm"
                />
                {errors.contacto_email && <p className="text-red-600 text-xs mt-1">{errors.contacto_email.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Teléfono <span className="text-red-500">*</span></label>
                <input
                  {...register('contacto_telefono')}
                  type="text"
                  placeholder="011-4000-0000"
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm"
                />
                {errors.contacto_telefono && <p className="text-red-600 text-xs mt-1">{errors.contacto_telefono.message}</p>}
              </div>
            </div>

            {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}

            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                disabled={submitting}
                className="bg-brand-orange text-white font-semibold px-5 py-2.5 rounded-lg text-sm disabled:opacity-60"
              >
                {submitting ? 'Guardando...' : 'Crear empresa'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); reset(); setError(null) }}
                className="px-4 py-2.5 rounded-lg text-sm border border-gray-200 text-gray-600"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de empresas */}
      {empresas.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
          <Building2 size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay empresas registradas todavía.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {empresas.map((empresa) => {
            const isOpen = expanded === empresa.id
            const activos = empresa.tecnicos.filter(t => t.activo).length
            return (
              <div key={empresa.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {/* Header empresa */}
                <button
                  onClick={() => setExpanded(isOpen ? null : empresa.id)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-brand-ink flex items-center justify-center shrink-0">
                      <Building2 size={16} className="text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-brand-ink">{empresa.nombre_empresa}</p>
                      <p className="text-xs text-gray-400">CUIT {empresa.cuit} · {empresa.direccion}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <span className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Users size={13} />
                      {activos} técnico{activos !== 1 ? 's' : ''}
                    </span>
                    {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                </button>

                {/* Detalle expandible */}
                {isOpen && (
                  <div className="border-t border-gray-100">
                    {/* Datos de contacto */}
                    <div className="px-4 py-3 bg-gray-50 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-600">
                      <span><span className="font-medium">Contacto:</span> {empresa.contacto_nombre}</span>
                      <span><span className="font-medium">Email:</span> {empresa.contacto_email}</span>
                      <span><span className="font-medium">Tel:</span> {empresa.contacto_telefono}</span>
                    </div>

                    {/* Técnicos */}
                    <div className="p-4">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                        Técnicos asignados
                      </p>
                      {empresa.tecnicos.length === 0 ? (
                        <p className="text-sm text-gray-400 italic">Sin técnicos asignados</p>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {empresa.tecnicos.map((t) => (
                            <div key={t.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                              <div>
                                <p className="text-sm font-medium text-brand-ink">
                                  {t.apellido}, {t.nombre}
                                </p>
                                <p className="text-xs text-gray-400">DNI {t.dni ?? '—'}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                {t.turno_habitual && (
                                  <span className="flex items-center gap-1 text-xs text-gray-500">
                                    {t.turno_habitual === 'diurno'
                                      ? <><Sun size={12} className="text-amber-500" /> Diurno</>
                                      : <><Moon size={12} className="text-indigo-500" /> Nocturno</>}
                                  </span>
                                )}
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${t.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                  {t.activo ? 'Activo' : 'Inactivo'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
