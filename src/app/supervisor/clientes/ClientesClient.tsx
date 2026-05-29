'use client'

import { useState, useEffect } from 'react'
import {
  Building2, Plus, ChevronDown, ChevronUp, Edit2,
  Users, Package, Info, Sun, Moon, Loader2, X,
  ToggleLeft, ToggleRight, AlertCircle, MapPin, QrCode, Printer,
} from 'lucide-react'
import QRCode from 'react-qr-code'
import type { Cliente, ElementoPuesto, EstadoAdmin } from '@/types/database'

// ── Types ──────────────────────────────────────────────────────────────────────

interface TecnicoRow {
  id: string
  nombre: string
  apellido: string
  dni: string | null
  turno_habitual: string | null
  activo: boolean
  cliente_id: string | null
}

type Tab = 'info' | 'elementos' | 'tecnicos' | 'rondas'

interface PuntoControl {
  id: string
  cliente_id: string
  nombre: string
  descripcion: string | null
  ubicacion: string | null
  codigo_qr: string
  orden: number
  activo: boolean
}

interface Props {
  initialClientes: Cliente[]
  initialElementos: ElementoPuesto[]
  initialTecnicos: TecnicoRow[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function estadoBadge(e: EstadoAdmin) {
  if (e === 'activo')           return { label: 'Operativo',     cls: 'bg-green-100 text-green-700' }
  if (e === 'en_mantenimiento') return { label: 'Mantenimiento', cls: 'bg-amber-100 text-amber-700' }
  return                               { label: 'Inactivo',      cls: 'bg-gray-100  text-gray-500'  }
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ClientesClient({ initialClientes, initialElementos, initialTecnicos }: Props) {
  const [clientes,  setClientes]  = useState(initialClientes)
  const [elementos, setElementos] = useState(initialElementos)
  const [tecnicos]                = useState(initialTecnicos)

  const [expanded,      setExpanded]      = useState<string | null>(null)
  const [activeTab,     setActiveTab]     = useState<Record<string, Tab>>({})
  const [showInactivos, setShowInactivos] = useState(false)
  const [toggling,      setToggling]      = useState<Record<string, boolean>>({})
  const [globalError,   setGlobalError]   = useState<string | null>(null)

  // Cliente modal
  const [clienteModal,    setClienteModal]    = useState<{ open: boolean; editing: Cliente | null }>({ open: false, editing: null })
  // Elemento modal
  const [elementoModal,   setElementoModal]   = useState<{ open: boolean; editing: ElementoPuesto | null; clienteId: string }>({ open: false, editing: null, clienteId: '' })

  // ── Derived ──────────────────────────────────────────────────────────────
  const activos   = clientes.filter(c => c.activo)
  const inactivos = clientes.filter(c => !c.activo)
  const visibles  = showInactivos ? clientes : activos

  function getTab(id: string): Tab { return activeTab[id] ?? 'info' }

  // ── Toggle cliente activo ─────────────────────────────────────────────────
  async function toggleActivo(id: string, activo: boolean) {
    setToggling(p => ({ ...p, [id]: true }))
    setGlobalError(null)
    try {
      const res = await fetch('/api/supervisor/puestos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, activo }),
      })
      if (!res.ok) { setGlobalError('Error al actualizar el cliente'); return }
      setClientes(prev => prev.map(c => c.id === id ? { ...c, activo } : c))
    } catch { setGlobalError('Error de conexión') }
    finally  { setToggling(p => ({ ...p, [id]: false })) }
  }

  // ── Callbacks ─────────────────────────────────────────────────────────────
  function onClienteSaved(c: Cliente) {
    setClientes(prev => {
      const exists = prev.find(x => x.id === c.id)
      const next   = exists
        ? prev.map(x => x.id === c.id ? c : x)
        : [...prev, c]
      return next.sort((a, b) => a.nombre_empresa.localeCompare(b.nombre_empresa))
    })
    setClienteModal({ open: false, editing: null })
  }

  function onElementoSaved(el: ElementoPuesto) {
    setElementos(prev => {
      const exists = prev.find(x => x.id === el.id)
      const next   = exists
        ? prev.map(x => x.id === el.id ? el : x)
        : [...prev, el]
      return next.sort((a, b) => a.nombre.localeCompare(b.nombre))
    })
    setElementoModal({ open: false, editing: null, clienteId: '' })
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          {inactivos.length > 0 && (
            <button
              onClick={() => setShowInactivos(p => !p)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                showInactivos
                  ? 'bg-gray-100 border-gray-300 text-gray-700'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              {showInactivos ? 'Ocultar inactivos' : `Ver inactivos (${inactivos.length})`}
            </button>
          )}
        </div>

        <button
          onClick={() => setClienteModal({ open: true, editing: null })}
          className="flex items-center gap-2 bg-brand-orange text-white font-semibold px-4 py-2.5 rounded-xl text-sm"
        >
          <Plus size={16} />
          Nuevo cliente
        </button>
      </div>

      {/* Global error */}
      {globalError && (
        <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
          <AlertCircle size={16} className="shrink-0" />
          {globalError}
          <button onClick={() => setGlobalError(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {/* Empty state */}
      {visibles.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <Building2 size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay clientes{!showInactivos && activos.length === 0 ? '' : ' activos'} registrados.</p>
        </div>
      )}

      {/* List */}
      <div className="flex flex-col gap-3">
        {visibles.map(cliente => {
          const isOpen            = expanded === cliente.id
          const tab               = getTab(cliente.id)
          const elsCliente        = elementos.filter(e => e.cliente_id === cliente.id)
          const tecsCliente       = tecnicos.filter(t => t.cliente_id === cliente.id)
          const tecsActivos       = tecsCliente.filter(t => t.activo)

          return (
            <div
              key={cliente.id}
              className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-opacity duration-200 ${!cliente.activo ? 'opacity-60' : ''}`}
            >
              {/* Card header */}
              <div className="flex items-center justify-between p-4 gap-3">
                {/* Clickable area to expand */}
                <button
                  onClick={() => setExpanded(isOpen ? null : cliente.id)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-brand-ink flex items-center justify-center shrink-0">
                    <Building2 size={18} className="text-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-brand-ink truncate">{cliente.nombre_empresa}</span>
                      {!cliente.activo && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full shrink-0">
                          Inactivo
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate">CUIT {cliente.cuit} · {cliente.direccion}</p>
                  </div>
                </button>

                {/* Right-side actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {/* Stats chips — only on medium+ */}
                  <span className="hidden md:flex items-center gap-1 text-xs text-gray-400 px-2">
                    <Users size={12} /> {tecsActivos.length}
                  </span>
                  <span className="hidden md:flex items-center gap-1 text-xs text-gray-400 px-2 mr-1">
                    <Package size={12} /> {elsCliente.length}
                  </span>

                  {/* Edit */}
                  <button
                    onClick={e => { e.stopPropagation(); setClienteModal({ open: true, editing: cliente }) }}
                    className="p-1.5 text-gray-400 hover:text-brand-ink hover:bg-gray-100 rounded-lg transition-colors"
                    title="Editar"
                  >
                    <Edit2 size={14} />
                  </button>

                  {/* Toggle activo */}
                  <button
                    onClick={e => { e.stopPropagation(); toggleActivo(cliente.id, !cliente.activo) }}
                    disabled={toggling[cliente.id]}
                    className="p-1.5 text-gray-400 hover:text-brand-ink hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                    title={cliente.activo ? 'Desactivar' : 'Activar'}
                  >
                    {toggling[cliente.id]
                      ? <Loader2 size={15} className="animate-spin" />
                      : cliente.activo
                        ? <ToggleRight size={17} className="text-green-500" />
                        : <ToggleLeft  size={17} />
                    }
                  </button>

                  {/* Expand chevron */}
                  <button
                    onClick={() => setExpanded(isOpen ? null : cliente.id)}
                    className="p-1.5 text-gray-400 hover:text-brand-ink hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>
              </div>

              {/* Expanded panel */}
              {isOpen && (
                <div className="border-t border-gray-100">
                  {/* Tabs */}
                  <div className="flex gap-0 border-b border-gray-100 px-2 overflow-x-auto">
                    {(['info', 'elementos', 'tecnicos', 'rondas'] as Tab[]).map(t => (
                      <button
                        key={t}
                        onClick={() => setActiveTab(prev => ({ ...prev, [cliente.id]: t }))}
                        className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                          tab === t
                            ? 'border-brand-orange text-brand-orange'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        {t === 'info'      && <Info    size={13} />}
                        {t === 'elementos' && <Package size={13} />}
                        {t === 'tecnicos'  && <Users   size={13} />}
                        {t === 'rondas'    && <QrCode  size={13} />}
                        {t === 'info'      ? 'Info'
                          : t === 'elementos' ? `Elementos (${elsCliente.length})`
                          : t === 'tecnicos'  ? `Técnicos (${tecsCliente.length})`
                          : 'Puntos de control'}
                      </button>
                    ))}
                  </div>

                  {/* Tab content */}
                  <div className="p-5">
                    {/* ── Info ── */}
                    {tab === 'info' && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                        <InfoField label="Dirección"  value={cliente.direccion}          />
                        <InfoField label="Contacto"   value={cliente.contacto_nombre}    />
                        <InfoField label="Email"      value={cliente.contacto_email}     />
                        <InfoField label="Teléfono"   value={cliente.contacto_telefono}  />
                        <InfoField label="CUIT"       value={cliente.cuit}               />
                      </div>
                    )}

                    {/* ── Elementos ── */}
                    {tab === 'elementos' && (
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                            Inventario del puesto
                          </p>
                          <button
                            onClick={() => setElementoModal({ open: true, editing: null, clienteId: cliente.id })}
                            className="flex items-center gap-1 text-xs text-brand-orange font-semibold hover:underline"
                          >
                            <Plus size={13} />
                            Agregar elemento
                          </button>
                        </div>

                        {elsCliente.length === 0 ? (
                          <p className="text-sm text-gray-400 italic">Sin elementos registrados.</p>
                        ) : (
                          <div className="flex flex-col divide-y divide-gray-50">
                            {elsCliente.map(el => {
                              const { label, cls } = estadoBadge(el.estado_admin)
                              return (
                                <div key={el.id} className="flex items-center justify-between py-2.5">
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-brand-ink truncate">{el.nombre}</p>
                                    <p className="text-xs text-gray-400">
                                      {el.codigo_patrimonial}
                                      {el.categoria ? ` · ${el.categoria}` : ''}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0 ml-3">
                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>
                                      {label}
                                    </span>
                                    <button
                                      onClick={() => setElementoModal({ open: true, editing: el, clienteId: el.cliente_id })}
                                      className="p-1 text-gray-400 hover:text-brand-ink hover:bg-gray-100 rounded transition-colors"
                                      title="Editar"
                                    >
                                      <Edit2 size={12} />
                                    </button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Rondas / Puntos de control ── */}
                    {tab === 'rondas' && (
                      <PuntosControlTab clienteId={cliente.id} />
                    )}

                    {/* ── Técnicos ── */}
                    {tab === 'tecnicos' && (
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
                          Técnicos asignados
                        </p>
                        {tecsCliente.length === 0 ? (
                          <p className="text-sm text-gray-400 italic">Sin técnicos asignados.</p>
                        ) : (
                          <div className="flex flex-col divide-y divide-gray-50">
                            {tecsCliente.map(t => (
                              <div key={t.id} className="flex items-center justify-between py-2.5">
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
                                        ? <><Sun  size={12} className="text-amber-500" /> Diurno</>
                                        : <><Moon size={12} className="text-indigo-500" /> Nocturno</>}
                                    </span>
                                  )}
                                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                    t.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                                  }`}>
                                    {t.activo ? 'Activo' : 'Inactivo'}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Cliente Modal ────────────────────────────────────────────────────── */}
      {clienteModal.open && (
        <ClienteModal
          cliente={clienteModal.editing}
          onSave={onClienteSaved}
          onClose={() => setClienteModal({ open: false, editing: null })}
        />
      )}

      {/* ── Elemento Modal ───────────────────────────────────────────────────── */}
      {elementoModal.open && (
        <ElementoModal
          elemento={elementoModal.editing}
          clienteId={elementoModal.clienteId}
          clientesActivos={clientes.filter(c => c.activo)}
          onSave={onElementoSaved}
          onClose={() => setElementoModal({ open: false, editing: null, clienteId: '' })}
        />
      )}
    </div>
  )
}

// ── InfoField ─────────────────────────────────────────────────────────────────

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400 font-medium mb-0.5">{label}</p>
      <p className="text-sm text-gray-800">{value || '—'}</p>
    </div>
  )
}

// ── ClienteModal ──────────────────────────────────────────────────────────────

function ClienteModal({
  cliente, onSave, onClose,
}: {
  cliente: Cliente | null
  onSave: (c: Cliente) => void
  onClose: () => void
}) {
  const [form, setForm] = useState({
    nombre_empresa:           cliente?.nombre_empresa           ?? '',
    cuit:                     cliente?.cuit                     ?? '',
    direccion:                cliente?.direccion                ?? '',
    contacto_nombre:          cliente?.contacto_nombre          ?? '',
    contacto_email:           cliente?.contacto_email           ?? '',
    contacto_telefono:        cliente?.contacto_telefono        ?? '',
    frecuencia_ronda_minutos: String(cliente?.frecuencia_ronda_minutos ?? ''),
    aviso_ronda_minutos:      String(cliente?.aviso_ronda_minutos      ?? '10'),
  })
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  function set(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const payload = {
        ...(cliente ? { id: cliente.id } : {}),
        nombre_empresa:           form.nombre_empresa,
        cuit:                     form.cuit,
        direccion:                form.direccion,
        contacto_nombre:          form.contacto_nombre,
        contacto_email:           form.contacto_email,
        contacto_telefono:        form.contacto_telefono,
        frecuencia_ronda_minutos: form.frecuencia_ronda_minutos ? parseInt(form.frecuencia_ronda_minutos) : null,
        aviso_ronda_minutos:      parseInt(form.aviso_ronda_minutos) || 10,
      }
      const res = await fetch('/api/supervisor/puestos', {
        method: cliente ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Error al guardar'); return }
      onSave(json.puesto)
    } catch { setError('Error de conexión') }
    finally  { setSubmitting(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="font-bold text-brand-ink">
            {cliente ? 'Editar cliente' : 'Nuevo cliente'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">
                Nombre de la empresa <span className="text-red-500">*</span>
              </label>
              <input
                value={form.nombre_empresa}
                onChange={set('nombre_empresa')}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
                placeholder="Empresa S.A."
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                CUIT <span className="text-red-500">*</span>
              </label>
              <input
                value={form.cuit}
                onChange={set('cuit')}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
                placeholder="30-12345678-9"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Dirección <span className="text-red-500">*</span>
              </label>
              <input
                value={form.direccion}
                onChange={set('direccion')}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
                placeholder="Av. Ejemplo 1234, CABA"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Contacto <span className="text-red-500">*</span>
              </label>
              <input
                value={form.contacto_nombre}
                onChange={set('contacto_nombre')}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
                placeholder="Carlos Méndez"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={form.contacto_email}
                onChange={set('contacto_email')}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
                placeholder="contacto@empresa.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Teléfono <span className="text-red-500">*</span>
              </label>
              <input
                value={form.contacto_telefono}
                onChange={set('contacto_telefono')}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
                placeholder="011-4000-0000"
                required
              />
            </div>
          </div>

          {/* ── Configuración de rondas ── */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Configuración de rondas
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Frecuencia</label>
                <select
                  value={form.frecuencia_ronda_minutos}
                  onChange={e => setForm(p => ({ ...p, frecuencia_ronda_minutos: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
                >
                  <option value="">Sin programar</option>
                  <option value="30">Cada 30 min</option>
                  <option value="60">Cada 1 hora</option>
                  <option value="90">Cada 1h 30min</option>
                  <option value="120">Cada 2 horas</option>
                  <option value="180">Cada 3 horas</option>
                  <option value="240">Cada 4 horas</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">Cada cuánto debe hacer una ronda</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Avisar técnico</label>
                <select
                  value={form.aviso_ronda_minutos}
                  onChange={e => setForm(p => ({ ...p, aviso_ronda_minutos: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
                  disabled={!form.frecuencia_ronda_minutos}
                >
                  <option value="5">5 min antes</option>
                  <option value="10">10 min antes</option>
                  <option value="15">15 min antes</option>
                  <option value="20">20 min antes</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">Notificación previa al técnico</p>
              </div>
            </div>
          </div>

          {error && (
            <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="bg-brand-orange text-white font-semibold px-5 py-2.5 rounded-lg text-sm disabled:opacity-60"
            >
              {submitting ? 'Guardando...' : cliente ? 'Guardar cambios' : 'Crear cliente'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── ElementoModal ─────────────────────────────────────────────────────────────

function ElementoModal({
  elemento, clienteId, clientesActivos, onSave, onClose,
}: {
  elemento: ElementoPuesto | null
  clienteId: string
  clientesActivos: Cliente[]
  onSave: (el: ElementoPuesto) => void
  onClose: () => void
}) {
  const [form, setForm] = useState({
    nombre:             elemento?.nombre             ?? '',
    codigo_patrimonial: elemento?.codigo_patrimonial ?? '',
    categoria:          elemento?.categoria          ?? '',
    descripcion:        elemento?.descripcion        ?? '',
    estado_admin:       (elemento?.estado_admin      ?? 'activo') as EstadoAdmin,
    cliente_id:         elemento?.cliente_id         ?? clienteId,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const payload = {
        ...(elemento ? { id: elemento.id } : {}),
        ...form,
        categoria:   form.categoria   || null,
        descripcion: form.descripcion || null,
      }
      const res = await fetch('/api/supervisor/elementos', {
        method: elemento ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Error al guardar'); return }
      onSave(json.elemento)
    } catch { setError('Error de conexión') }
    finally  { setSubmitting(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="font-bold text-brand-ink">
            {elemento ? 'Editar elemento' : 'Nuevo elemento'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">
                Nombre del elemento <span className="text-red-500">*</span>
              </label>
              <input
                value={form.nombre}
                onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
                placeholder="Handy Motorola XT-123"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Código patrimonial <span className="text-red-500">*</span>
              </label>
              <input
                value={form.codigo_patrimonial}
                onChange={e => setForm(p => ({ ...p, codigo_patrimonial: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
                placeholder="IT-001"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Categoría</label>
              <input
                value={form.categoria}
                onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
                placeholder="Comunicación"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Puesto / Cliente <span className="text-red-500">*</span>
              </label>
              <select
                value={form.cliente_id}
                onChange={e => setForm(p => ({ ...p, cliente_id: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
                required
              >
                {clientesActivos.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre_empresa}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Estado administrativo <span className="text-red-500">*</span>
              </label>
              <select
                value={form.estado_admin}
                onChange={e => setForm(p => ({ ...p, estado_admin: e.target.value as EstadoAdmin }))}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
                required
              >
                <option value="activo">Operativo</option>
                <option value="en_mantenimiento">En mantenimiento</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">Descripción</label>
              <textarea
                value={form.descripcion}
                onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
                rows={2}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
                placeholder="Detalles adicionales..."
              />
            </div>
          </div>

          {error && (
            <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="bg-brand-orange text-white font-semibold px-5 py-2.5 rounded-lg text-sm disabled:opacity-60"
            >
              {submitting ? 'Guardando...' : elemento ? 'Guardar cambios' : 'Crear elemento'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── PuntosControlTab ──────────────────────────────────────────────────────────

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

function PuntosControlTab({ clienteId }: { clienteId: string }) {
  const [puntos,     setPuntos]     = useState<PuntoControl[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showForm,   setShowForm]   = useState(false)
  const [editing,    setEditing]    = useState<PuntoControl | null>(null)
  const [qrVisible,  setQrVisible]  = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [form, setForm] = useState({ nombre: '', ubicacion: '', descripcion: '', orden: '0' })

  // Cargar al montar
  useEffect(() => {
    fetch(`/api/supervisor/puntos-control?cliente_id=${clienteId}`)
      .then(r => r.json())
      .then(j => { setPuntos(j.puntos ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId])

  function openNew() {
    setEditing(null)
    setForm({ nombre: '', ubicacion: '', descripcion: '', orden: String(puntos.length) })
    setShowForm(true)
  }

  function openEdit(p: PuntoControl) {
    setEditing(p)
    setForm({ nombre: p.nombre, ubicacion: p.ubicacion ?? '', descripcion: p.descripcion ?? '', orden: String(p.orden) })
    setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const payload = editing
        ? { id: editing.id, nombre: form.nombre, ubicacion: form.ubicacion || undefined, descripcion: form.descripcion || undefined, orden: parseInt(form.orden) || 0 }
        : { cliente_id: clienteId, nombre: form.nombre, ubicacion: form.ubicacion || undefined, descripcion: form.descripcion || undefined, orden: parseInt(form.orden) || 0 }
      const res  = await fetch('/api/supervisor/puntos-control', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Error'); return }
      setPuntos(prev => editing
        ? prev.map(p => p.id === json.punto.id ? json.punto : p)
        : [...prev, json.punto].sort((a, b) => a.orden - b.orden)
      )
      setShowForm(false)
    } catch { setError('Error de conexión') }
    finally  { setSubmitting(false) }
  }

  async function toggleActivo(id: string, activo: boolean) {
    const res = await fetch('/api/supervisor/puntos-control', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, activo }),
    })
    if (res.ok) setPuntos(prev => prev.map(p => p.id === id ? { ...p, activo } : p))
  }

  const qrUrl = (codigo: string) => `${APP_URL}/ronda/scan/${codigo}`

  if (loading) return (
    <div className="flex items-center justify-center py-8">
      <Loader2 size={20} className="animate-spin text-gray-300" />
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Puntos de control</p>
        <button onClick={openNew} className="flex items-center gap-1 text-xs text-brand-orange font-semibold hover:underline">
          <Plus size={13} /> Agregar punto
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="bg-gray-50 rounded-xl p-4 mb-4 space-y-3">
          <p className="text-sm font-semibold text-brand-ink">{editing ? 'Editar punto' : 'Nuevo punto de control'}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600 mb-1 block">Nombre *</label>
              <input value={form.nombre} onChange={e => setForm(p => ({...p, nombre: e.target.value}))}
                className="w-full border border-gray-300 rounded-lg p-2 text-sm" placeholder="Portón principal" required />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Ubicación</label>
              <input value={form.ubicacion} onChange={e => setForm(p => ({...p, ubicacion: e.target.value}))}
                className="w-full border border-gray-300 rounded-lg p-2 text-sm" placeholder="Sector A" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Orden</label>
              <input type="number" min="0" value={form.orden} onChange={e => setForm(p => ({...p, orden: e.target.value}))}
                className="w-full border border-gray-300 rounded-lg p-2 text-sm" />
            </div>
          </div>
          {error && <p className="text-red-600 text-xs">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={submitting}
              className="bg-brand-orange text-white text-xs font-semibold px-4 py-2 rounded-lg disabled:opacity-60">
              {submitting ? 'Guardando...' : editing ? 'Guardar' : 'Crear'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="text-xs text-gray-500 px-3 py-2 border border-gray-200 rounded-lg">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {puntos.length === 0 ? (
        <p className="text-sm text-gray-400 italic">Sin puntos de control. Agregá el primero.</p>
      ) : (
        <div className="space-y-2">
          {puntos.map(p => (
            <div key={p.id} className={`rounded-xl border p-3 transition-opacity ${!p.activo ? 'opacity-50 bg-gray-50 border-gray-100' : 'bg-white border-gray-100'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-300">#{p.orden + 1}</span>
                    <p className="text-sm font-semibold text-brand-ink">{p.nombre}</p>
                    {!p.activo && <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Inactivo</span>}
                  </div>
                  {p.ubicacion && (
                    <p className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                      <MapPin size={10} /> {p.ubicacion}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setQrVisible(qrVisible === p.id ? null : p.id)}
                    className={`p-1.5 rounded-lg transition-colors ${qrVisible === p.id ? 'text-brand-orange bg-orange-50' : 'text-gray-400 hover:text-brand-orange hover:bg-orange-50'}`}
                    title="Ver QR">
                    <QrCode size={13} />
                  </button>
                  <button onClick={() => openEdit(p)}
                    className="p-1.5 text-gray-400 hover:text-brand-ink hover:bg-gray-100 rounded-lg transition-colors">
                    <Edit2 size={12} />
                  </button>
                  <button onClick={() => toggleActivo(p.id, !p.activo)}
                    className="p-1.5 text-gray-400 hover:text-brand-ink hover:bg-gray-100 rounded-lg transition-colors">
                    {p.activo ? <ToggleRight size={15} className="text-green-500" /> : <ToggleLeft size={15} />}
                  </button>
                </div>
              </div>

              {qrVisible === p.id && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex flex-col items-center gap-2">
                  <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                    <QRCode value={qrUrl(p.codigo_qr)} size={140} />
                  </div>
                  <p className="text-xs text-gray-400 font-mono text-center">{p.nombre}</p>
                  <a
                    href={`/supervisor/puntos-control/${p.id}/print?codigo=${p.codigo_qr}&nombre=${encodeURIComponent(p.nombre)}&ubicacion=${encodeURIComponent(p.ubicacion ?? '')}`}
                    target="_blank"
                    className="flex items-center gap-1.5 text-xs text-brand-orange font-semibold hover:underline"
                  >
                    <Printer size={12} /> Imprimir etiqueta
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
