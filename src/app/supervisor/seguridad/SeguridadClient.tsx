'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'
import type { AuthEvent, TipoAuthEvento } from '@/types/database'

const EVENTO_LABEL: Record<TipoAuthEvento, string> = {
  login_ok: 'Ingreso exitoso',
  login_fail: 'Ingreso fallido',
  account_locked: 'Cuenta bloqueada',
  account_unlocked: 'Cuenta desbloqueada',
  password_reset_admin: 'Contraseña reseteada por admin/supervisor',
  password_change_self: 'Usuario cambió su contraseña',
  usuario_creado: 'Usuario creado',
  usuario_desactivado: 'Usuario desactivado',
}

const EVENTO_COLOR: Record<TipoAuthEvento, string> = {
  login_ok: 'bg-green-100 text-green-700',
  login_fail: 'bg-yellow-100 text-yellow-700',
  account_locked: 'bg-red-100 text-red-700',
  account_unlocked: 'bg-blue-100 text-blue-700',
  password_reset_admin: 'bg-purple-100 text-purple-700',
  password_change_self: 'bg-blue-100 text-blue-700',
  usuario_creado: 'bg-green-100 text-green-700',
  usuario_desactivado: 'bg-gray-100 text-gray-600',
}

export default function SeguridadClient({ eventos }: { eventos: AuthEvent[] }) {
  const [busqueda, setBusqueda] = useState('')

  const filtrados = eventos.filter(ev => {
    const q = busqueda.toLowerCase().trim()
    return !q || ev.email.toLowerCase().includes(q)
  })

  return (
    <>
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por email…"
          className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Fecha</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Evento</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Usuario</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Realizado por</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden lg:table-cell">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtrados.map(ev => (
              <tr key={ev.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                  {new Date(ev.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${EVENTO_COLOR[ev.evento]}`}>
                    {EVENTO_LABEL[ev.evento]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-brand-ink">
                    {ev.usuario ? `${ev.usuario.apellido}, ${ev.usuario.nombre}` : '—'}
                  </p>
                  <p className="text-xs text-gray-400">{ev.email}</p>
                </td>
                <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                  {ev.actor ? `${ev.actor.apellido}, ${ev.actor.nombre}` : '—'}
                </td>
                <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">{ev.ip ?? '—'}</td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-400 text-sm">
                  Sin eventos registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
