'use client'

import { useState, useEffect } from 'react'
import {
  Building2, Plus, ChevronDown, ChevronUp, Edit2,
  Users, Package, Info, Sun, Moon, Loader2, X,
  ToggleLeft, ToggleRight, AlertCircle, MapPin, QrCode, Printer, Bell,
  Trash2, ShieldCheck, UserPlus, UserMinus, Eye, EyeOff, Clock,
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
  rol_habitual: 'encargado' | 'apoyo' | null
  activo: boolean
  cliente_id: string | null
}

type Tab = 'info' | 'elementos' | 'cobertura' | 'rondas'

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
  const [tecnicos,  setTecnicos]  = useState(initialTecnicos)

  const [expanded,      setExpanded]      = useState<string | null>(null)
  const [activeTab,     setActiveTab]     = useState<Record<string, Tab>>({})
  const [showInactivos, setShowInactivos] = useState(false)
  const [toggling,      setToggling]      = useState<Record<string, boolean>>({})
  const [globalError,   setGlobalError]   = useState<string | null>(null)

  // Cliente modal
  const [clienteModal,  setClienteModal]  = useState<{ open: boolean; editing: Cliente | null }>({ open: false, editing: null })
  // Elemento modal
  const [elementoModal, setElementoModal] = useState<{ open: boolean; editing: ElementoPuesto | null; clienteId: string }>({ open: false, editing: null, clienteId: '' })
  // Técnico modal
  const [tecnicoModal,  setTecnicoModal]  = useState<{ open: boolean; editing: TecnicoRow | null; clienteId: string }>({ open: false, editing: null, clienteId: '' })

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

  function onTecnicoSaved(t: TecnicoRow) {
    setTecnicos(prev => {
      const exists = prev.find(x => x.id === t.id)
      const next   = exists
        ? prev.map(x => x.id === t.id ? t : x)
        : [...prev, t]
      return next.sort((a, b) => a.apellido.localeCompare(b.apellido))
    })
    setTecnicoModal({ open: false, editing: null, clienteId: '' })
  }

  async function quitarTecnico(tecnicoId: string) {
    const res = await fetch(`/api/admin/usuarios/${tecnicoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cliente_id: null }),
    })
    if (res.ok) setTecnicos(prev => prev.map(t => t.id === tecnicoId ? { ...t, cliente_id: null } : t))
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
                    {(['info', 'elementos', 'cobertura', 'rondas'] as Tab[]).map(t => (
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
                        {t === 'cobertura' && <Clock   size={13} />}
                        {t === 'rondas'    && <QrCode  size={13} />}
                        {t === 'info'       ? 'Info'
                          : t === 'elementos' ? `Elementos (${elsCliente.length})`
                          : t === 'cobertura' ? 'Turnos y Personal'
                          : 'Puntos de control'}
                      </button>
                    ))}
                  </div>

                  {/* Tab content */}
                  <div className="p-5">
                    {/* ── Info ── */}
                    {tab === 'info' && (
                      <div className="space-y-5">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                          <InfoField label="Dirección"  value={cliente.direccion}          />
                          <InfoField label="Contacto"   value={cliente.contacto_nombre}    />
                          <InfoField label="Email"      value={cliente.contacto_email}     />
                          <InfoField label="Teléfono"   value={cliente.contacto_telefono}  />
                          <InfoField label="CUIT"       value={cliente.cuit}               />
                        </div>

                        {/* Configuración de rondas */}
                        <div className="border-t border-gray-100 pt-4">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                            Configuración de rondas
                          </p>
                          {cliente.frecuencia_ronda_minutos ? (
                            <div className="flex items-center gap-4 flex-wrap">
                              <div className="flex items-center gap-2 bg-brand-orange/8 border border-brand-orange/20 rounded-xl px-3 py-2">
                                <QrCode size={14} className="text-brand-orange" />
                                <span className="text-sm font-semibold text-brand-ink">
                                  {cliente.frecuencia_ronda_minutos < 60
                                    ? `Cada ${cliente.frecuencia_ronda_minutos} min`
                                    : `Cada ${cliente.frecuencia_ronda_minutos / 60}h`}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-gray-500">
                                <Bell size={13} className="text-gray-400" />
                                Aviso {cliente.aviso_ronda_minutos} min antes
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-400 italic">Sin programar</p>
                          )}
                        </div>
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
                                  <div className="flex items-center gap-1 shrink-0 ml-3">
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
                                    <button
                                      onClick={async () => {
                                        if (!confirm(`¿Eliminar "${el.nombre}"?`)) return
                                        const res = await fetch(`/api/supervisor/elementos?id=${el.id}`, { method: 'DELETE' })
                                        if (res.ok) setElementos(prev => prev.filter(x => x.id !== el.id))
                                      }}
                                      className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                      title="Eliminar"
                                    >
                                      <Trash2 size={12} />
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
                      <PuntosControlTab
                        clienteId={cliente.id}
                        frecuenciaMinutos={cliente.frecuencia_ronda_minutos ?? null}
                        avisoMinutos={cliente.aviso_ronda_minutos ?? 10}
                        onRondasSaved={(frecuencia, aviso) => {
                          setClientes(prev => prev.map(c => c.id === cliente.id
                            ? { ...c, frecuencia_ronda_minutos: frecuencia, aviso_ronda_minutos: aviso }
                            : c
                          ))
                        }}
                      />
                    )}

                    {/* ── Turnos y Personal ── */}
                    {tab === 'cobertura' && (
                      <CoberturaTab clienteId={cliente.id} allTecnicos={tecnicos} />
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

      {/* ── Técnico Modal ────────────────────────────────────────────────────── */}
      {tecnicoModal.open && (
        <TecnicoModal
          editing={tecnicoModal.editing}
          clienteId={tecnicoModal.clienteId}
          todosLosTecnicos={tecnicos}
          onSave={onTecnicoSaved}
          onClose={() => setTecnicoModal({ open: false, editing: null, clienteId: '' })}
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
        nombre_empresa:   form.nombre_empresa,
        cuit:             form.cuit,
        direccion:        form.direccion,
        contacto_nombre:  form.contacto_nombre,
        contacto_email:   form.contacto_email,
        contacto_telefono: form.contacto_telefono,
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

function PuntosControlTab({ clienteId, frecuenciaMinutos, avisoMinutos, onRondasSaved }: {
  clienteId: string
  frecuenciaMinutos: number | null
  avisoMinutos: number
  onRondasSaved: (frecuencia: number | null, aviso: number) => void
}) {
  const [puntos,     setPuntos]     = useState<PuntoControl[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showForm,   setShowForm]   = useState(false)
  const [editing,    setEditing]    = useState<PuntoControl | null>(null)
  const [qrVisible,  setQrVisible]  = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [form, setForm] = useState({ nombre: '', ubicacion: '', descripcion: '', orden: '0' })

  // Config de rondas inline
  const [editingConfig,  setEditingConfig]  = useState(false)
  const [configForm,     setConfigForm]     = useState({
    frecuencia: String(frecuenciaMinutos ?? ''),
    aviso:      String(avisoMinutos),
  })
  const [savingConfig,   setSavingConfig]   = useState(false)

  async function saveConfig() {
    setSavingConfig(true)
    try {
      const res = await fetch('/api/supervisor/puestos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id:                       clienteId,
          frecuencia_ronda_minutos: configForm.frecuencia ? parseInt(configForm.frecuencia) : null,
          aviso_ronda_minutos:      parseInt(configForm.aviso) || 10,
        }),
      })
      if (res.ok) {
        onRondasSaved(
          configForm.frecuencia ? parseInt(configForm.frecuencia) : null,
          parseInt(configForm.aviso) || 10
        )
      }
    } finally {
      setSavingConfig(false)
      setEditingConfig(false)
    }
  }

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

    // Validar orden único dentro del mismo cliente
    const ordenNum = parseInt(form.orden) || 0
    const duplicado = puntos.find(p => p.orden === ordenNum && p.id !== editing?.id)
    if (duplicado) {
      setError(`El orden ${ordenNum} ya está ocupado por "${duplicado.nombre}". Usá otro número.`)
      return
    }

    setSubmitting(true)
    try {
      const payload = editing
        ? { id: editing.id, nombre: form.nombre, ubicacion: form.ubicacion || undefined, descripcion: form.descripcion || undefined, orden: ordenNum }
        : { cliente_id: clienteId, nombre: form.nombre, ubicacion: form.ubicacion || undefined, descripcion: form.descripcion || undefined, orden: ordenNum }
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

  const frecLabel = (m: number | null) => {
    if (!m) return 'Sin programar'
    if (m < 60) return `Cada ${m} min`
    return `Cada ${m / 60}h`
  }

  return (
    <div>
      {/* ── Tarjeta de configuración de rondas ── */}
      <div className="bg-brand-orange/5 border border-brand-orange/20 rounded-xl p-4 mb-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-xs font-bold text-brand-orange uppercase tracking-wide flex items-center gap-1.5">
            <QrCode size={12} /> Configuración del Recorrido
          </p>
          {!editingConfig && (
            <button onClick={() => { setEditingConfig(true); setConfigForm({ frecuencia: String(frecuenciaMinutos ?? ''), aviso: String(avisoMinutos) }) }}
              className="text-xs text-brand-orange font-semibold hover:underline">
              Editar configuración
            </button>
          )}
        </div>

        {editingConfig ? (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Frecuencia</label>
                <select value={configForm.frecuencia} onChange={e => setConfigForm(p => ({...p, frecuencia: e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30">
                  <option value="">Sin programar</option>
                  <option value="30">Cada 30 min</option>
                  <option value="60">Cada 1 hora</option>
                  <option value="90">Cada 1h 30min</option>
                  <option value="120">Cada 2 horas</option>
                  <option value="180">Cada 3 horas</option>
                  <option value="240">Cada 4 horas</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Avisar técnico</label>
                <select value={configForm.aviso} onChange={e => setConfigForm(p => ({...p, aviso: e.target.value}))}
                  disabled={!configForm.frecuencia}
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 disabled:opacity-50">
                  <option value="5">5 min antes</option>
                  <option value="10">10 min antes</option>
                  <option value="15">15 min antes</option>
                  <option value="20">20 min antes</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={saveConfig} disabled={savingConfig}
                className="bg-brand-orange text-white text-xs font-semibold px-4 py-2 rounded-lg disabled:opacity-60">
                {savingConfig ? 'Guardando...' : 'Guardar'}
              </button>
              <button onClick={() => setEditingConfig(false)}
                className="text-xs text-gray-500 px-3 py-2 border border-gray-200 rounded-lg">
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4 flex-wrap text-sm">
            <span className="font-semibold text-brand-ink">{frecLabel(frecuenciaMinutos)}</span>
            {frecuenciaMinutos && (
              <span className="text-gray-500 flex items-center gap-1">
                <Bell size={12} /> Aviso {avisoMinutos} min antes
              </span>
            )}
          </div>
        )}
      </div>

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
                  <button
                    onClick={async () => {
                      if (!confirm(`¿Eliminar el punto "${p.nombre}"?`)) return
                      const res = await fetch(`/api/supervisor/puntos-control?id=${p.id}`, { method: 'DELETE' })
                      if (res.ok) setPuntos(prev => prev.filter(x => x.id !== p.id))
                    }}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Eliminar punto">
                    <Trash2 size={12} />
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

// ── CoberturaTab ──────────────────────────────────────────────────────────────

interface EsquemaRow {
  id: string
  nombre: string
  hora_inicio: string
  hora_fin: string
  activo: boolean
  asignaciones: {
    id: string
    rol_turno: 'encargado' | 'apoyo'
    usuario: { id: string; nombre: string; apellido: string; dni: string | null } | null
  }[]
}

function CoberturaTab({ clienteId, allTecnicos }: { clienteId: string; allTecnicos: TecnicoRow[] }) {
  const [esquemas,         setEsquemas]         = useState<EsquemaRow[]>([])
  const [loading,          setLoading]          = useState(true)
  const [error,            setError]            = useState<string | null>(null)
  const [crearForm,        setCrearForm]        = useState<{ nombre: string; hora_inicio: string; hora_fin: string } | null>(null)
  const [guardandoEsquema, setGuardandoEsquema] = useState(false)
  const [errorEsquema,     setErrorEsquema]     = useState<string | null>(null)
  const [editandoEsquema,  setEditandoEsquema]  = useState<{ id: string; nombre: string; hora_inicio: string; hora_fin: string } | null>(null)
  const [guardandoEdit,    setGuardandoEdit]    = useState(false)
  const [asignandoEn,      setAsignandoEn]      = useState<{ esquema_id: string; rol: 'encargado' | 'apoyo' } | null>(null)
  const [selectedTecnico,  setSelectedTecnico]  = useState('')
  const [guardandoAsig,    setGuardandoAsig]    = useState(false)

  useEffect(() => { cargar() }, [clienteId])   // eslint-disable-line react-hooks/exhaustive-deps

  async function cargar() {
    setLoading(true); setError(null)
    try {
      const res  = await fetch(`/api/supervisor/esquemas-cobertura?cliente_id=${clienteId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setEsquemas(data.esquemas ?? [])
    } catch (e) { setError((e as Error).message) }
    finally     { setLoading(false) }
  }

  async function crearEsquema() {
    if (!crearForm) return
    setGuardandoEsquema(true); setErrorEsquema(null)
    try {
      const res  = await fetch('/api/supervisor/esquemas-cobertura', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cliente_id: clienteId, ...crearForm }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setEsquemas(prev => [...prev, data.esquema].sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio)))
      setCrearForm(null)
    } catch (e) { setErrorEsquema((e as Error).message) }
    finally     { setGuardandoEsquema(false) }
  }

  async function guardarEdicion() {
    if (!editandoEsquema) return
    setGuardandoEdit(true)
    try {
      const { id, ...fields } = editandoEsquema
      const res  = await fetch(`/api/supervisor/esquemas-cobertura/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setEsquemas(prev => prev.map(e => e.id === id ? { ...e, ...data.esquema } : e))
      setEditandoEsquema(null)
    } catch (e) { setError((e as Error).message) }
    finally     { setGuardandoEdit(false) }
  }

  async function eliminarEsquema(id: string, nombre: string) {
    if (!confirm(`¿Eliminar "${nombre}"? Se perderán todas las asignaciones permanentes.`)) return
    const res = await fetch(`/api/supervisor/esquemas-cobertura/${id}`, { method: 'DELETE' })
    if (res.ok) setEsquemas(prev => prev.filter(e => e.id !== id))
    else        setError('Error al eliminar el esquema')
  }

  async function asignarPersistente(esquema_id: string) {
    if (!selectedTecnico || !asignandoEn) return
    setGuardandoAsig(true); setError(null)
    try {
      const res  = await fetch('/api/supervisor/asignaciones-persistentes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ esquema_id, usuario_id: selectedTecnico, rol_turno: asignandoEn.rol }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setEsquemas(prev => prev.map(e => e.id === esquema_id
        ? { ...e, asignaciones: [...e.asignaciones, data.asignacion] } : e
      ))
      setAsignandoEn(null); setSelectedTecnico('')
    } catch (e) { setError((e as Error).message) }
    finally     { setGuardandoAsig(false) }
  }

  async function quitarAsignacion(esquema_id: string, asignacion_id: string) {
    const res = await fetch(`/api/supervisor/asignaciones-persistentes?id=${asignacion_id}`, { method: 'DELETE' })
    if (res.ok) {
      setEsquemas(prev => prev.map(e => e.id === esquema_id
        ? { ...e, asignaciones: e.asignaciones.filter(a => a.id !== asignacion_id) } : e
      ))
    } else { setError('Error al quitar la asignación') }
  }

  const fmtT = (t: string) => t.slice(0, 5)

  function tecDisponibles(esquema: EsquemaRow) {
    const asignadosIds = new Set(esquema.asignaciones.map(a => a.usuario?.id).filter(Boolean))
    return allTecnicos.filter(t => t.activo && !asignadosIds.has(t.id))
  }

  if (loading) return (
    <div className="flex items-center justify-center py-10">
      <Loader2 size={20} className="animate-spin text-gray-300" />
    </div>
  )

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
          <AlertCircle size={15} /> {error}
          <button className="ml-auto" onClick={() => setError(null)}><X size={13} /></button>
        </div>
      )}

      {esquemas.map(esquema => {
        const encargado  = esquema.asignaciones.find(a => a.rol_turno === 'encargado')
        const apoyos     = esquema.asignaciones.filter(a => a.rol_turno === 'apoyo')
        const isEditing  = editandoEsquema?.id === esquema.id
        const isAsig     = asignandoEn?.esquema_id === esquema.id
        const disponibles = tecDisponibles(esquema)

        return (
          <div key={esquema.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            {/* Cabecera del esquema */}
            <div className="bg-gray-50 border-b border-gray-100 px-4 py-3">
              {isEditing ? (
                <div className="space-y-2">
                  <input
                    value={editandoEsquema.nombre}
                    onChange={e => setEditandoEsquema(p => p ? { ...p, nombre: e.target.value } : p)}
                    className="w-full text-sm font-semibold border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
                    placeholder="Nombre del turno"
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    <input type="time" value={editandoEsquema.hora_inicio}
                      onChange={e => setEditandoEsquema(p => p ? { ...p, hora_inicio: e.target.value } : p)}
                      className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30" />
                    <span className="text-gray-400">→</span>
                    <input type="time" value={editandoEsquema.hora_fin}
                      onChange={e => setEditandoEsquema(p => p ? { ...p, hora_fin: e.target.value } : p)}
                      className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30" />
                    <button onClick={guardarEdicion} disabled={guardandoEdit}
                      className="bg-brand-orange text-white text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-60 flex items-center gap-1">
                      {guardandoEdit ? <Loader2 size={12} className="animate-spin" /> : 'Guardar'}
                    </button>
                    <button onClick={() => setEditandoEsquema(null)}
                      className="text-xs text-gray-500 px-2 py-1.5 border border-gray-200 rounded-lg">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="font-semibold text-sm text-brand-ink">{esquema.nombre}</span>
                    <span className="ml-2 text-xs text-gray-400 font-mono">
                      {fmtT(esquema.hora_inicio)} → {fmtT(esquema.hora_fin)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditandoEsquema({ id: esquema.id, nombre: esquema.nombre, hora_inicio: fmtT(esquema.hora_inicio), hora_fin: fmtT(esquema.hora_fin) })}
                      className="p-1.5 text-gray-400 hover:text-brand-ink hover:bg-gray-100 rounded-lg transition-colors">
                      <Edit2 size={13} />
                    </button>
                    <button onClick={() => eliminarEsquema(esquema.id, esquema.nombre)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Slot encargado */}
            <div className="px-4 pt-3 pb-1">
              <p className="flex items-center gap-1.5 text-xs font-bold text-brand-orange uppercase tracking-wide mb-2">
                <ShieldCheck size={12} /> Encargado
              </p>
              {encargado?.usuario ? (
                <div className="flex items-center justify-between py-1">
                  <div>
                    <span className="text-sm font-medium text-brand-ink">
                      {encargado.usuario.apellido}, {encargado.usuario.nombre}
                    </span>
                    <span className="ml-2 text-xs text-gray-400">DNI {encargado.usuario.dni ?? '—'}</span>
                  </div>
                  <button onClick={() => quitarAsignacion(esquema.id, encargado.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <UserMinus size={13} />
                  </button>
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic py-1">Sin encargado asignado</p>
              )}
            </div>

            {/* Slots apoyo */}
            <div className="px-4 pt-1 pb-2 border-b border-gray-50">
              <p className="flex items-center gap-1.5 text-xs font-bold text-blue-500 uppercase tracking-wide mb-2">
                <Users size={12} /> Apoyo
              </p>
              {apoyos.length === 0 && (
                <p className="text-sm text-gray-400 italic py-1">Sin apoyo asignado</p>
              )}
              {apoyos.map(ap => ap.usuario && (
                <div key={ap.id} className="flex items-center justify-between py-1">
                  <div>
                    <span className="text-sm font-medium text-brand-ink">
                      {ap.usuario.apellido}, {ap.usuario.nombre}
                    </span>
                    <span className="ml-2 text-xs text-gray-400">DNI {ap.usuario.dni ?? '—'}</span>
                  </div>
                  <button onClick={() => quitarAsignacion(esquema.id, ap.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <UserMinus size={13} />
                  </button>
                </div>
              ))}
            </div>

            {/* Asignar técnico */}
            {isAsig ? (
              <div className="px-4 py-3 flex items-center gap-2">
                <select value={selectedTecnico} onChange={e => setSelectedTecnico(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30">
                  <option value="">Seleccioná un técnico…</option>
                  {disponibles.map(t => (
                    <option key={t.id} value={t.id}>{t.apellido}, {t.nombre}</option>
                  ))}
                </select>
                <button onClick={() => asignarPersistente(esquema.id)} disabled={!selectedTecnico || guardandoAsig}
                  className="bg-brand-orange text-white text-xs font-semibold px-3 py-2 rounded-lg disabled:opacity-60 flex items-center gap-1">
                  {guardandoAsig ? <Loader2 size={12} className="animate-spin" /> : 'Asignar'}
                </button>
                <button onClick={() => { setAsignandoEn(null); setSelectedTecnico('') }}
                  className="text-xs text-gray-500 px-2 py-2 border border-gray-200 rounded-lg">×</button>
              </div>
            ) : (
              <div className="px-4 py-2.5 flex gap-3">
                {!encargado && (
                  <button
                    onClick={() => { setAsignandoEn({ esquema_id: esquema.id, rol: 'encargado' }); setSelectedTecnico('') }}
                    className="flex items-center gap-1 text-xs text-brand-orange font-semibold hover:underline">
                    <UserPlus size={12} /> Encargado
                  </button>
                )}
                <button
                  onClick={() => { setAsignandoEn({ esquema_id: esquema.id, rol: 'apoyo' }); setSelectedTecnico('') }}
                  className="flex items-center gap-1 text-xs text-blue-600 font-semibold hover:underline">
                  <UserPlus size={12} /> Apoyo
                </button>
              </div>
            )}
          </div>
        )
      })}

      {/* Crear nuevo esquema */}
      {crearForm ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-brand-ink">Nuevo bloque horario</p>
          <input
            value={crearForm.nombre}
            onChange={e => setCrearForm(p => p ? { ...p, nombre: e.target.value } : p)}
            className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
            placeholder="Ej: Turno Mañana, Guardia 24hs…"
          />
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">Inicio</label>
              <input type="time" value={crearForm.hora_inicio}
                onChange={e => setCrearForm(p => p ? { ...p, hora_inicio: e.target.value } : p)}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30" />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">Fin</label>
              <input type="time" value={crearForm.hora_fin}
                onChange={e => setCrearForm(p => p ? { ...p, hora_fin: e.target.value } : p)}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30" />
            </div>
          </div>
          {errorEsquema && <p className="text-red-600 text-xs">{errorEsquema}</p>}
          <div className="flex gap-2">
            <button onClick={crearEsquema} disabled={guardandoEsquema || !crearForm.nombre.trim()}
              className="bg-brand-orange text-white text-xs font-semibold px-4 py-2 rounded-lg disabled:opacity-60">
              {guardandoEsquema ? 'Creando...' : 'Crear bloque'}
            </button>
            <button onClick={() => { setCrearForm(null); setErrorEsquema(null) }}
              className="text-xs text-gray-500 px-3 py-2 border border-gray-200 rounded-lg">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setCrearForm({ nombre: '', hora_inicio: '08:00', hora_fin: '20:00' })}
          className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-brand-orange/40 hover:text-brand-orange transition-colors">
          <Plus size={16} /> Agregar bloque horario
        </button>
      )}
    </div>
  )
}

// ── TecnicoModal ──────────────────────────────────────────────────────────────
// Crea un nuevo técnico asignado al puesto, o edita/reasigna uno existente.

function TecnicoModal({
  editing, clienteId, todosLosTecnicos, onSave, onClose,
}: {
  editing: TecnicoRow | null
  clienteId: string
  todosLosTecnicos: TecnicoRow[]
  onSave: (t: TecnicoRow) => void
  onClose: () => void
}) {
  // Modo: 'nuevo' | 'asignar' | 'editar'
  const [modo, setModo] = useState<'nuevo' | 'asignar' | 'editar'>(
    editing ? 'editar' : 'nuevo'
  )

  const [form, setForm] = useState({
    nombre:         editing?.nombre         ?? '',
    apellido:       editing?.apellido       ?? '',
    dni:            editing?.dni            ?? '',
    email:          '',
    password:       '',
    turno_habitual: (editing?.turno_habitual ?? 'diurno') as 'diurno' | 'nocturno',
    rol_habitual:   (editing?.rol_habitual   ?? '') as '' | 'encargado' | 'apoyo',
  })

  const [selectedId,   setSelectedId]   = useState('')
  const [showPass,     setShowPass]     = useState(false)
  const [submitting,   setSubmitting]   = useState(false)
  const [apiError,     setApiError]     = useState<string | null>(null)
  const [fieldErrors,  setFieldErrors]  = useState<Record<string, string>>({})

  const disponibles = todosLosTecnicos.filter(t => t.activo && t.cliente_id !== clienteId)

  function validate() {
    const e: Record<string, string> = {}
    if (!form.nombre.trim())   e.nombre   = 'El nombre es requerido'
    if (!form.apellido.trim()) e.apellido  = 'El apellido es requerido'
    const dniClean = form.dni.replace(/\D/g, '')
    if (dniClean.length < 7)   e.dni       = 'El DNI debe tener al menos 7 dígitos'
    if (dniClean.length > 8)   e.dni       = 'El DNI no puede tener más de 8 dígitos'
    if (!editing) {
      if (!form.email.includes('@'))  e.email    = 'El email no es válido'
      if (form.password.length < 6)  e.password = 'La contraseña debe tener al menos 6 caracteres'
    }
    setFieldErrors(e)
    return Object.keys(e).length === 0
  }

  function inp(field: string) {
    const base = 'w-full border rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 transition-colors'
    return fieldErrors[field]
      ? `${base} border-red-400 bg-red-50 focus:ring-red-300`
      : `${base} border-gray-300 focus:ring-brand-orange/30`
  }

  async function handleEditar(e: React.FormEvent) {
    e.preventDefault()
    if (!editing || !validate()) return
    setApiError(null); setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/usuarios/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre:         form.nombre,
          apellido:       form.apellido,
          dni:            form.dni,
          turno_habitual: form.turno_habitual,
          rol_habitual:   form.rol_habitual || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setApiError(json.error ?? 'Error'); return }
      onSave({ ...editing, ...json.usuario })
    } catch { setApiError('Error de conexión') }
    finally  { setSubmitting(false) }
  }

  async function handleNuevo(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setApiError(null); setSubmitting(true)
    try {
      const res = await fetch('/api/admin/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre:         form.nombre,
          apellido:       form.apellido,
          dni:            form.dni,
          email:          form.email,
          password:       form.password,
          turno_habitual: form.turno_habitual,
          cliente_id:     clienteId,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setApiError(json.error ?? 'Error'); return }

      // Luego de crear, actualizar rol_habitual si se seleccionó
      const id = json.id
      if (form.rol_habitual) {
        await fetch(`/api/admin/usuarios/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rol_habitual: form.rol_habitual }),
        })
      }
      onSave({
        id,
        nombre: form.nombre, apellido: form.apellido, dni: form.dni,
        turno_habitual: form.turno_habitual,
        rol_habitual: form.rol_habitual || null,
        activo: true, cliente_id: clienteId,
      })
    } catch { setApiError('Error de conexión') }
    finally  { setSubmitting(false) }
  }

  async function handleAsignar() {
    if (!selectedId) return
    setApiError(null); setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/usuarios/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cliente_id: clienteId }),
      })
      const json = await res.json()
      if (!res.ok) { setApiError(json.error ?? 'Error'); return }
      onSave(json.usuario)
    } catch { setApiError('Error de conexión') }
    finally  { setSubmitting(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="font-bold text-brand-ink">
            {editing ? 'Editar técnico' : 'Agregar técnico al puesto'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div className="p-5">
          {/* Selector de modo (solo al crear) */}
          {!editing && (
            <div className="flex gap-2 mb-5">
              <button onClick={() => setModo('nuevo')}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
                  modo === 'nuevo' ? 'bg-brand-orange text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                Crear nuevo
              </button>
              <button onClick={() => setModo('asignar')}
                disabled={disponibles.length === 0}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors disabled:opacity-40 ${
                  modo === 'asignar' ? 'bg-brand-orange text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                Asignar existente
              </button>
            </div>
          )}

          {apiError && (
            <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3 mb-4">{apiError}</p>
          )}

          {/* ── Modo asignar ── */}
          {modo === 'asignar' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">Seleccioná un técnico sin puesto asignado:</p>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {disponibles.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedId(t.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-left transition-colors ${
                      selectedId === t.id
                        ? 'border-brand-orange bg-brand-orange/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium text-brand-ink">{t.apellido}, {t.nombre}</p>
                      <p className="text-xs text-gray-400">DNI {t.dni ?? '—'} · {t.turno_habitual ?? '—'}</p>
                    </div>
                    {selectedId === t.id && <div className="w-2 h-2 rounded-full bg-brand-orange" />}
                  </button>
                ))}
              </div>
              <button
                onClick={handleAsignar}
                disabled={!selectedId || submitting}
                className="w-full bg-brand-orange text-white font-semibold py-2.5 rounded-lg text-sm disabled:opacity-60"
              >
                {submitting ? 'Asignando...' : 'Asignar al puesto'}
              </button>
            </div>
          )}

          {/* ── Modo nuevo o editar ── */}
          {(modo === 'nuevo' || modo === 'editar') && (
            <form onSubmit={editing ? handleEditar : handleNuevo} noValidate className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Nombre *</label>
                  <input value={form.nombre}
                    onChange={e => { setForm(p => ({...p, nombre: e.target.value})); setFieldErrors(p => ({...p, nombre: ''})) }}
                    className={inp('nombre')} placeholder="Juan" />
                  {fieldErrors.nombre && <p className="text-red-600 text-xs mt-1">{fieldErrors.nombre}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Apellido *</label>
                  <input value={form.apellido}
                    onChange={e => { setForm(p => ({...p, apellido: e.target.value})); setFieldErrors(p => ({...p, apellido: ''})) }}
                    className={inp('apellido')} placeholder="Pérez" />
                  {fieldErrors.apellido && <p className="text-red-600 text-xs mt-1">{fieldErrors.apellido}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">DNI *</label>
                  <input value={form.dni} inputMode="numeric"
                    onChange={e => { setForm(p => ({...p, dni: e.target.value})); setFieldErrors(p => ({...p, dni: ''})) }}
                    className={inp('dni')} placeholder="30000000" />
                  {fieldErrors.dni
                    ? <p className="text-red-600 text-xs mt-1">{fieldErrors.dni}</p>
                    : <p className="text-xs text-gray-400 mt-0.5">Sin puntos ni guiones</p>
                  }
                </div>
                {!editing && (
                  <div>
                    <label className="block text-xs font-medium mb-1">Email *</label>
                    <input type="email" value={form.email}
                      onChange={e => { setForm(p => ({...p, email: e.target.value})); setFieldErrors(p => ({...p, email: ''})) }}
                      className={inp('email')} placeholder="juan@empresa.com" />
                    {fieldErrors.email && <p className="text-red-600 text-xs mt-1">{fieldErrors.email}</p>}
                  </div>
                )}
                {!editing && (
                  <div className="col-span-2">
                    <label className="block text-xs font-medium mb-1">Contraseña *</label>
                    <div className="relative">
                      <input
                        type={showPass ? 'text' : 'password'}
                        value={form.password}
                        onChange={e => { setForm(p => ({...p, password: e.target.value})); setFieldErrors(p => ({...p, password: ''})) }}
                        className={inp('password') + ' pr-10'}
                        placeholder="Mínimo 6 caracteres"
                      />
                      <button type="button" onClick={() => setShowPass(p => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                        {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {fieldErrors.password && <p className="text-red-600 text-xs mt-1">{fieldErrors.password}</p>}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Turno habitual</label>
                  <div className="flex gap-2">
                    {(['diurno', 'nocturno'] as const).map(t => (
                      <button key={t} type="button"
                        onClick={() => setForm(p => ({...p, turno_habitual: t}))}
                        className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
                          form.turno_habitual === t
                            ? 'bg-brand-orange text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}>
                        {t === 'diurno' ? <><Sun size={11} /> Diurno</> : <><Moon size={11} /> Nocturno</>}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Rol habitual</label>
                  <div className="flex gap-2">
                    {[
                      { val: 'encargado', label: 'Encargado', icon: <ShieldCheck size={11} /> },
                      { val: 'apoyo',     label: 'Apoyo',     icon: <Users size={11} /> },
                    ].map(({ val, label, icon }) => (
                      <button key={val} type="button"
                        onClick={() => setForm(p => ({...p, rol_habitual: p.rol_habitual === val ? '' : val as 'encargado' | 'apoyo'}))}
                        className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
                          form.rol_habitual === val
                            ? val === 'encargado' ? 'bg-brand-orange text-white' : 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}>
                        {icon} {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button type="submit" disabled={submitting}
                className="w-full bg-brand-orange text-white font-semibold py-2.5 rounded-lg text-sm disabled:opacity-60">
                {submitting ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear técnico'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
