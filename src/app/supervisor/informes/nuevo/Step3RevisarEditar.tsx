'use client'
import { useState, useEffect, useRef } from 'react'
import {
  Sparkles, PenLine, RefreshCw, ChevronRight, Loader2,
  Maximize2, X, Check, Eye, ChevronDown, ChevronUp, Type,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TextoBloque {
  texto_ia:    string
  texto_crudo: string
  usar_ia:     boolean
}

export interface Bloque {
  id:       string
  heading:  string
  contenido: TextoBloque
  expanded: boolean
}

interface TurnoItem {
  id:      string
  label:   string
  sub:     string
  incluir: boolean
}

interface IncItem {
  id:       string
  label:    string
  sub:      string
  severidad: string | null
  incluir:  boolean
  fotos:    { url: string; incluir: boolean }[]
}

interface PlanItem {
  id:    string
  label: string
  sub:   string
  tipo:  'hidrantes' | 'extintores'
  incluir: boolean
}

export interface Tipografia {
  familia: 'Helvetica' | 'Times-Roman' | 'Courier'
  tamano:  'sm' | 'md' | 'lg'
}

interface Section { heading: string; body: string }

export interface Props {
  informeId:     string
  tipo:          string
  sections:      Section[]
  turnosSel:     Array<{ id:string; tecnico_nombre:string; fecha:string; turno:string; horario_inicio:string; horario_fin:string|null }>
  incsSel:       Array<{ id:string; titulo:string; estado:string; severidad:string|null; created_at:string; foto_url:string|null }>
  plansSel:      Array<{ id:string; tipo:'hidrantes'|'extintores'; fecha:string; turno:string }>
  inclFotos:     boolean
  tipografia:    Tipografia
  onTipografia:  (t: Tipografia) => void
  initialPdfUrl: string | null
  onConfirm:     (pdfUrl: string | null) => void
  onBack:        () => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })

const TURNO_LBL: Record<string, string> = { diurno: 'Diurno', nocturno: 'Nocturno' }

const SEV_CFG: Record<string, { label: string; cls: string }> = {
  alto:  { label: 'Alta',  cls: 'bg-red-100 text-red-700' },
  medio: { label: 'Media', cls: 'bg-amber-100 text-amber-700' },
  bajo:  { label: 'Baja',  cls: 'bg-emerald-100 text-emerald-700' },
}

const FUENTES: { id: Tipografia['familia']; label: string }[] = [
  { id: 'Helvetica',   label: 'Helvetica' },
  { id: 'Times-Roman', label: 'Times Roman' },
  { id: 'Courier',     label: 'Courier' },
]

const TAMANOS: { id: Tipografia['tamano']; label: string }[] = [
  { id: 'sm', label: 'Peq.' },
  { id: 'md', label: 'Normal' },
  { id: 'lg', label: 'Grande' },
]

// ─── ToggleIA ─────────────────────────────────────────────────────────────────

function ToggleIA({ usar_ia, onChange }: { usar_ia: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center rounded-lg border border-gray-200 bg-white overflow-hidden text-[11px] font-semibold shrink-0">
      <button
        onClick={() => onChange(true)}
        className={`flex items-center gap-1 px-2.5 py-1.5 transition-colors ${
          usar_ia ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-50'
        }`}
      >
        <Sparkles size={10} /> IA
      </button>
      <button
        onClick={() => onChange(false)}
        className={`flex items-center gap-1 px-2.5 py-1.5 transition-colors ${
          !usar_ia ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-50'
        }`}
      >
        <PenLine size={10} /> Manual
      </button>
    </div>
  )
}

// ─── BloqueCard ───────────────────────────────────────────────────────────────

function BloqueCard({ bloque, onChange }: { bloque: Bloque; onChange: (b: Bloque) => void }) {
  const { contenido, expanded } = bloque
  const taRef = useRef<HTMLTextAreaElement>(null)

  const text     = contenido.usar_ia ? contenido.texto_ia : contenido.texto_crudo
  const isEmpty  = text.trim() === ''
  const rows     = Math.min(18, Math.max(3, (text.match(/\n/g) ?? []).length + 2))

  function setUsarIA(v: boolean) {
    let next = { ...contenido, usar_ia: v }
    // Al cambiar a Manual por primera vez, pre-cargar el texto IA como punto de partida
    if (!v && contenido.texto_crudo === '' && contenido.texto_ia !== '') {
      next = { ...next, texto_crudo: contenido.texto_ia }
    }
    onChange({ ...bloque, contenido: next })
  }

  function handleChange(val: string) {
    const field = contenido.usar_ia ? 'texto_ia' : 'texto_crudo'
    onChange({ ...bloque, contenido: { ...contenido, [field]: val } })
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 bg-gray-50 border-b border-gray-200 px-3 py-2">
        <button
          onClick={() => onChange({ ...bloque, expanded: !expanded })}
          className="text-gray-400 hover:text-gray-600 shrink-0"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <span className="text-xs font-bold text-gray-700 flex-1 truncate">{bloque.heading}</span>
        {!contenido.usar_ia && (
          <span className="text-[10px] text-gray-400 italic shrink-0">editado</span>
        )}
        <ToggleIA usar_ia={contenido.usar_ia} onChange={setUsarIA} />
      </div>

      {/* Body */}
      {expanded && (
        <div className="relative bg-white">
          {isEmpty && (
            <p className="absolute top-2.5 left-3 text-xs text-gray-300 pointer-events-none select-none">
              {contenido.usar_ia
                ? 'Sin contenido generado para esta sección.'
                : 'Escribí el contenido manual para esta sección...'}
            </p>
          )}
          <textarea
            ref={taRef}
            value={text}
            onChange={e => handleChange(e.target.value)}
            className="w-full px-3 py-2.5 text-xs text-gray-700 resize-none focus:outline-none focus:bg-blue-50/20 font-mono leading-relaxed"
            rows={rows}
          />
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

function buildBloques(sections: Section[]): Bloque[] {
  return sections.map((s, i) => ({
    id:       `bloque_${i}`,
    heading:  s.heading,
    contenido: { texto_ia: s.body, texto_crudo: '', usar_ia: true },
    expanded:  true,
  }))
}

export default function Step3RevisarEditar({
  informeId, tipo, sections,
  turnosSel, incsSel, plansSel,
  inclFotos, tipografia, onTipografia,
  initialPdfUrl, onConfirm, onBack,
}: Props) {

  // ── Blocks ───────────────────────────────────────────────────────────────────
  const [bloques, setBloques]   = useState<Bloque[]>(() => buildBloques(sections))
  const [modified, setModified] = useState(false)

  // ── Items ────────────────────────────────────────────────────────────────────
  const [turnos, setTurnos] = useState<TurnoItem[]>(() =>
    turnosSel.map(t => ({
      id:      t.id,
      label:   t.tecnico_nombre,
      sub:     `${t.fecha} · ${TURNO_LBL[t.turno] ?? t.turno} · ${t.horario_inicio}${t.horario_fin ? ` — ${t.horario_fin}` : ''}`,
      incluir: true,
    }))
  )

  const [incs, setIncs] = useState<IncItem[]>(() =>
    incsSel.map(i => ({
      id:        i.id,
      label:     i.titulo,
      sub:       `${fmt(i.created_at)} · ${i.estado === 'abierto' ? 'Abierta' : 'Resuelta'}`,
      severidad: i.severidad,
      incluir:   true,
      fotos:     i.foto_url && inclFotos ? [{ url: i.foto_url, incluir: true }] : [],
    }))
  )

  const [plans, setPlans] = useState<PlanItem[]>(() =>
    plansSel.map(p => ({
      id:      p.id,
      label:   p.tipo === 'hidrantes' ? 'Hidrantes' : 'Matafuegos',
      sub:     `${p.fecha} · ${TURNO_LBL[p.turno] ?? p.turno}`,
      tipo:    p.tipo,
      incluir: true,
    }))
  )

  // ── PDF ───────────────────────────────────────────────────────────────────────
  const [pdfUrl, setPdfUrl]       = useState<string | null>(initialPdfUrl)
  const [genPdf, setGenPdf]       = useState(false)
  const [fullscreen, setFullscreen] = useState(false)

  // ── Other UI ──────────────────────────────────────────────────────────────────
  const [regenIA, setRegenIA]  = useState(false)
  const [saving, setSaving]    = useState(false)
  const [error, setError]      = useState<string | null>(null)

  // Si no hay PDF inicial, generarlo al montar
  useEffect(() => {
    if (!initialPdfUrl) actualizarPdf()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Helpers ───────────────────────────────────────────────────────────────────

  function assembleMarkdown(bl: Bloque[]): string {
    return bl
      .map(b => {
        const text = b.contenido.usar_ia ? b.contenido.texto_ia : b.contenido.texto_crudo
        return `## ${b.heading}\n\n${text}`
      })
      .join('\n\n')
  }

  function collectFotos(): string[] {
    return incs.flatMap(i => (i.incluir ? i.fotos.filter(f => f.incluir).map(f => f.url) : []))
  }

  function updateBloque(updated: Bloque) {
    setBloques(prev => prev.map(b => b.id === updated.id ? updated : b))
    setModified(true)
  }

  // ── PDF generation ────────────────────────────────────────────────────────────

  async function actualizarPdf(overrideBloques?: Bloque[]) {
    setGenPdf(true); setError(null)
    const bl = overrideBloques ?? bloques
    const md = assembleMarkdown(bl)
    try {
      await fetch(`/api/supervisor/informes/${informeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contenido: md }),
      })
      const res = await fetch(`/api/supervisor/informes/${informeId}/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipografia, fotoUrls: collectFotos() }),
      })
      if (res.ok && res.headers.get('content-type')?.includes('pdf')) {
        const blob = await res.blob()
        if (pdfUrl?.startsWith('blob:')) URL.revokeObjectURL(pdfUrl)
        setPdfUrl(URL.createObjectURL(blob))
        setModified(false)
      } else {
        setError('No se pudo generar el PDF.')
      }
    } catch { setError('Error al generar el PDF.') }
    finally { setGenPdf(false) }
  }

  // ── Regenerar con IA ──────────────────────────────────────────────────────────

  async function regenerarIA() {
    setRegenIA(true); setError(null)
    try {
      const res = await fetch(`/api/supervisor/informes/${informeId}/generar`, { method: 'POST' })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error al regenerar')
      const { informe } = await res.json()
      const parsed = parseSections(informe.contenido_ai ?? '')
      const nuevos = buildBloques(parsed)
      setBloques(nuevos)
      setModified(false)
      actualizarPdf(nuevos)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al regenerar')
    } finally { setRegenIA(false) }
  }

  function parseSections(md: string): Section[] {
    const lines = md.split('\n')
    const out: Section[] = []
    let cur: Section | null = null
    for (const line of lines) {
      if (line.startsWith('## ')) {
        if (cur) out.push({ ...cur, body: cur.body.trimEnd() })
        cur = { heading: line.slice(3).trim(), body: '' }
      } else if (cur) {
        cur.body += (cur.body ? '\n' : '') + line
      }
    }
    if (cur) out.push({ ...cur, body: cur.body.trimEnd() })
    return out
  }

  // ── Confirm ───────────────────────────────────────────────────────────────────

  async function handleConfirmar() {
    setSaving(true)
    const md = assembleMarkdown(bloques)
    try {
      await fetch(`/api/supervisor/informes/${informeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contenido: md }),
      })
    } catch {}
    setSaving(false)
    onConfirm(pdfUrl)
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const hasItems = turnos.length > 0 || incs.length > 0 || plans.length > 0

  return (
    <>
      {/* Fullscreen overlay */}
      {fullscreen && pdfUrl && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-white text-sm font-medium">Vista previa del informe</span>
            <button onClick={() => setFullscreen(false)} className="text-white hover:text-gray-300">
              <X size={22} />
            </button>
          </div>
          <iframe src={pdfUrl} className="flex-1 w-full" title="Preview fullscreen" />
        </div>
      )}

      <div className="space-y-4">

        {/* ── Elementos incluidos ── */}
        {hasItems && (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 space-y-4">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Elementos incluidos</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

              {/* Turnos */}
              {turnos.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-600">Turnos</p>
                  {turnos.map(t => (
                    <label key={t.id} className="flex items-start gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={t.incluir}
                        onChange={() => setTurnos(prev => prev.map(x => x.id === t.id ? { ...x, incluir: !x.incluir } : x))}
                        className="mt-0.5 accent-brand-orange shrink-0"
                      />
                      <div>
                        <p className={`text-xs font-medium ${t.incluir ? 'text-gray-800' : 'text-gray-400 line-through'}`}>{t.label}</p>
                        <p className="text-[10px] text-gray-400 leading-snug">{t.sub}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {/* Incidencias */}
              {incs.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-600">Incidencias</p>
                  {incs.map(i => (
                    <div key={i.id} className="space-y-1.5">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={i.incluir}
                          onChange={() => setIncs(prev => prev.map(x => x.id === i.id ? { ...x, incluir: !x.incluir } : x))}
                          className="mt-0.5 accent-brand-orange shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className={`text-xs font-medium ${i.incluir ? 'text-gray-800' : 'text-gray-400 line-through'}`}>{i.label}</p>
                            {i.severidad && (
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${SEV_CFG[i.severidad]?.cls ?? ''}`}>
                                {SEV_CFG[i.severidad]?.label}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-gray-400">{i.sub}</p>
                        </div>
                      </label>
                      {/* Fotos */}
                      {inclFotos && i.fotos.length > 0 && (
                        <div className="ml-5 flex gap-1.5 flex-wrap">
                          {i.fotos.map((f, fi) => (
                            <label key={fi} className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${f.incluir ? 'border-brand-orange' : 'border-transparent opacity-50'}`}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={f.url} alt="" className="w-12 h-12 object-cover" />
                              <input type="checkbox" className="hidden" checked={f.incluir}
                                onChange={() => setIncs(prev => prev.map(x =>
                                  x.id === i.id
                                    ? { ...x, fotos: x.fotos.map((ff, ffi) => ffi === fi ? { ...ff, incluir: !ff.incluir } : ff) }
                                    : x
                                ))}
                              />
                              {f.incluir && (
                                <div className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-brand-orange rounded-full flex items-center justify-center">
                                  <Check size={8} className="text-white" />
                                </div>
                              )}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Planillas */}
              {plans.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-600">Planillas</p>
                  {plans.map(p => (
                    <label key={p.id} className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={p.incluir}
                        onChange={() => setPlans(prev => prev.map(x => x.id === p.id ? { ...x, incluir: !x.incluir } : x))}
                        className="mt-0.5 accent-brand-orange shrink-0"
                      />
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${p.tipo === 'hidrantes' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                          {p.label}
                        </span>
                        <p className={`text-[10px] ${p.incluir ? 'text-gray-500' : 'text-gray-400 line-through'}`}>{p.sub}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Two-column editor + preview ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4">

          {/* LEFT: Block editor */}
          <div className="flex flex-col gap-2">
            {/* Toolbar izquierdo */}
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide flex-1">
                Secciones del informe
              </p>
              <button
                onClick={regenerarIA}
                disabled={regenIA || genPdf}
                className="flex items-center gap-1.5 text-xs text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {regenIA ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                Regenerar con IA
              </button>
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {bloques.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-400">
                  Sin secciones generadas. Usá <strong>Regenerar con IA</strong>.
                </div>
              ) : (
                bloques.map(b => (
                  <BloqueCard key={b.id} bloque={b} onChange={updateBloque} />
                ))
              )}
            </div>
          </div>

          {/* RIGHT: PDF Preview */}
          <div
            className="relative bg-gray-100 rounded-xl border border-gray-200 overflow-hidden flex flex-col"
            style={{ minHeight: 480 }}
          >
            {/* PDF toolbar */}
            <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 flex-wrap justify-end">
              {modified && (
                <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">
                  Cambios sin aplicar
                </span>
              )}
              {/* Tipografía */}
              <div className="flex items-center gap-1 bg-white/95 border border-gray-200 rounded-lg px-2 py-1 shadow-sm">
                <Type size={10} className="text-gray-500 shrink-0" />
                <select
                  value={tipografia.familia}
                  onChange={e => onTipografia({ ...tipografia, familia: e.target.value as Tipografia['familia'] })}
                  className="text-[10px] bg-transparent border-none focus:outline-none max-w-[80px]"
                >
                  {FUENTES.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
                <select
                  value={tipografia.tamano}
                  onChange={e => onTipografia({ ...tipografia, tamano: e.target.value as Tipografia['tamano'] })}
                  className="text-[10px] bg-transparent border-none focus:outline-none"
                >
                  {TAMANOS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
              <button
                onClick={() => actualizarPdf()}
                disabled={genPdf}
                className="flex items-center gap-1 bg-white/95 hover:bg-white border border-gray-200 text-gray-600 hover:text-brand-orange text-[10px] font-medium px-2.5 py-1.5 rounded-lg shadow-sm transition-colors disabled:opacity-50"
              >
                {genPdf ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                Actualizar PDF
              </button>
              {pdfUrl && (
                <button
                  onClick={() => setFullscreen(true)}
                  className="bg-white/95 hover:bg-white border border-gray-200 text-gray-500 hover:text-brand-orange p-1.5 rounded-lg shadow-sm transition-colors"
                >
                  <Maximize2 size={13} />
                </button>
              )}
            </div>

            {genPdf ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 text-gray-400">
                <Loader2 size={26} className="animate-spin text-brand-orange" />
                <p className="text-xs">Generando PDF...</p>
              </div>
            ) : pdfUrl ? (
              <iframe src={pdfUrl} className="flex-1 w-full border-0" style={{ minHeight: 480 }} title="Vista previa" />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400 px-6">
                <Eye size={30} className="text-gray-300" />
                <p className="text-xs text-center leading-relaxed">
                  Hacé clic en <strong className="text-gray-600">Actualizar PDF</strong> para ver el resultado de tus cambios.
                </p>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between pt-2">
          <button
            onClick={onBack}
            className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-xl hover:bg-gray-100"
          >
            Atrás
          </button>
          <button
            onClick={handleConfirmar}
            disabled={saving || genPdf}
            className="flex items-center gap-2 bg-brand-orange text-white font-semibold px-5 py-2.5 rounded-xl text-sm disabled:opacity-40"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            Continuar <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </>
  )
}
