/**
 * Utilidades de tiempo para la lógica de cobertura.
 * Argentina = UTC-3, sin horario de verano.
 */

export function getArgTime(): { hours: number; minutes: number; hoy: string; ayer: string } {
  const now  = new Date()
  const arg  = new Date(now.getTime() - 3 * 60 * 60 * 1000)
  const argY = new Date(now.getTime() - 3 * 60 * 60 * 1000 - 24 * 60 * 60 * 1000)
  return {
    hours:   arg.getUTCHours(),
    minutes: arg.getUTCMinutes(),
    hoy:     arg.toISOString().split('T')[0],
    ayer:    argY.toISOString().split('T')[0],
  }
}

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/**
 * Determina si el tiempo actual cae dentro de la ventana operativa del esquema.
 * Ventana: [hora_inicio - 30 min, hora_fin - 60 min]
 * Soporta turnos nocturnos que cruzan medianoche.
 */
export function isWithinWindow(horaInicio: string, horaFin: string, h: number, m: number): boolean {
  const initMin  = toMin(horaInicio)
  const finMin   = toMin(horaFin)
  const cur      = h * 60 + m
  const openFrom = initMin - 30
  const openTo   = finMin  - 60

  // Turno nocturno que cruza medianoche (e.g., 20:00 → 08:00)
  if (finMin < initMin) {
    const from = openFrom >= 0 ? openFrom : 1440 + openFrom
    return cur >= from || cur <= openTo
  }

  // Turno normal. Si openFrom es negativo (turno inicia cerca de medianoche)
  if (openFrom < 0) {
    return cur >= (1440 + openFrom) || cur <= openTo
  }

  return cur >= openFrom && cur <= openTo
}

/**
 * Deriva 'diurno' o 'nocturno' desde hora_inicio para compatibilidad con
 * el campo libro_turno.turno (que aún existe por historial).
 */
export function deriveTurno(horaInicio: string): 'diurno' | 'nocturno' {
  const h = parseInt(horaInicio.split(':')[0], 10)
  return h >= 6 && h < 18 ? 'diurno' : 'nocturno'
}

/** Formatea "08:00:00" → "08:00" */
export function fmtHora(t: string): string {
  return t.slice(0, 5)
}
