// Lógica de validación de ventana de tiempo para apertura de guardia.
// Tolerancia de 30 min ANTES del inicio (cubre técnico que llega anticipado,
// incluyendo el caso cross-midnight: turno 00:00 del día siguiente).

const TOLERANCIA_MIN = 30

export interface EsquemaVentana {
  nombre: string
  hora_inicio: string     // "HH:MM"
  hora_fin: string        // "HH:MM"
  dias_semana: number[] | null  // 0=dom … 6=sáb; null = todos
  fecha_desde: string     // "YYYY-MM-DD"
  fecha_hasta: string | null    // "YYYY-MM-DD" o null = indefinido
}

/** Devuelve un Date con la hora local de Argentina (tratada como si fuera UTC). */
function nowArgentina(): Date {
  return new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' })
  )
}

function dateToStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

/**
 * Busca el primer esquema cuya ventana de tiempo cubre el momento actual
 * (con tolerancia de 30 min antes del inicio).
 *
 * Itera sobre hoy y mañana para cubrir el caso cross-midnight:
 *   turno 00:00→08:00 el 27/01 → ventana permitida desde 26/01 23:30.
 *
 * Retorna el esquema si hay match, null si ninguno aplica.
 */
export function findEsquemaActivo(esquemas: EsquemaVentana[]): EsquemaVentana | null {
  const now = nowArgentina()

  for (const offset of [0, 1]) {
    const candidate = new Date(now)
    candidate.setDate(candidate.getDate() + offset)
    const candidateStr = dateToStr(candidate)
    const candidateDow  = candidate.getDay()

    for (const e of esquemas) {
      // 1. Rango de fechas de vigencia del esquema
      if (e.fecha_desde > candidateStr) continue
      if (e.fecha_hasta && e.fecha_hasta < candidateStr) continue

      // 2. Día de la semana
      const dias = e.dias_semana ?? [0, 1, 2, 3, 4, 5, 6]
      if (!dias.includes(candidateDow)) continue

      // 3. Ventana horaria con tolerancia
      const [sH, sM] = e.hora_inicio.split(':').map(Number)
      const [fH, fM] = e.hora_fin.split(':').map(Number)

      const startDT = new Date(candidate)
      startDT.setHours(sH, sM, 0, 0)

      const endDT = new Date(candidate)
      endDT.setHours(fH, fM, 0, 0)
      // Cross-midnight: hora_fin <= hora_inicio → el fin es el día siguiente
      if (fH * 60 + fM <= sH * 60 + sM) endDT.setDate(endDT.getDate() + 1)

      const windowStart = new Date(startDT.getTime() - TOLERANCIA_MIN * 60_000)

      if (now >= windowStart && now < endDT) return e
    }
  }

  return null
}
