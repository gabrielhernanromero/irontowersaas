'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  UserPlus, X, Eye, EyeOff, CheckCircle2,
  Copy, Check, Edit2, ToggleLeft, ToggleRight, Loader2, Search,
} from 'lucide-react'
import type { User } from '@/types'

type Supervisor = Pick<User, 'id' | 'nombre' | 'apellido' | 'dni' | 'email' | 'activo' | 'created_at'>

interface CreateForm {
  nombre: string; apellido: string; dni: string; email: string; password: string
}
interface EditForm {
  nombre: string; apellido: string; dni: string
}

const INPUT_BASE = 'w-full border rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 transition-colors'
const INPUT_OK   = `${INPUT_BASE} border-gray-300 focus:ring-brand-orange/30`
const INPUT_ERR  = `${INPUT_BASE} border-red-400 bg-red-50 focus:ring-red-300`

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
  if (!d.nombre.trim())   errs.nombre  = 'El nombre es requerido'
  if (!d.apellido.trim()) errs.apellido = 'El apellido es requerido'
  const dniClean = d.dni.replace(/\D/g, '')
  if (dniClean.length < 7) errs.dni = 'El DNI debe tener al menos 7 dígitos'
  if (dniClean.length > 8) errs.dni = 'El DNI no puede tener más de 8 dígitos'
  return errs
}

export default function SupervisoresClient({ supervisores: inicial }: { supervisores: Supervisor[] }) {
  const router = useRouter()
  const [supervisores, setSupervisores] = useState(inicial)
  const [showCreate,   setShowCreate]   = useState(false)
  const [editing,      setEditing]      = useState<Supervisor | null>(null)
  const [submitting,   setSubmitting]   = useState(false)
  const [apiError,     setApiError]     = useState<string | null>(null)
  const [showPass,     setShowPass]     = useState(false)
  const [creado,       setCreado]       = useState<{ nombre: string; email: string; password: string } | null>(null)
  const [copied,       setCopied]       = useState(false)
  const [toggling,     setToggling]     = useState<string | null>(null)
  const [busqueda,     setBusqueda]     = useState('')

  const [createForm,   setCreateForm]   = useState<CreateForm>({ nombre: '', apellido: '', dni: '', email: '', password: '' })
  const [createErrors, setCreateErrors] = useState<Partial<Record<keyof CreateForm, string>>>({})
  const [editForm,     setEditForm]     = useState<EditForm>({ nombre: '', apellido: '', dni: '' })
  const [editErrors,   setEditErrors]   = useState<Partial<Record<keyof EditForm, string>>>({})

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const errs = validateCrear(createForm)
    setCreateErrors(errs)
    if (Object.keys(errs).length > 0) return

    setApiError(null); setSubmitting(true)
    try {
      const res = await fetch('/api/admin/supervisores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre:   createForm.nombre,
          apellido: createForm.apellido,
          dni:      createForm.dni.replace(/\D/g, ''),
          email:    createForm.email,
          password: createForm.password,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        if (json.field) setCreateErrors(p => ({ ...p, [json.field]: json.error }))
        else setApiError(json.error ?? 'Error al crear el supervisor')
        return
      }

      setCreado({ nombre: `${createForm.nombre} ${createForm.apellido}`, email: createForm.email, password: createForm.password })
      setShowCreate(false)
      setCreateForm({ nombre: '', apellido: '', dni: '', email: '', password: '' })
      setCreateErrors({})
      router.refresh()
      setSupervisores(prev => [...prev, {
        id: json.id, nombre: createForm.nombre, apellido: createForm.apellido,
        dni: createForm.dni, email: createForm.email,
        activo: true, created_at: new Date().toISOString(),
      }].sort((a, b) => a.apellido.localeCompare(b.apellido)))
    } catch { setApiError('Error de conexión. Intentá de nuevo.') }
    finally  { setSubmitting(false) }
  }

  function openEdit(s: Supervisor) {
    setEditing(s)
    setEditForm({ nombre: s.nombre, apellido: s.apellido, dni: s.dni ?? '' })
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
      const res = await fetch(`/api/admin/supervisores/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre:   editForm.nombre,
          apellido: editForm.apellido,
          dni:      editForm.dni.replace(/\D/g, ''),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        if (json.field) setEditErrors(p => ({ ...p, [json.field]: json.error }))
        else setApiError(json.error ?? 'Error al guardar')
        return
      }
      setSupervisores(prev => prev.map(s => s.id === editing.id
        ? { ...s, ...json.usuario }
        : s
      ).sort((a, b) => a.apellido.localeCompare(b.apellido)))
      setEditing(null)
    } catch { setApiError('Error de conexión. Intentá de nuevo.') }
    finally  { setSubmitting(false) }
  }

  async function toggleActivo(s: Supervisor) {
    setToggling(s.id)
    try {
      const res = await fetch(`/api/admin/supervisores/${s.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !s.activo }),
      })
      if (res.ok) setSupervisores(prev => prev.map(x => x.id === s.id ? { ...x, activo: !s.activo } : x))
    } finally { setToggling(null) }
  }

  function copyCredentials() {
    if (!creado) return
    navigator.clipboard.writeText(`Usuario: ${creado.email}\nContraseña: ${creado.password}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const filtrados = supervisores.filter(s => {
    const q = busqueda.toLowerCase().trim()
    return !q ||
      s.nombre.toLowerCase().includes(q) ||
      s.apellido.toLowerCase().includes(q) ||
      (s.dni ?? '').includes(q) ||
      s.email.toLowerCase().includes(q)
  })
  const activos   = filtrados.filter(s => s.activo)
  const inactivos = filtrados.filter(s => !s.activo)

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

      {!showCreate && !editing && (
        <button onClick={() => { setShowCreate(true); setApiError(null) }}
          className="flex items-center gap-2 bg-brand-orange text-white font-semibold px-4 py-3 rounded-xl self-start">
          <UserPlus size={18} />
          Nuevo supervisor
        </button>
      )}

      {/* Formulario crear */}
      {showCreate && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-brand-ink">Nuevo supervisor</h2>
            <button onClick={() => { setShowCreate(false); setCreateErrors({}); setApiError(null) }}
              className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
          </div>
          <form onSubmit={handleCreate} noValidate className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre <span className="text-red-500">*</span></label>
                <input value={createForm.nombre} onChange={e => { setCreateForm(p => ({ ...p, nombre: e.target.value })); setCreateErrors(p => ({ ...p, nombre: undefined })) }}
                  className={createErrors.nombre ? INPUT_ERR : INPUT_OK} placeholder="Juan" />
                {createErrors.nombre && <p className="text-red-600 text-xs mt-1">{createErrors.nombre}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Apellido <span className="text-red-500">*</span></label>
                <input value={createForm.apellido} onChange={e => { setCreateForm(p => ({ ...p, apellido: e.target.value })); setCreateErrors(p => ({ ...p, apellido: undefined })) }}
                  className={createErrors.apellido ? INPUT_ERR : INPUT_OK} placeholder="García" />
                {createErrors.apellido && <p className="text-red-600 text-xs mt-1">{createErrors.apellido}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">DNI <span className="text-red-500">*</span></label>
                <input value={createForm.dni} onChange={e => { setCreateForm(p => ({ ...p, dni: e.target.value })); setCreateErrors(p => ({ ...p, dni: undefined })) }}
                  inputMode="numeric" placeholder="30123456"
                  className={createErrors.dni ? INPUT_ERR : INPUT_OK} />
                {createErrors.dni
                  ? <p className="text-red-600 text-xs mt-1">{createErrors.dni}</p>
                  : <p className="text-xs text-gray-400 mt-1">Solo números, sin puntos ni guiones</p>
                }
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email <span className="text-red-500">*</span></label>
                <input value={createForm.email} onChange={e => { setCreateForm(p => ({ ...p, email: e.target.value })); setCreateErrors(p => ({ ...p, email: undefined })) }}
                  type="email" placeholder="supervisor@irontower.com.ar"
                  className={createErrors.email ? INPUT_ERR : INPUT_OK} />
                {createErrors.email && <p className="text-red-600 text-xs mt-1">{createErrors.email}</p>}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Contraseña temporal <span className="text-red-500">*</span>
                <span className="text-gray-400 font-normal ml-1">(se la pasás al supervisor)</span>
              </label>
              <div className="relative">
                <input
                  value={createForm.password}
                  onChange={e => { setCreateForm(p => ({ ...p, password: e.target.value })); setCreateErrors(p => ({ ...p, password: undefined })) }}
                  type={showPass ? 'text' : 'password'}
                  placeholder="Mínimo 6 caracteres"
                  className={(createErrors.password ? INPUT_ERR : INPUT_OK) + ' pr-10'}
                />
                <button type="button" onClick={() => setShowPass(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {createErrors.password && <p className="text-red-600 text-xs mt-1">{createErrors.password}</p>}
            </div>
            {apiError && (
              <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">{apiError}</p>
            )}
            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={submitting}
                className="bg-brand-orange text-white font-semibold px-5 py-2.5 rounded-lg text-sm disabled:opacity-60 flex items-center gap-2">
                {submitting && <Loader2 size={14} className="animate-spin" />}
                {submitting ? 'Creando…' : 'Crear supervisor'}
              </button>
              <button type="button" onClick={() => { setShowCreate(false); setCreateErrors({}); setApiError(null) }}
                className="px-4 py-2.5 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Formulario editar */}
      {editing && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-brand-ink">Editar — {editing.apellido}, {editing.nombre}</h2>
            <button onClick={() => { setEditing(null); setEditErrors({}); setApiError(null) }}
              className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
          </div>
          <form onSubmit={handleEdit} noValidate className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre <span className="text-red-500">*</span></label>
                <input value={editForm.nombre} onChange={e => { setEditForm(p => ({ ...p, nombre: e.target.value })); setEditErrors(p => ({ ...p, nombre: undefined })) }}
                  className={editErrors.nombre ? INPUT_ERR : INPUT_OK} />
                {editErrors.nombre && <p className="text-red-600 text-xs mt-1">{editErrors.nombre}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Apellido <span className="text-red-500">*</span></label>
                <input value={editForm.apellido} onChange={e => { setEditForm(p => ({ ...p, apellido: e.target.value })); setEditErrors(p => ({ ...p, apellido: undefined })) }}
                  className={editErrors.apellido ? INPUT_ERR : INPUT_OK} />
                {editErrors.apellido && <p className="text-red-600 text-xs mt-1">{editErrors.apellido}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">DNI <span className="text-red-500">*</span></label>
                <input value={editForm.dni} onChange={e => { setEditForm(p => ({ ...p, dni: e.target.value })); setEditErrors(p => ({ ...p, dni: undefined })) }}
                  inputMode="numeric" className={editErrors.dni ? INPUT_ERR : INPUT_OK} />
                {editErrors.dni && <p className="text-red-600 text-xs mt-1">{editErrors.dni}</p>}
              </div>
            </div>
            {apiError && (
              <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">{apiError}</p>
            )}
            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={submitting}
                className="bg-brand-orange text-white font-semibold px-5 py-2.5 rounded-lg text-sm disabled:opacity-60 flex items-center gap-2">
                {submitting && <Loader2 size={14} className="animate-spin" />}
                {submitting ? 'Guardando…' : 'Guardar cambios'}
              </button>
              <button type="button" onClick={() => { setEditing(null); setEditErrors({}); setApiError(null) }}
                className="px-4 py-2.5 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Buscador */}
      {!showCreate && !editing && (
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, apellido, DNI o email…"
            className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
          />
        </div>
      )}

      {/* Tabla activos */}
      {!showCreate && !editing && (
        <SupervisoresTable
          supervisores={activos}
          toggling={toggling}
          onEdit={openEdit}
          onToggle={toggleActivo}
          emptyMessage={busqueda ? 'Sin resultados para esa búsqueda.' : 'No hay supervisores activos todavía.'}
        />
      )}

      {/* Tabla inactivos */}
      {!showCreate && !editing && inactivos.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm text-gray-500 font-medium select-none list-none flex items-center gap-2 py-1">
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{inactivos.length}</span>
            Supervisores inactivos
          </summary>
          <div className="mt-3">
            <SupervisoresTable supervisores={inactivos} toggling={toggling} onEdit={openEdit} onToggle={toggleActivo} emptyMessage="" />
          </div>
        </details>
      )}
    </>
  )
}

function SupervisoresTable({
  supervisores, toggling, onEdit, onToggle, emptyMessage,
}: {
  supervisores: Supervisor[]
  toggling: string | null
  onEdit: (s: Supervisor) => void
  onToggle: (s: Supervisor) => void
  emptyMessage: string
}) {
  if (supervisores.length === 0 && emptyMessage) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
        <p className="text-sm">{emptyMessage}</p>
      </div>
    )
  }
  if (supervisores.length === 0) return null

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 font-semibold text-gray-600">Supervisor</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">DNI</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-600">Estado</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {supervisores.map(s => (
            <tr key={s.id} className={`transition-colors ${s.activo ? 'hover:bg-gray-50' : 'opacity-50 bg-gray-50'}`}>
              <td className="px-4 py-3">
                <p className="font-medium text-brand-ink">{s.apellido}, {s.nombre}</p>
                <p className="text-xs text-gray-400">{s.email}</p>
              </td>
              <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{s.dni ?? '—'}</td>
              <td className="px-4 py-3">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  s.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {s.activo ? 'Activo' : 'Inactivo'}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1 justify-end">
                  <button onClick={() => onEdit(s)} title="Editar"
                    className="p-1.5 text-gray-400 hover:text-brand-ink hover:bg-gray-100 rounded-lg transition-colors">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => onToggle(s)} disabled={toggling === s.id}
                    title={s.activo ? 'Desactivar' : 'Activar'}
                    className="p-1.5 text-gray-400 hover:text-brand-ink hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50">
                    {toggling === s.id
                      ? <Loader2 size={15} className="animate-spin" />
                      : s.activo
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
