export type TipoInformeTemplate = 'guardia' | 'incidencias' | 'rondas' | 'general'

export interface PlantillaSeccion {
  heading: string
  body:    string
}

export interface PlantillaInforme {
  id:          string
  nombre:      string
  tipo:        TipoInformeTemplate
  descripcion: string
  secciones:   PlantillaSeccion[]
  esDelSistema?: boolean
}

export const PLANTILLAS_SISTEMA: PlantillaInforme[] = []

export function getPlantillasByTipo(tipo: TipoInformeTemplate): PlantillaInforme[] {
  return PLANTILLAS_SISTEMA.filter(p => p.tipo === tipo)
}

const KEY = 'it_plantillas'

function leerStorage(): PlantillaInforme[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

export function loadPlantillasGuardadas(tipo: TipoInformeTemplate): PlantillaInforme[] {
  return leerStorage().filter(p => p.tipo === tipo)
}

export function guardarPlantilla(p: PlantillaInforme): void {
  if (typeof window === 'undefined') return
  const todas = leerStorage().filter(x => x.id !== p.id)
  localStorage.setItem(KEY, JSON.stringify([...todas, p]))
}

export function eliminarPlantillaGuardada(tipo: TipoInformeTemplate, id: string): void {
  if (typeof window === 'undefined') return
  const todas = leerStorage().filter(x => !(x.id === id && x.tipo === tipo))
  localStorage.setItem(KEY, JSON.stringify(todas))
}
