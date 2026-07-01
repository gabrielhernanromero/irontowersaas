'use client'
import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  BookOpen, AlertTriangle, BarChart2, Activity, ChevronRight, Loader2,
  CheckCircle, Check, Eye, Maximize2, X, RefreshCw, GripVertical,
  Plus, Save, LayoutTemplate, Type, Image as ImageIcon, Trash2,
} from 'lucide-react'
import {
  PLANTILLAS_SISTEMA, PlantillaInforme, PlantillaSeccion, TipoInformeTemplate,
  getPlantillasByTipo, loadPlantillasGuardadas, guardarPlantilla, eliminarPlantillaGuardada,
} from '@/lib/templates/informeTemplates'
import Step2SeleccionDatos, { type SeleccionDatos } from './Step2SeleccionDatos'
import Step3RevisarEditar from './Step3RevisarEditar'

interface Section  { heading: string; body: string }
interface Cliente    { id:string;nombre_empresa:string;contacto_email:string|null }
interface Turno      { id:string;tecnico_nombre:string;horario_inicio:string;horario_fin:string|null;turno:string;cliente_id:string;fecha:string }
interface Incidencia { id:string;titulo:string;estado:string;severidad:string|null;created_at:string;cliente_id:string;foto_url:string|null }
interface Planilla   { id:string;tipo:'hidrantes'|'extintores';fecha:string;turno:string;cliente_id:string;turno_id:string|null;firma_aclaracion:string|null }
interface Props { clientes:Cliente[];turnos:Turno[];incidencias:Incidencia[];planillas:Planilla[] }
interface Tipografia { familia:'Helvetica'|'Times-Roman'|'Courier';tamano:'sm'|'md'|'lg' }

type TipoInforme = 'turno'|'incidencia'|'ejecutivo'|'vida_incidencia'

const TIPOS = [
  {id:'turno' as TipoInforme,      label:'Turno(s) de guardia', desc:'Resumen de turnos con novedades', icon:BookOpen,      color:'text-blue-600 bg-blue-50'},
  {id:'incidencia' as TipoInforme, label:'Incidencia(s)',        desc:'Detalle de incidencias',          icon:AlertTriangle, color:'text-amber-600 bg-amber-50'},
  {id:'ejecutivo' as TipoInforme,  label:'Ejecutivo',            desc:'Resumen ejecutivo del periodo',   icon:BarChart2,     color:'text-emerald-600 bg-emerald-50'},
  {id:'vida_incidencia' as TipoInforme, label:'Vida de incidencia', desc:'Cronologia de una incidencia', icon:Activity,      color:'text-rose-600 bg-rose-50'},
]

const GEN_STEPS = ['Recopilando datos...','Analizando novedades...','Generando resumen ejecutivo...','Identificando patrones...','Finalizando...']
const fmt = (iso:string) => new Date(iso).toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'2-digit'})

const FUENTES: {id:Tipografia['familia'];label:string}[] = [
  {id:'Helvetica',    label:'Helvetica (Sans)'},
  {id:'Times-Roman',  label:'Times Roman (Serif)'},
  {id:'Courier',      label:'Courier (Mono)'},
]
const TAMANOS: {id:Tipografia['tamano'];label:string}[] = [
  {id:'sm', label:'Pequeño'},
  {id:'md', label:'Normal'},
  {id:'lg', label:'Grande'},
]

function parseSections(md: string): Section[] {
  const lines = md.split('\n')
  const sections: Section[] = []
  let cur: Section | null = null
  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (cur) sections.push({ ...cur, body: cur.body.trimEnd() })
      cur = { heading: line.slice(3).trim(), body: '' }
    } else if (cur) {
      cur.body += (cur.body ? '\n' : '') + line
    }
  }
  if (cur) sections.push({ ...cur, body: cur.body.trimEnd() })
  return sections
}

export default function NuevoInformeWizard({ clientes, turnos, incidencias, planillas }: Props) {
  const router = useRouter()
  const [step, setStep]             = useState<1|2|3|4>(1)
  const [tipo, setTipo]             = useState<TipoInforme|null>(null)
  const [clienteId, setClienteId]   = useState('')
  const [selTurnos, setSelTurnos]   = useState<string[]>([])
  const [selIncs, setSelIncs]       = useState<string[]>([])
  const [selPlan, setSelPlan]       = useState<string[]>([])
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [inclFotos, setInclFotos]   = useState(false)
  const [inclRondas, setInclRondas] = useState(false)
  const [informeId, setInformeId]   = useState<string|null>(null)

  // Step 3 state
  const [sections, setSections]             = useState<Section[]>([])
  const [sectionsModified, setSectionsModified] = useState(false)
  const [tipografia, setTipografia]         = useState<Tipografia>({familia:'Helvetica',tamano:'md'})
  const [selFotos, setSelFotos]             = useState<string[]>([])
  const [plantillasGuardadas, setPlantillasGuardadas] = useState<PlantillaInforme[]>([])

  // Section add
  const [addingSection, setAddingSection]   = useState(false)
  const [newHeading, setNewHeading]         = useState('')

  // Template save
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [templateName, setTemplateName]     = useState('')

  // Track active textarea for bold-on-selection
  const activeTA = useRef<{idx:number;el:HTMLTextAreaElement}|null>(null)

  // Drag & drop for reorder
  const dragIdx = useRef<number|null>(null)
  const [dragOver, setDragOver]             = useState<number|null>(null)

  // UI state
  const [pdfUrl, setPdfUrl]           = useState<string|null>(null)
  const [emailDestino, setEmailDest]  = useState('')
  const [genProgress, setGenProg]     = useState(-1)
  const [generando, setGenerando]     = useState(false)
  const [reGenerando, setReGenerando] = useState(false)
  const [genPdf, setGenPdf]           = useState(false)
  const [sending, setSending]         = useState(false)
  const [error, setError]             = useState<string|null>(null)
  const [fullscreen, setFullscreen]   = useState(false)

  const cliTurnos = useMemo(()=>turnos.filter(t=>t.cliente_id===clienteId),[turnos,clienteId])
  const cliIncs   = useMemo(()=>incidencias.filter(i=>i.cliente_id===clienteId),[incidencias,clienteId])
  const cliPlan   = useMemo(()=>planillas.filter(p=>p.cliente_id===clienteId),[planillas,clienteId])
  const cliObj    = useMemo(()=>clientes.find(c=>c.id===clienteId),[clientes,clienteId])

  // Fotos disponibles desde incidencias seleccionadas
  const fotosDisponibles = useMemo(()=>{
    return selIncs.flatMap(id=>{
      const inc = cliIncs.find(i=>i.id===id)
      return inc?.foto_url ? [{url:inc.foto_url, label:inc.titulo}] : []
    })
  },[selIncs, cliIncs])

  // Auto-select todas las fotos cuando cambia la lista de disponibles
  useEffect(()=>{
    if (inclFotos) setSelFotos(fotosDisponibles.map(f=>f.url))
  },[fotosDisponibles, inclFotos])

  // Cargar plantillas guardadas cuando se elige tipo
  useEffect(()=>{
    if (tipo) setPlantillasGuardadas(loadPlantillasGuardadas(tipo as TipoInformeTemplate))
  },[tipo])

  // Inconsistencias técnico-turno-planilla
  const inconsistencias = useMemo(()=>{
    if (!selPlan.length) return []
    const alerts: string[] = []
    for (const planId of selPlan) {
      const plan = planillas.find(p=>p.id===planId)
      if (!plan) continue
      if (plan.turno_id && selTurnos.length && !selTurnos.includes(plan.turno_id)) {
        const tipoLbl = plan.tipo==='hidrantes'?'Hidrantes':'Matafuegos'
        alerts.push(`La planilla de ${tipoLbl} del ${plan.fecha} corresponde a un turno no seleccionado. Verificá la selección.`)
        continue
      }
      if (plan.turno_id && plan.firma_aclaracion) {
        const t = turnos.find(t=>t.id===plan.turno_id)
        if (t) {
          const coincide = t.tecnico_nombre.toLowerCase().split(/[, ]+/).filter(Boolean)
            .some(w=>plan.firma_aclaracion!.toLowerCase().includes(w))
          if (!coincide) {
            const tipoLbl = plan.tipo==='hidrantes'?'Hidrantes':'Matafuegos'
            alerts.push(`⚠ Inconsistencia en Planilla de ${tipoLbl} (${plan.fecha}): firmada por "${plan.firma_aclaracion}" pero el turno figura a nombre de "${t.tecnico_nombre}".`)
          }
        }
      }
    }
    return alerts
  },[selPlan,planillas,selTurnos,turnos])

  // ── PDF generation ──────────────────────────────────────────────────────────
  async function generarPdf(overrideId?: string, opts?: {tipografia?: Tipografia; fotoUrls?: string[]}) {
    const id = overrideId ?? informeId
    if (!id) return
    setGenPdf(true)
    try {
      const body = opts ? JSON.stringify(opts) : undefined
      const res = await fetch(`/api/supervisor/informes/${id}/pdf`, {
        method: 'POST',
        ...(body ? {headers:{'Content-Type':'application/json'}, body} : {}),
      })
      if (res.ok && res.headers.get('content-type')?.includes('pdf')) {
        const blob = await res.blob()
        if (pdfUrl) URL.revokeObjectURL(pdfUrl)
        setPdfUrl(URL.createObjectURL(blob))
      }
    } catch {} finally { setGenPdf(false) }
  }

  // ── Create + AI generate ────────────────────────────────────────────────────
  async function crearYGenerar(ejecutivoData?: SeleccionDatos) {
    setError(null); setGenerando(true); setGenProg(0)
    const useClienteId  = ejecutivoData?.clienteId  ?? clienteId
    const useFechaDesde = ejecutivoData?.fechaDesde ?? fechaDesde
    const useFechaHasta = ejecutivoData?.fechaHasta ?? fechaHasta
    try {
      const payload: Record<string,unknown> = {tipo,cliente_id:useClienteId,incluir_fotos:inclFotos,incluir_rondas:inclRondas}
      if (tipo==='turno')           payload.turno_ids      = selTurnos
      if (tipo==='incidencia')      payload.incidencia_ids = selIncs
      if (tipo==='vida_incidencia') payload.incidencia_ids = selIncs.slice(0,1)
      if (tipo==='ejecutivo')       { payload.fecha_desde=useFechaDesde; payload.fecha_hasta=useFechaHasta }
      if (selPlan.length)           payload.planilla_ids   = selPlan

      const res = await fetch('/api/supervisor/informes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
      if (!res.ok) throw new Error((await res.json()).error??'Error al crear')
      const {informe} = await res.json()
      const newId = informe.id
      setInformeId(newId)

      for (let i=1;i<GEN_STEPS.length;i++) { await new Promise(r=>setTimeout(r,600)); setGenProg(i) }

      const genRes = await fetch(`/api/supervisor/informes/${newId}/generar`,{method:'POST'})
      if (!genRes.ok) throw new Error((await genRes.json()).error??'Error al generar')
      const {informe:upd} = await genRes.json()
      setSections(parseSections(upd.contenido_ai??''))
      setSectionsModified(false)
      setStep(3)
      generarPdf(newId, {tipografia, fotoUrls: inclFotos ? selFotos : []})
    } catch(e:unknown) {
      setError(e instanceof Error?e.message:'Error inesperado')
    } finally { setGenerando(false); setGenProg(-1) }
  }

  // ── Regenerate with AI ──────────────────────────────────────────────────────
  async function reGenerar() {
    if (!informeId) return
    setReGenerando(true); setError(null)
    try {
      const res = await fetch(`/api/supervisor/informes/${informeId}/generar`,{method:'POST'})
      if (!res.ok) throw new Error((await res.json()).error??'Error al regenerar')
      const {informe:upd} = await res.json()
      setSections(parseSections(upd.contenido_ai??''))
      setSectionsModified(false)
      setPdfUrl(null)
      generarPdf(undefined, {tipografia, fotoUrls: inclFotos ? selFotos : []})
    } catch(e:unknown) { setError(e instanceof Error?e.message:'Error al regenerar') }
    finally { setReGenerando(false) }
  }

  // ── Update PDF preview ──────────────────────────────────────────────────────
  async function actualizarPreview() {
    if (!informeId) return
    const md = sections.map(s=>`## ${s.heading}\n\n${s.body}`).join('\n\n')
    try {
      await fetch(`/api/supervisor/informes/${informeId}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({contenido:md})})
      setSectionsModified(false)
      if (pdfUrl) { URL.revokeObjectURL(pdfUrl); setPdfUrl(null) }
      generarPdf(undefined, {tipografia, fotoUrls: inclFotos ? selFotos : []})
    } catch {}
  }

  // ── Save + go to step 4 ─────────────────────────────────────────────────────
  async function guardarContenido() {
    if (!informeId) return
    const md = sections.map(s=>`## ${s.heading}\n\n${s.body}`).join('\n\n')
    await fetch(`/api/supervisor/informes/${informeId}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({contenido:md})})
    setStep(4)
    if (sectionsModified || !pdfUrl) {
      setSectionsModified(false)
      generarPdf(undefined, {tipografia, fotoUrls: inclFotos ? selFotos : []})
    }
  }

  async function enviar() {
    if (!informeId) return
    setSending(true); setError(null)
    try {
      const res = await fetch(`/api/supervisor/informes/${informeId}/enviar`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email_destino:emailDestino})})
      if (!res.ok) throw new Error((await res.json()).error??'Error al enviar')
      router.push('/supervisor/informes')
    } catch(e:unknown) { setError(e instanceof Error?e.message:'Error'); setSending(false) }
  }

  // ── Template management ─────────────────────────────────────────────────────
  function aplicarPlantilla(plantillaId: string) {
    const todas = [...getPlantillasByTipo(tipo as TipoInformeTemplate), ...plantillasGuardadas]
    const plantilla = todas.find(p=>p.id===plantillaId)
    if (!plantilla) return
    if (sections.length > 0 && !window.confirm(`¿Reemplazar el contenido actual con la plantilla "${plantilla.nombre}"?`)) return
    setSections(plantilla.secciones.map(s=>({heading:s.heading, body:s.body})))
    setSectionsModified(true)
    setPdfUrl(null)
  }

  function handleGuardarPlantilla() {
    if (!templateName.trim() || !tipo) return
    const nueva: PlantillaInforme = {
      id: `custom_${Date.now()}`,
      nombre: templateName.trim(),
      descripcion: 'Plantilla personalizada',
      tipo: tipo as TipoInformeTemplate,
      secciones: sections.map(s=>({heading:s.heading, body:s.body})),
    }
    guardarPlantilla(nueva)
    setPlantillasGuardadas(loadPlantillasGuardadas(tipo as TipoInformeTemplate))
    setTemplateName('')
    setSavingTemplate(false)
  }

  function handleEliminarPlantilla(id: string) {
    if (!tipo) return
    if (!window.confirm('¿Eliminar esta plantilla guardada?')) return
    eliminarPlantillaGuardada(tipo as TipoInformeTemplate, id)
    setPlantillasGuardadas(loadPlantillasGuardadas(tipo as TipoInformeTemplate))
  }

  // ── Section management ──────────────────────────────────────────────────────
  function updateSection(i: number, body: string) {
    const u = [...sections]; u[i] = {...u[i], body}; setSections(u); setSectionsModified(true)
  }

  function moveSection(from: number, to: number) {
    if (to < 0 || to >= sections.length) return
    const u = [...sections]
    const [removed] = u.splice(from, 1)
    u.splice(to, 0, removed)
    setSections(u); setSectionsModified(true)
  }

  function addSection() {
    if (!newHeading.trim()) return
    setSections([...sections, {heading: newHeading.trim(), body:''}])
    setSectionsModified(true)
    setNewHeading(''); setAddingSection(false)
  }

  function removeSection(i: number) {
    if (!window.confirm(`¿Eliminar la sección "${sections[i].heading}"?`)) return
    const u = [...sections]; u.splice(i,1); setSections(u); setSectionsModified(true)
  }

  // ── Drag & drop ─────────────────────────────────────────────────────────────
  function onDragStart(i: number) { dragIdx.current = i }
  function onDragOver(e: React.DragEvent, i: number) { e.preventDefault(); setDragOver(i) }
  function onDrop(e: React.DragEvent, i: number) {
    e.preventDefault()
    if (dragIdx.current !== null && dragIdx.current !== i) {
      moveSection(dragIdx.current, i)
    }
    dragIdx.current = null; setDragOver(null)
  }
  function onDragEnd() { dragIdx.current = null; setDragOver(null) }

  const canStep2 = !!tipo && !!clienteId && (
    tipo==='ejecutivo' ? !!fechaDesde&&!!fechaHasta :
    tipo==='turno'     ? selTurnos.length>0 :
    selIncs.length>0
  )

  const toggleT = (id:string) => setSelTurnos(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id])
  const toggleI = (id:string) => tipo==='vida_incidencia' ? setSelIncs([id]) : setSelIncs(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id])
  const toggleP = (id:string) => setSelPlan(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id])

  const STEPS = ['Tipo','Datos','Revisar y editar','Preview y envio']

  function canGoTo(n: number): boolean {
    if (n <= 2) return true
    if (n === 3) return !!informeId
    if (n === 4) return sections.length > 0
    return false
  }

  const plantillasSistema = tipo ? getPlantillasByTipo(tipo as TipoInformeTemplate) : []

  return (
    <>
    {/* Fullscreen modal */}
    {fullscreen && pdfUrl && (
      <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-white text-sm font-medium">Vista previa del informe</span>
          <button onClick={()=>setFullscreen(false)} className="text-white hover:text-gray-300"><X size={22}/></button>
        </div>
        <iframe src={pdfUrl} className="flex-1 w-full" title="Preview PDF fullscreen"/>
      </div>
    )}

    <div className={`${step===3?'max-w-6xl':'max-w-3xl'} mx-auto`}>

      {/* Stepper */}
      <div className="flex items-center gap-0 mb-8">
        {STEPS.map((s,i)=>{
          const n=i+1 as 1|2|3|4; const done=n<step; const active=n===step
          const clickable=done||canGoTo(n)
          return (
            <div key={s} className="flex items-center flex-1 last:flex-none">
              <div onClick={()=>{ if(clickable&&!active) setStep(n) }}
                className={`flex items-center gap-2 ${active?'text-brand-orange':done?'text-emerald-600':'text-gray-300'} ${clickable&&!active?'cursor-pointer':''}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${active?'border-brand-orange bg-brand-orange/10':done?'border-emerald-600 bg-emerald-50':canGoTo(n)?'border-gray-300 bg-white':'border-gray-200 bg-white'}`}>
                  {done?<Check size={12}/>:n}
                </div>
                <span className={`text-xs font-medium whitespace-nowrap ${active?'text-brand-orange':done?'text-emerald-600':canGoTo(n)?'text-gray-500':'text-gray-400'}`}>{s}</span>
              </div>
              {i<STEPS.length-1&&<div className={`flex-1 h-px mx-3 ${done?'bg-emerald-400':'bg-gray-200'}`}/>}
            </div>
          )
        })}
      </div>

      {error&&<div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>}

      {/* ── STEP 1 ── */}
      {step===1&&(
        <div className="space-y-4">
          <h2 className="text-base font-bold text-gray-800">Que tipo de informe queres generar?</h2>
          <div className="grid grid-cols-2 gap-3">
            {TIPOS.map(t=>{
              const Icon=t.icon
              return (
                <button key={t.id} type="button" onClick={()=>setTipo(t.id)}
                  className={`text-left p-4 rounded-2xl border-2 transition-all ${tipo===t.id?'border-brand-orange bg-brand-orange/5':'border-gray-100 bg-white hover:border-gray-200'}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${t.color}`}><Icon size={18}/></div>
                  <p className="text-sm font-bold text-gray-800">{t.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{t.desc}</p>
                </button>
              )
            })}
          </div>
          <div className="flex justify-end pt-2">
            <button disabled={!tipo} onClick={()=>setStep(2)} className="flex items-center gap-2 bg-brand-orange text-white font-semibold px-5 py-2.5 rounded-xl text-sm disabled:opacity-40">
              Continuar <ChevronRight size={16}/>
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Ejecutivo → selector granular con Sheet ── */}
      {step===2&&tipo==='ejecutivo'&&!generando&&(
        <Step2SeleccionDatos
          clientes={clientes}
          onConfirm={(sel)=>crearYGenerar(sel)}
          onBack={()=>setStep(1)}
        />
      )}

      {/* ── STEP 2: Otros tipos → selector original ── */}
      {step===2&&tipo!=='ejecutivo'&&!generando&&(
        <div className="space-y-5">
          <h2 className="text-base font-bold text-gray-800">Selecciona los datos del informe</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
            <select value={clienteId} onChange={e=>{setClienteId(e.target.value);setSelTurnos([]);setSelIncs([]);setSelPlan([])}}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white shadow-sm">
              <option value="">Selecciona un cliente</option>
              {clientes.map(c=><option key={c.id} value={c.id}>{c.nombre_empresa}</option>)}
            </select>
          </div>

          {clienteId&&tipo==='turno'&&(
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Turnos a incluir</label>
              {cliTurnos.length===0
                ?<p className="text-sm text-gray-400 italic">No hay turnos en los ultimos 60 dias.</p>
                :<div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {cliTurnos.map(t=>(
                    <label key={t.id} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${selTurnos.includes(t.id)?'border-brand-orange bg-brand-orange/5':'border-gray-100 hover:border-gray-200'}`}>
                      <input type="checkbox" checked={selTurnos.includes(t.id)} onChange={()=>toggleT(t.id)} className="mt-0.5 accent-brand-orange"/>
                      <div><p className="text-sm font-medium text-gray-800">{t.tecnico_nombre}</p><p className="text-xs text-gray-500">{t.fecha} · {t.turno==='diurno'?'Diurno':'Nocturno'} · {t.horario_inicio}</p></div>
                    </label>
                  ))}
                </div>
              }
            </div>
          )}

          {clienteId&&(tipo==='incidencia'||tipo==='vida_incidencia')&&(
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{tipo==='vida_incidencia'?'Incidencia a analizar':'Incidencias a incluir'}</label>
              {cliIncs.length===0
                ?<p className="text-sm text-gray-400 italic">No hay incidencias para este cliente.</p>
                :<div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {cliIncs.map(inc=>(
                    <label key={inc.id} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${selIncs.includes(inc.id)?'border-brand-orange bg-brand-orange/5':'border-gray-100 hover:border-gray-200'}`}>
                      <input type={tipo==='vida_incidencia'?'radio':'checkbox'} checked={selIncs.includes(inc.id)} onChange={()=>toggleI(inc.id)} className="mt-0.5 accent-brand-orange"/>
                      <div className="flex items-center gap-2 min-w-0">
                        <div><p className="text-sm font-medium text-gray-800">{inc.titulo}</p><p className="text-xs text-gray-500">{fmt(inc.created_at)} · {inc.estado==='abierto'?'Abierta':'Resuelta'}</p></div>
                        {inc.foto_url&&<ImageIcon size={13} className="text-gray-400 shrink-0" aria-label="Tiene foto adjunta"/>}
                      </div>
                    </label>
                  ))}
                </div>
              }
            </div>
          )}

          {clienteId&&tipo==='turno'&&(
            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="block text-sm font-medium text-gray-700">Planillas de control (opcional)</label>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">hidrantes · matafuegos</span>
              </div>
              {cliPlan.length===0
                ?<p className="text-sm text-gray-400 italic">No hay planillas enviadas en los ultimos 60 dias.</p>
                :<div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {cliPlan.map(p=>{
                    const turnoAsoc = p.turno_id ? turnos.find(t=>t.id===p.turno_id) : null
                    const hasMismatch = selPlan.includes(p.id) && turnoAsoc && p.firma_aclaracion &&
                      !turnoAsoc.tecnico_nombre.split(/[, ]+/).some((w:string)=>p.firma_aclaracion!.toLowerCase().includes(w.toLowerCase()))
                    return (
                      <label key={p.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${selPlan.includes(p.id)?hasMismatch?'border-amber-400 bg-amber-50':'border-brand-orange bg-brand-orange/5':'border-gray-100 hover:border-gray-200'}`}>
                        <input type="checkbox" checked={selPlan.includes(p.id)} onChange={()=>toggleP(p.id)} className="accent-brand-orange"/>
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${p.tipo==='hidrantes'?'bg-blue-100 text-blue-700':'bg-red-100 text-red-700'}`}>{p.tipo==='hidrantes'?'Hidrantes':'Matafuegos'}</span>
                          <span className="text-sm text-gray-700">{p.fecha}</span>
                          <span className="text-xs text-gray-400">{p.turno==='diurno'?'Diurno':'Nocturno'}</span>
                          {turnoAsoc&&<span className="text-xs text-gray-400">· {turnoAsoc.tecnico_nombre}</span>}
                          {hasMismatch&&<span className="text-xs font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">⚠ Técnico no coincide</span>}
                        </div>
                      </label>
                    )
                  })}
                </div>
              }
              {inconsistencias.length>0&&(
                <div className="mt-3 space-y-2">
                  {inconsistencias.map((msg,i)=>(
                    <div key={i} className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                      <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5"/>
                      <p className="text-xs text-amber-800 leading-relaxed">{msg}</p>
                    </div>
                  ))}
                  <p className="text-xs text-gray-500 pl-1">Podés continuar igual, pero el informe reflejará la inconsistencia.</p>
                </div>
              )}
            </div>
          )}

          {clienteId&&(
            <div className="flex flex-col gap-3 pt-2">
              <label className="flex items-center justify-between p-3 bg-gray-50 rounded-xl cursor-pointer">
                <span className="text-sm font-medium text-gray-700">Incluir fotos de incidencias</span>
                <div onClick={()=>setInclFotos(p=>!p)} className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${inclFotos?'bg-brand-orange':'bg-gray-300'}`}><div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${inclFotos?'translate-x-5':'translate-x-0.5'}`}/></div>
              </label>
            </div>
          )}

          <div className="flex justify-between pt-2">
            <button onClick={()=>setStep(1)} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-xl hover:bg-gray-100">Atras</button>
            <button disabled={!canStep2||generando} onClick={()=>crearYGenerar()} className="flex items-center gap-2 bg-brand-orange text-white font-semibold px-5 py-2.5 rounded-xl text-sm disabled:opacity-40">
              {generando&&<Loader2 size={16} className="animate-spin"/>} Generar con IA <ChevronRight size={16}/>
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Progreso de generación (ambos tipos) ── */}
      {step===2&&generando&&(
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-2">
            {GEN_STEPS.map((s,i)=>(
              <div key={i} className={`flex items-center gap-2 text-sm transition-opacity ${i<=genProgress?'opacity-100':'opacity-30'}`}>
                {i<genProgress?<CheckCircle size={14} className="text-emerald-500 shrink-0"/>:i===genProgress?<Loader2 size={14} className="text-blue-500 animate-spin shrink-0"/>:<div className="w-3.5 h-3.5 rounded-full border border-gray-300 shrink-0"/>}
                <span className={i<=genProgress?'text-gray-700':'text-gray-400'}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── STEP 3: Revisar y editar ── */}
      {step===3&&(
        <Step3RevisarEditar
          informeId={informeId!}
          tipo={tipo!}
          sections={sections}
          turnosSel={cliTurnos.filter(t=>selTurnos.includes(t.id))}
          incsSel={cliIncs.filter(i=>selIncs.includes(i.id))}
          plansSel={cliPlan.filter(p=>selPlan.includes(p.id))}
          inclFotos={inclFotos}
          tipografia={tipografia}
          onTipografia={setTipografia}
          initialPdfUrl={pdfUrl}
          onConfirm={(newPdfUrl)=>{
            if (newPdfUrl) setPdfUrl(newPdfUrl)
            setStep(4)
            if (!newPdfUrl) generarPdf()
          }}
          onBack={()=>setStep(2)}
        />
      )}

      {/* ── STEP 4: Preview + Send ── */}
      {step===4&&(
        <div className="space-y-5">
          <h2 className="text-base font-bold text-gray-800">Preview y envio</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="relative bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden" style={{minHeight:360}}>
              {pdfUrl&&(
                <button onClick={()=>setFullscreen(true)} title="Pantalla completa"
                  className="absolute top-2 right-2 z-10 bg-white/90 hover:bg-white border border-gray-200 text-gray-600 hover:text-brand-orange p-1.5 rounded-lg shadow-sm transition-colors">
                  <Eye size={14}/>
                </button>
              )}
              {genPdf?<div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400 p-8"><Loader2 size={28} className="animate-spin text-brand-orange"/><p className="text-sm">Generando PDF...</p></div>
              :pdfUrl?<iframe src={pdfUrl} className="w-full h-full" style={{minHeight:360}} title="Preview PDF"/>
              :<div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400 p-8"><p className="text-sm text-center">No se pudo generar el preview.</p><button onClick={()=>generarPdf()} className="text-sm text-brand-orange font-medium hover:underline">Reintentar</button></div>}
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email del cliente</label>
                <input type="email" value={emailDestino||cliObj?.contacto_email||''} onChange={e=>setEmailDest(e.target.value)} placeholder="cliente@empresa.com" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"/>
              </div>
              {pdfUrl&&<a href={pdfUrl} download={`informe-${informeId}.pdf`} className="flex items-center justify-center gap-2 w-full border border-gray-200 text-gray-700 font-medium px-4 py-2.5 rounded-xl text-sm hover:bg-gray-50">Descargar PDF</a>}
              <button disabled={(!emailDestino&&!cliObj?.contacto_email)||sending} onClick={enviar} className="flex items-center justify-center gap-2 w-full bg-brand-orange text-white font-semibold px-4 py-2.5 rounded-xl text-sm disabled:opacity-40">
                {sending?<Loader2 size={16} className="animate-spin"/>:null} Enviar informe
              </button>
              <button onClick={()=>router.push(`/supervisor/informes/${informeId}`)} className="flex items-center justify-center gap-2 w-full text-sm text-gray-500 hover:text-gray-700 py-2">Guardar y editar despues</button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  )
}
