'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  UserPlus, X, Eye, EyeOff, CheckCircle2,
  Copy, Check, Building2, Edit2, ToggleLeft, ToggleRight, Loader2, Search,
} from 'lucide-react'
import type { Cliente, UserConEmpresa } from '@/types/database'

// ── Validation helpers ────────────────────────────────────────────────────────

function validateCrear(d: CreateForm) {
  const errs: Partial<Record<keyof CreateForm, string>> = {}
  if (!d.nombre.trim())          errs.nombre   = 'El nombre es requerido'
  if (!d.apellido.trim())        errs.apellido  = 'El apellido es requerido'
  const dniClean = d.dni.replace(/\D/g, '')
  if (dniClean.length < 7)       errs.dni       = 'El DNI debe tener al menos 7 dígitos'
  if (dniClean.length > 8)       errs.dni       = 'El DNI no puede tener más de 8 dígitos'
  if (!d.email.includes('@'))    errs.email     = 'El email no es válido'
  if (d.password.length < 6)     errs.password  = 'La contraseña debe tener al menos 6 caracteres'
  return errs
}

function validateEditar(d: EditForm) {
  const errs: Partial<Record<keyof EditForm, string>> = {}
  if (!d.nombre.trim())          errs.nombre   = 'El nombre es requerido'
  if (!d.apellido.trim())        errs.apellido  = 'El apellido es requerido'
  const dniClean = d.dni.replace(/\D/g, '')
  if (dniClean.length < 7)       errs.dni       = 'El DNI debe tener al menos 7 dígitos'
  if (dniClean.length > 8)       errs.dni       = 'El DNI no puede tener más de 8 dígitos'
  return errs
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface CreateForm {
  nombre: string; apellido: string; dni: string; email: string
  password: string; cliente_id: string
}
interface EditForm {
  nombre: string; apellido: string; dni: string; cliente_id: string
}

interface Props {
  tecnicos: UserConEmpresa[]
  empresas: Pick<Cliente, 'id' | 'nombre_empresa'>[]
}

const INPUT_BASE = 'w-full border rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 transition-colors'
const INPUT_OK   = `${INPUT_BASE} border-gray-300 focus:ring-brand-orange/30`
const INPUT_ERR  = `${INPUT_BASE} border-red-400 bg-red-50 focus:ring-red-300`

// ── Main component ────────────────────────────────────────────────────────────

export default function UsuariosClient({ tecnicos: inicial, empresas }: Props) {
  const router = useRouter()
  const [tecnicos,    setTecnicos]    = useState(inicial)
  const [showCreate,  setShowCreate]  = useState(false)
  const [editing,     setEditing]     = useState<UserConEmpresa | null>(null)
  const [submitting,  setSubmitting]  = useState(false)
  const [apiError,    setApiError]    = useState<string | null>(null)
  const [showPass,    setShowPass]    = useState(false)
  const [creado,      setCreado]      = useState<{ nombre: string; email: string; password: string } | null>(null)
  const [copied,      setCopied]      = useState(false)
  const [toggling,    setToggling]    = useState<string | null>(null)
  const [busqueda,    setBusqueda]    = useState('')
  const [filtroCliente, setFiltroCliente] = useState('')

  // Create form state
  const [createForm, setCreateForm] = useState<CreateForm>({
    nombre: '', apellido: '', dni: '', email: '', password: '', cliente_id: '',
  })
  const [createErrors, setCreateErrors] = useState<Partial<Record<keyof CreateForm, string>>>({})

  // Edit form state
  const [editForm, setEditForm] = useState<EditForm>({
    nombre: '', apellido: '', dni: '', cliente_id: '',
  })
  const [editErrors, setEditErrors] = useState<Partial<Record<keyof EditForm, string>>>({})

  // ── Create ──────────────────────────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const errs = validateCrear(createForm)
    setCreateErrors(errs)
    if (Object.keys(errs).length > 0) return

    setApiError(null); setSubmitting(true)
    try {
      const res = await fetch('/api/admin/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre:     createForm.nombre,
          apellido:   createForm.apellido,
          dni:        createForm.dni.replace(/\D/g, ''),
          email:      createForm.email,
          password:   createForm.password,
          cliente_id: createForm.cliente_id || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        if (json.field) setCreateErrors(p => ({ ...p, [json.field]: json.error }))
        else setApiError(json.error ?? 'Error al crear el técnico')
        return
      }

      const empresa = empresas.find(e => e.id === createForm.cliente_id) ?? null
      setCreado({ nombre: `${createForm.nombre} ${createForm.apellido}`, email: createForm.email, password: createForm.password })
      setShowCreate(false)
      setCreateForm({ nombre: '', apellido: '', dni: '', email: '', password: '', cliente_id: '' })
      setCreateErrors({})
      router.refresh()
      setTecnicos(prev => [...prev, {
        id: json.id, nombre: createForm.nombre, apellido: createForm.apellido,
        dni: createForm.dni, email: createForm.email, rol: 'tecnico' as const,
        activo: true, turno_habitual: null, rol_habitual: null,
        cliente_id: createForm.cliente_id || null, created_at: new Date().toISOString(),
        clientes: empresa ? { id: empresa.id, nombre_empresa: empresa.nombre_empresa } : null,
      }].sort((a, b) => a.apellido.localeCompare(b.apellido)))
    } catch { setApiError('Error de conexión. Intentá de nuevo.') }
    finally  { setSubmitting(false) }
  }

  // ── Edit ────────────────────────────────────────────────────────────────────
  function openEdit(t: UserConEmpresa) {
    setEditing(t)
    setEditForm({
      nombre: t.nombre, apellido: t.apellido, dni: t.dni ?? '',
      cliente_id: t.cliente_id ?? '',
    })
    setEditErrors({})
    setApiError(null)
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editing) return
    const errs = validateEditar(editForm)
    setEditErrors(errs)
    if (Object.keys(errs).length > 0) return

    setApiError(null); setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/usuarios/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre:     editForm.nombre,
          apellido:   editForm.apellido,
          dni:        editForm.dni.replace(/\D/g, ''),
          cliente_id: editForm.cliente_id || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        if (json.field) setEditErrors(p => ({ ...p, [json.field]: json.error }))
        else setApiError(json.error ?? 'Error al guardar')
        return
      }

      const empresa = empresas.find(e => e.id === editForm.cliente_id) ?? null
      setTecnicos(prev => prev.map(t => t.id === editing.id
        ? { ...t, ...json.usuario, clientes: empresa ? { id: empresa.id, nombre_empresa: empresa.nombre_empresa } : null }
        : t
      ).sort((a, b) => a.apellido.localeCompare(b.apellido)))
      setEditing(null)
    } catch { setApiError('Error de conexión. Intentá de nuevo.') }
    finally  { setSubmitting(false) }
  }

  // ── Toggle activo ───────────────────────────────────────────────────────────
  async function toggleActivo(t: UserConEmpresa) {
    setToggling(t.id)
    try {
      const res = await fetch(`/api/admin/usuarios/${t.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !t.activo }),
      })
      if (res.ok) setTecnicos(prev => prev.map(x => x.id === t.id ? { ...x, activo: !t.activo } : x))
    } finally { setToggling(null) }
  }

  function copyCredentials() {
    if (!creado) return
    navigator.clipboard.writeText(`Usuario: ${creado.email}\nContraseña: ${creado.password}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const filtrados = tecnicos.filter(t => {
    const q = busqueda.toLowerCase().trim()
    const coincide = !q ||
      t.nombre.toLowerCase().includes(q) ||
      t.apellido.toLowerCase().includes(q) ||
      (t.dni ?? '').includes(q) ||
      t.email.toLowerCase().includes(q)
    const porCliente = !filtroCliente || t.cliente_id === filtroCliente
    return coincide && porCliente
  })
  const activos   = filtrados.filter(t => t.activo)
  const inactivos = filtrados.filter(t => !t.activo)

  // ── Render ──────────────────────────────────────────────────────────────────
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
            <button onClick={copyCredentials}
              className="flex items-center gap-2 text-sm bg-green-600 text-white px-3 py-2 rounded-lg">
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copiado' : 'Copiar credenciales'}
            </button>
            <button onClick={() => setCreado(null)}
              className="text-sm text-gray-500 px-3 py-2 rounded-lg border border-gray-200">
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Botón nuevo técnico */}
      {!showCreate && !editing && (
        <button onClick={() => { setShowCreate(true); setApiError(null) }}
          className="flex items-center gap-2 bg-brand-orange text-white font-semibold px-4 py-3 rounded-xl self-start">
          <UserPlus size={18} />
          Nuevo técnico
        </button>
      )}

      {/* ── Formulario Crear ── */}
      {showCreate && (
        <TecnicoForm
          title="Nuevo técnico"
          submitLabel={submitting ? 'Creando…' : 'Crear técnico'}
          submitting={submitting}
          apiError={apiError}
          empresas={empresas}
          showPasswordField
          onCancel={() => { setShowCreate(false); setCreateErrors({}); setApiError(null) }}
          onSubmit={handleCreate}
          // Create form fields
          form={createForm}
          errors={createErrors}
          onChange={(k, v) => {
            setCreateForm(p => ({ ...p, [k]: v }))
            if (createErrors[k as keyof CreateForm]) setCreateErrors(p => ({ ...p, [k]: undefined }))
          }}
          showPass={showPass}
          onTogglePass={() => setShowPass(p => !p)}
        />
      )}

      {/* ── Formulario Editar ── */}
      {editing && (
        <TecnicoForm
          title={`Editar — ${editing.apellido}, ${editing.nombre}`}
          submitLabel={submitting ? 'Guardando…' : 'Guardar cambios'}
          submitting={submitting}
          apiError={apiError}
          empresas={empresas}
          showPasswordField={false}
          onCancel={() => { setEditing(null); setEditErrors({}); setApiError(null) }}
          onSubmit={handleEdit}
          form={editForm}
          errors={editErrors}
          onChange={(k, v) => {
            setEditForm(p => ({ ...p, [k]: v }))
            if (editErrors[k as keyof EditForm]) setEditErrors(p => ({ ...p, [k]: undefined }))
          }}
          showPass={false}
          onTogglePass={() => {}}
        />
      )}

      {/* ── Buscador y filtro ── */}
      {!showCreate && !editing && (
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, apellido, DNI o email…"
              className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
            />
          </div>
          <select
            value={filtroCliente}
            onChange={e => setFiltroCliente(e.target.value)}
            className="sm:w-52 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 bg-white"
          >
            <option value="">Todos los objetivos</option>
            {empresas.map(e => (
              <option key={e.id} value={e.id}>{e.nombre_empresa}</option>
            ))}
          </select>
        </div>
      )}

      {/* ── Tabla activos ── */}
      <TecnicosTable
        tecnicos={activos}
        toggling={toggling}
        onEdit={openEdit}
        onToggle={toggleActivo}
        emptyMessage={busqueda || filtroCliente ? 'Sin resultados para esa búsqueda.' : 'No hay técnicos activos todavía.'}
      />

      {/* ── Tabla inactivos ── */}
      {inactivos.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm text-gray-500 font-medium select-none list-none flex items-center gap-2 py-1">
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{inactivos.length}</span>
            Técnicos inactivos
          </summary>
          <div className="mt-3">
            <TecnicosTable
              tecnicos={inactivos}
              toggling={toggling}
              onEdit={openEdit}
              onToggle={toggleActivo}
              emptyMessage=""
            />
          </div>
        </details>
      )}
    </>
  )
}

// ── TecnicoForm ───────────────────────────────────────────────────────────────

type AnyForm = CreateForm | EditForm

function TecnicoForm({
  title, submitLabel, submitting, apiError, empresas,
  showPasswordField, onCancel, onSubmit,
  form, errors, onChange, showPass, onTogglePass,
}: {
  title: string
  submitLabel: string
  submitting: boolean
  apiError: string | null
  empresas: Pick<Cliente, 'id' | 'nombre_empresa'>[]
  showPasswordField: boolean
  onCancel: () => void
  onSubmit: (e: React.FormEvent) => void
  form: AnyForm
  errors: Partial<Record<string, string>>
  onChange: (key: string, value: string) => void
  showPass: boolean
  onTogglePass: () => void
}) {
  function inp(key: string) {
    return errors[key] ? INPUT_ERR : INPUT_OK
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-semibold text-brand-ink">{title}</h2>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
      </div>

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium mb-1">Nombre <span className="text-red-500">*</span></label>
            <input value={form.nombre} onChange={e => onChange('nombre', e.target.value)}
              className={inp('nombre')} placeholder="Juan" />
            {errors.nombre && <p className="text-red-600 text-xs mt-1">{errors.nombre}</p>}
          </div>

          {/* Apellido */}
          <div>
            <label className="block text-sm font-medium mb-1">Apellido <span className="text-red-500">*</span></label>
            <input value={form.apellido} onChange={e => onChange('apellido', e.target.value)}
              className={inp('apellido')} placeholder="García" />
            {errors.apellido && <p className="text-red-600 text-xs mt-1">{errors.apellido}</p>}
          </div>

          {/* DNI */}
          <div>
            <label className="block text-sm font-medium mb-1">DNI <span className="text-red-500">*</span></label>
            <input value={form.dni} onChange={e => onChange('dni', e.target.value)}
              inputMode="numeric" placeholder="30123456"
              className={inp('dni')} />
            {errors.dni
              ? <p className="text-red-600 text-xs mt-1">{errors.dni}</p>
              : <p className="text-xs text-gray-400 mt-1">Solo números, sin puntos ni guiones</p>
            }
          </div>

          {/* Email (solo en crear) */}
          {showPasswordField && (
            <div>
              <label className="block text-sm font-medium mb-1">Email <span className="text-red-500">*</span></label>
              <input value={(form as CreateForm).email} onChange={e => onChange('email', e.target.value)}
                type="email" placeholder="juan@irontower.com.ar"
                className={inp('email')} />
              {errors.email && <p className="text-red-600 text-xs mt-1">{errors.email}</p>}
            </div>
          )}

        </div>

        {/* Empresa */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Objetivo asignado <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <select value={form.cliente_id} onChange={e => onChange('cliente_id', e.target.value)}
            className={INPUT_OK}>
            <option value="">Sin asignar</option>
            {empresas.map(e => (
              <option key={e.id} value={e.id}>{e.nombre_empresa}</option>
            ))}
          </select>
        </div>

        {/* Contraseña (solo en crear) */}
        {showPasswordField && (
          <div>
            <label className="block text-sm font-medium mb-1">
              Contraseña temporal <span className="text-red-500">*</span>
              <span className="text-gray-400 font-normal ml-1">(se la pasás al técnico)</span>
            </label>
            <div className="relative">
              <input
                value={(form as CreateForm).password}
                onChange={e => onChange('password', e.target.value)}
                type={showPass ? 'text' : 'password'}
                placeholder="Mínimo 6 caracteres"
                className={inp('password') + ' pr-10'}
              />
              <button type="button" onClick={onTogglePass}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && <p className="text-red-600 text-xs mt-1">{errors.password}</p>}
          </div>
        )}

        {apiError && (
          <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">{apiError}</p>
        )}

        <div className="flex gap-3 pt-1">
          <button type="submit" disabled={submitting}
            className="bg-brand-orange text-white font-semibold px-5 py-2.5 rounded-lg text-sm disabled:opacity-60 flex items-center gap-2">
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {submitLabel}
          </button>
          <button type="button" onClick={onCancel}
            className="px-4 py-2.5 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}

// ── TecnicosTable ─────────────────────────────────────────────────────────────

function TecnicosTable({
  tecnicos, toggling, onEdit, onToggle, emptyMessage,
}: {
  tecnicos: UserConEmpresa[]
  toggling: string | null
  onEdit: (t: UserConEmpresa) => void
  onToggle: (t: UserConEmpresa) => void
  emptyMessage: string
}) {
  if (tecnicos.length === 0 && emptyMessage) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
        <p className="text-sm">{emptyMessage}</p>
      </div>
    )
  }
  if (tecnicos.length === 0) return null

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 font-semibold text-gray-600">Técnico</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden lg:table-cell">Objetivo</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">DNI</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-600">Estado</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {tecnicos.map(t => (
            <tr key={t.id} className={`transition-colors ${t.activo ? 'hover:bg-gray-50' : 'opacity-50 bg-gray-50'}`}>
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
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  t.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {t.activo ? 'Activo' : 'Inactivo'}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1 justify-end">
                  <button onClick={() => onEdit(t)} title="Editar"
                    className="p-1.5 text-gray-400 hover:text-brand-ink hover:bg-gray-100 rounded-lg transition-colors">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => onToggle(t)} disabled={toggling === t.id}
                    title={t.activo ? 'Desactivar' : 'Activar'}
                    className="p-1.5 text-gray-400 hover:text-brand-ink hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50">
                    {toggling === t.id
                      ? <Loader2 size={15} className="animate-spin" />
                      : t.activo
                        ? <ToggleRight size={16} className="text-green-500" />
                        : <ToggleLeft  size={16} />
                    }
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
