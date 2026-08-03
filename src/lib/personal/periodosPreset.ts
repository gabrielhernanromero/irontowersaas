export interface RangoFechas {
  desde: string // YYYY-MM-DD
  hasta: string // YYYY-MM-DD
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function rangoSemanaActual(hoy: Date = new Date()): RangoFechas {
  const dia = hoy.getDay() // 0 = domingo
  const lunes = new Date(hoy)
  lunes.setDate(hoy.getDate() - ((dia + 6) % 7))
  const domingo = new Date(lunes)
  domingo.setDate(lunes.getDate() + 6)
  return { desde: fmt(lunes), hasta: fmt(domingo) }
}

export function rangoQuincenaActual(hoy: Date = new Date()): RangoFechas {
  const anio = hoy.getFullYear()
  const mes = hoy.getMonth()
  if (hoy.getDate() <= 15) {
    return { desde: fmt(new Date(anio, mes, 1)), hasta: fmt(new Date(anio, mes, 15)) }
  }
  const finDeMes = new Date(anio, mes + 1, 0)
  return { desde: fmt(new Date(anio, mes, 16)), hasta: fmt(finDeMes) }
}

export function rangoMesActual(hoy: Date = new Date()): RangoFechas {
  const anio = hoy.getFullYear()
  const mes = hoy.getMonth()
  return { desde: fmt(new Date(anio, mes, 1)), hasta: fmt(new Date(anio, mes + 1, 0)) }
}
