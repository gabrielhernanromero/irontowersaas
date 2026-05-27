'use client'

import { useState } from 'react'
import { Plus, Pencil, X, Loader2, Building2, Package, MapPin, Phone, Mail, Hash } from 'lucide-react'
import type { Cliente, ElementoPuesto } from '@/types/database'

type Tab = 'puestos' | 'elementos'

type ElementoConPuesto = ElementoPuesto & { clientes: { id: string; nombre_empresa: string } | null }

const ESTADO_BADGE: Record<string, string> = {
  activo:           'bg-green-100 text-green-800 border-green-200',
  en_mantenimiento: 'bg-amber-100 text-amber-800 border-amber-200',
  inactivo:         'bg-gray-100 text-gray-500 border-gray-200',
}
const ESTADO_LABEL: Record<string, string> = {
  activo:           'Activo',
  en_mantenimiento: 'En mantenimiento',
  inactivo:         'Inactivo',
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal genérico
// ─────────────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-transparent'

// ─────────────────────────────────────────────────────────────────────────────
// Modal Puesto
// ─────────────────────────────────────────────────────────────────────────────
function ModalPuesto({
  inicial,
  onClose,
  onSaved,
}: {
  inicial?: Cliente
  onClose: () => void
  onSaved: (p: Cliente) => void
}) {
  const [form, setForm] = useState({
    nombre_empresa:    inicial?.nombre_empresa   ?? '',
    cuit:              inicial?.cuit             ?? '',
    direccion:         inicial?.direccion        ?? '',
    contacto_nombre:   inicial?.contacto_nombre  ?? '',
    contacto_email:    inicial?.contacto_email   ?? '',
    contacto_telefono: inicial?.contacto_telefono ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/supervisor/puestos', {
        method:  inicial ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(inicial ? { ...form, id: inicial.id } : form),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Error al guardar'); return }
      onSaved(json.puesto)
    } catch { setError('Error de conexión') }
    finally  { setLoading(false) }
  }

  return (
    <Modal title={inicial ? 'Editar Puesto' : 'Nuevo Puesto'} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Nombre del Puesto *">
          <input className={inputCls} value={form.nombre_empresa} onChange={e => set('nombre_empresa', e.target.value)} placeholder="YPF S.A. — Refinería La Plata" required />
        </Field>
        <Field label="CUIT *">
          <input className={inputCls} value={form.cuit} onChange={e => set('cuit', e.target.value)} placeholder="30-54668997-9" required />
        </Field>
        <Field label="Dirección *">
          <input className={inputCls} value={form.direccion} onChange={e => set('direccion', e.target.value)} placeholder="Av. del Trabajo 1234, La Plata" required />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Contacto *">
            <input className={inputCls} value={form.contacto_nombre} onChange={e => set('contacto_nombre', e.target.value)} placeholder="Juan García" required />
          </Field>
          <Field label="Teléfono *">
            <input className={inputCls} value={form.contacto_telefono} onChange={e => set('contacto_telefono', e.target.value)} placeholder="011-4329-2000" required />
          </Field>
        </div>
        <Field label="Email de contacto *">
          <input className={inputCls} type="email" value={form.contacto_email} onChange={e => set('contacto_email', e.target.value)} placeholder="jgarcia@empresa.com" required />
        </Field>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 font-semibold py-2.5 rounded-lg text-sm hover:bg-gray-50">
            Cancelar
          </button>
          <button type="submit" disabled={loading} className="flex-1 bg-brand-orange text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal Elemento
// ─────────────────────────────────────────────────────────────────────────────
function ModalElemento({
  inicial,
  puestos,
  onClose,
  onSaved,
}: {
  inicial?: ElementoConPuesto
  puestos: Cliente[]
  onClose: () => void
  onSaved: (e: ElementoConPuesto) => void
}) {
  const [form, setForm] = useState({
    nombre:             inicial?.nombre             ?? '',
    codigo_patrimonial: inicial?.codigo_patrimonial ?? '',
    categoria:          inicial?.categoria          ?? '',
    descripcion:        inicial?.descripcion        ?? '',
    cliente_id:         inicial?.cliente_id         ?? '',
    estado_admin:       inicial?.estado_admin       ?? 'activo',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/supervisor/elementos', {
        method:  inicial ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(inicial ? { ...form, id: inicial.id } : form),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Error al guardar'); return }
      onSaved(json.elemento)
    } catch { setError('Error de conexión') }
    finally  { setLoading(false) }
  }

  return (
    <Modal title={inicial ? 'Editar Elemento' : 'Nuevo Elemento'} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Nombre del equipo *">
          <input className={inputCls} value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Handy Motorola EP450" required />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Código patrimonial *">
            <input className={inputCls} value={form.codigo_patrimonial} onChange={e => set('codigo_patrimonial', e.target.value)} placeholder="MOT-001" required />
          </Field>
          <Field label="Categoría">
            <input className={inputCls} value={form.categoria ?? ''} onChange={e => set('categoria', e.target.value)} placeholder="Comunicación" />
          </Field>
        </div>
        <Field label="Puesto asignado *">
          <select className={inputCls} value={form.cliente_id} onChange={e => set('cliente_id', e.target.value)} required>
            <option value="">Seleccioná un puesto...</option>
            {puestos.map(p => (
              <option key={p.id} value={p.id}>{p.nombre_empresa}</option>
            ))}
          </select>
        </Field>
        <Field label="Estado">
          <select className={inputCls} value={form.estado_admin} onChange={e => set('estado_admin', e.target.value)}>
            <option value="activo">Activo</option>
            <option value="en_mantenimiento">En mantenimiento</option>
            <option value="inactivo">Inactivo</option>
          </select>
        </Field>
        <Field label="Descripción">
          <textarea className={inputCls} value={form.descripcion ?? ''} onChange={e => set('descripcion', e.target.value)} rows={2} placeholder="Descripción opcional del equipo..." />
        </Field>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 font-semibold py-2.5 rounded-lg text-sm hover:bg-gray-50">
            Cancelar
          </button>
          <button type="submit" disabled={loading} className="flex-1 bg-brand-orange text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────
export default function EstructuraClient({
  initialPuestos,
  initialElementos,
}: {
  initialPuestos:   Cliente[]
  initialElementos: ElementoConPuesto[]
}) {
  const [tab, setTab]             = useState<Tab>('puestos')
  const [puestos, setPuestos]     = useState(initialPuestos)
  const [elementos, setElementos] = useState(initialElementos)

  // Modales
  const [modalPuesto,   setModalPuesto]   = useState<{ open: boolean; editando?: Cliente }>({ open: false })
  const [modalElemento, setModalElemento] = useState<{ open: boolean; editando?: ElementoConPuesto }>({ open: false })

  function onPuestoSaved(p: Cliente) {
    setPuestos(prev => {
      const idx = prev.findIndex(x => x.id === p.id)
      return idx >= 0 ? prev.map(x => x.id === p.id ? p : x) : [p, ...prev]
    })
    setModalPuesto({ open: false })
  }

  function onElementoSaved(e: ElementoConPuesto) {
    setElementos(prev => {
      const idx = prev.findIndex(x => x.id === e.id)
      return idx >= 0 ? prev.map(x => x.id === e.id ? e : x) : [e, ...prev]
    })
    setModalElemento({ open: false })
  }

  return (
    <>
      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-6">
        {([['puestos', 'Puestos', Building2], ['elementos', 'Elementos / Inventario', Package]] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              tab === key ? 'bg-white text-brand-ink shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab Puestos ────────────────────────────────────────────────────── */}
      {tab === 'puestos' && (
        <div>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Puestos de trabajo</h2>
              <p className="text-sm text-gray-500">{puestos.length} puestos registrados</p>
            </div>
            <button
              onClick={() => setModalPuesto({ open: true })}
              className="flex items-center gap-2 bg-brand-orange text-white font-semibold px-4 py-2.5 rounded-lg text-sm hover:bg-orange-600 transition-colors"
            >
              <Plus size={16} />
              Nuevo Puesto
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nombre del Puesto</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Dirección</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Contacto</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden xl:table-cell">CUIT</th>
                  <th className="px-5 py-3.5 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {puestos.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-gray-400 text-sm">
                      No hay puestos registrados. Creá el primero.
                    </td>
                  </tr>
                )}
                {puestos.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-brand-orange/10 flex items-center justify-center shrink-0">
                          <Building2 size={16} className="text-brand-orange" />
                        </div>
                        <span className="font-semibold text-gray-900">{p.nombre_empresa}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <MapPin size={13} className="text-gray-400 shrink-0" />
                        {p.direccion}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-600 hidden lg:table-cell">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <Phone size={12} className="text-gray-400" />
                          <span className="text-xs">{p.contacto_nombre}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Mail size={12} className="text-gray-400" />
                          <span className="text-xs text-gray-400">{p.contacto_email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-500 hidden xl:table-cell">
                      <div className="flex items-center gap-1.5">
                        <Hash size={12} className="text-gray-400" />
                        <span className="text-xs font-mono">{p.cuit}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => setModalPuesto({ open: true, editando: p })}
                        className="flex items-center gap-1.5 text-xs font-semibold text-brand-orange hover:text-orange-700 ml-auto"
                      >
                        <Pencil size={13} />
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab Elementos ──────────────────────────────────────────────────── */}
      {tab === 'elementos' && (
        <div>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Inventario de elementos</h2>
              <p className="text-sm text-gray-500">{elementos.length} elementos registrados</p>
            </div>
            <button
              onClick={() => setModalElemento({ open: true })}
              className="flex items-center gap-2 bg-brand-orange text-white font-semibold px-4 py-2.5 rounded-lg text-sm hover:bg-orange-600 transition-colors"
            >
              <Plus size={16} />
              Nuevo Elemento
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Equipo</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Categoría</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Puesto Asignado</th>
                  <th className="px-5 py-3.5 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {elementos.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-gray-400 text-sm">
                      No hay elementos registrados. Creá el primero.
                    </td>
                  </tr>
                )}
                {elementos.map(el => (
                  <tr key={el.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                          <Package size={15} className="text-gray-500" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{el.nombre}</p>
                          <p className="text-xs text-gray-400 font-mono">{el.codigo_patrimonial}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-600 hidden md:table-cell">
                      {el.categoria ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${ESTADO_BADGE[el.estado_admin]}`}>
                        {ESTADO_LABEL[el.estado_admin]}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <Building2 size={13} className="text-gray-400 shrink-0" />
                        {el.clientes?.nombre_empresa ?? <span className="text-gray-300">Sin asignar</span>}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => setModalElemento({ open: true, editando: el })}
                        className="flex items-center gap-1.5 text-xs font-semibold text-brand-orange hover:text-orange-700 ml-auto"
                      >
                        <Pencil size={13} />
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modales */}
      {modalPuesto.open && (
        <ModalPuesto
          inicial={modalPuesto.editando}
          onClose={() => setModalPuesto({ open: false })}
          onSaved={onPuestoSaved}
        />
      )}
      {modalElemento.open && (
        <ModalElemento
          inicial={modalElemento.editando}
          puestos={puestos}
          onClose={() => setModalElemento({ open: false })}
          onSaved={onElementoSaved}
        />
      )}
    </>
  )
}
