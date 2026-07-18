import { buildPlanillaGenericaSchema, respuestaEsNovedad, itemTieneNovedad } from '@/lib/validations/planillaGenerica'

const CAMPOS = [
  { clave: 'estado', etiqueta: 'Estado' },
  { clave: 'carga', etiqueta: 'Carga' },
]

const BASE = {
  cliente_id: '123e4567-e89b-42d3-a456-426614174000',
  fecha: '2026-07-13',
  turno: 'diurno' as const,
  firma_dataurl: 'data:image/png;base64,abc123',
  firma_aclaracion: 'Juan Pérez — DNI 12345678',
}

function makeItem(numero: string, respuestas: Record<string, boolean | string | number>, observaciones: Record<string, string | null> = {}) {
  return { numero, respuestas, observaciones, foto_url: null }
}

describe('buildPlanillaGenericaSchema — tipo de planilla configurable por el supervisor', () => {
  it('acepta un ítem con todos los campos en true, sin observaciones', () => {
    const schema = buildPlanillaGenericaSchema(CAMPOS)
    const items = [makeItem('B-001', { estado: true, carga: true })]
    const result = schema.safeParse({ ...BASE, items })
    expect(result.success).toBe(true)
  })

  it('rechaza un campo en false sin observación (Regla 3, campos dinámicos)', () => {
    const schema = buildPlanillaGenericaSchema(CAMPOS)
    const items = [makeItem('B-001', { estado: false, carga: true }, { estado: null })]
    const result = schema.safeParse({ ...BASE, items })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === 'La observación de Estado es obligatoria')).toBe(true)
    }
  })

  it('acepta un campo en false CON observación', () => {
    const schema = buildPlanillaGenericaSchema(CAMPOS)
    const items = [makeItem('B-001', { estado: false, carga: true }, { estado: 'Vencido' })]
    const result = schema.safeParse({ ...BASE, items })
    expect(result.success).toBe(true)
  })

  it('funciona con un solo campo definido (tipo mínimo)', () => {
    const schema = buildPlanillaGenericaSchema([{ clave: 'ok', etiqueta: 'OK' }])
    const items = [makeItem('B-001', { ok: true })]
    const result = schema.safeParse({ ...BASE, items })
    expect(result.success).toBe(true)
  })

  it('rechaza catálogo vacío', () => {
    const schema = buildPlanillaGenericaSchema(CAMPOS)
    const result = schema.safeParse({ ...BASE, items: [] })
    expect(result.success).toBe(false)
  })

  it('acepta cantidad variable de ítems (3 o 300)', () => {
    const schema = buildPlanillaGenericaSchema(CAMPOS)
    const items = Array.from({ length: 300 }, (_, i) =>
      makeItem(`B-${String(i + 1).padStart(3, '0')}`, { estado: true, carga: true })
    )
    const result = schema.safeParse({ ...BASE, items })
    expect(result.success).toBe(true)
  })

  it('rechaza una key en "respuestas" que no corresponde a ningún campo configurado (evita esquivar Regla 3)', () => {
    const schema = buildPlanillaGenericaSchema(CAMPOS)
    const items = [makeItem('B-001', { estado: true, carga: true, inventado: false })]
    const result = schema.safeParse({ ...BASE, items })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === 'Campo desconocido: inventado')).toBe(true)
    }
  })

  it('rechaza un ítem al que le falta un campo configurado', () => {
    const schema = buildPlanillaGenericaSchema(CAMPOS)
    const items = [makeItem('B-001', { estado: true })] // falta "carga"
    const result = schema.safeParse({ ...BASE, items })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === 'Falta completar Carga')).toBe(true)
    }
  })
})

describe('buildPlanillaGenericaSchema — campos tipo "select" (lista de opciones)', () => {
  const CAMPOS_SELECT = [
    { clave: 'estado', etiqueta: 'Estado' }, // check, para mezclar con select
    { clave: 'marca', etiqueta: 'Marca', tipo_campo: 'select' as const, opciones: ['Ansul', 'Amerex', 'Badger'] },
  ]

  it('acepta un valor dentro de las opciones configuradas, sin observación', () => {
    const schema = buildPlanillaGenericaSchema(CAMPOS_SELECT)
    const items = [makeItem('B-001', { estado: true, marca: 'Amerex' })]
    const result = schema.safeParse({ ...BASE, items })
    expect(result.success).toBe(true)
  })

  it('rechaza un valor que no está en la lista de opciones', () => {
    const schema = buildPlanillaGenericaSchema(CAMPOS_SELECT)
    const items = [makeItem('B-001', { estado: true, marca: 'MarcaInventada' })]
    const result = schema.safeParse({ ...BASE, items })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === 'Elegí una opción válida para Marca')).toBe(true)
    }
  })

  it('rechaza un campo select vacío', () => {
    const schema = buildPlanillaGenericaSchema(CAMPOS_SELECT)
    const items = [makeItem('B-001', { estado: true, marca: '' })]
    const result = schema.safeParse({ ...BASE, items })
    expect(result.success).toBe(false)
  })

  it('un campo select en cualquier valor NUNCA pide observación (no es un check)', () => {
    const schema = buildPlanillaGenericaSchema(CAMPOS_SELECT)
    const items = [makeItem('B-001', { estado: true, marca: 'Ansul' }, {})]
    const result = schema.safeParse({ ...BASE, items })
    expect(result.success).toBe(true)
  })

  it('si el campo select no tiene opciones configuradas, acepta cualquier string no vacío', () => {
    const campos = [{ clave: 'marca', etiqueta: 'Marca', tipo_campo: 'select' as const, opciones: [] }]
    const schema = buildPlanillaGenericaSchema(campos)
    const items = [makeItem('B-001', { marca: 'Lo que sea' })]
    const result = schema.safeParse({ ...BASE, items })
    expect(result.success).toBe(true)
  })
})

describe('buildPlanillaGenericaSchema — campo tipo "texto"', () => {
  const CAMPOS_TEXTO = [{ clave: 'nota', etiqueta: 'Nota', tipo_campo: 'texto' as const }]

  it('acepta un texto no vacío, sin observación', () => {
    const schema = buildPlanillaGenericaSchema(CAMPOS_TEXTO)
    const items = [makeItem('B-001', { nota: 'Todo en orden' }, {})]
    const result = schema.safeParse({ ...BASE, items })
    expect(result.success).toBe(true)
  })

  it('rechaza un texto vacío', () => {
    const schema = buildPlanillaGenericaSchema(CAMPOS_TEXTO)
    const items = [makeItem('B-001', { nota: '' })]
    const result = schema.safeParse({ ...BASE, items })
    expect(result.success).toBe(false)
  })
})

describe('buildPlanillaGenericaSchema — campo tipo "fecha"', () => {
  const CAMPOS_FECHA = [{ clave: 'vencimiento', etiqueta: 'Vencimiento', tipo_campo: 'fecha' as const }]

  it('acepta una fecha en formato YYYY-MM-DD, sin observación', () => {
    const schema = buildPlanillaGenericaSchema(CAMPOS_FECHA)
    const items = [makeItem('B-001', { vencimiento: '2026-12-31' }, {})]
    const result = schema.safeParse({ ...BASE, items })
    expect(result.success).toBe(true)
  })

  it('rechaza un formato de fecha inválido', () => {
    const schema = buildPlanillaGenericaSchema(CAMPOS_FECHA)
    const items = [makeItem('B-001', { vencimiento: '31/12/2026' })]
    const result = schema.safeParse({ ...BASE, items })
    expect(result.success).toBe(false)
  })

  it('rechaza una fecha vacía', () => {
    const schema = buildPlanillaGenericaSchema(CAMPOS_FECHA)
    const items = [makeItem('B-001', { vencimiento: '' })]
    const result = schema.safeParse({ ...BASE, items })
    expect(result.success).toBe(false)
  })
})

describe('buildPlanillaGenericaSchema — campo tipo "numero" (con rango)', () => {
  const CAMPOS_NUMERO = [
    { clave: 'presion', etiqueta: 'Presión', tipo_campo: 'numero' as const, valor_min: 10, valor_max: 15 },
  ]

  it('acepta un valor dentro del rango, sin observación', () => {
    const schema = buildPlanillaGenericaSchema(CAMPOS_NUMERO)
    const items = [makeItem('B-001', { presion: 12 }, {})]
    const result = schema.safeParse({ ...BASE, items })
    expect(result.success).toBe(true)
  })

  it('rechaza un valor fuera de rango sin observación (se comporta como un NO)', () => {
    const schema = buildPlanillaGenericaSchema(CAMPOS_NUMERO)
    const items = [makeItem('B-001', { presion: 20 }, {})]
    const result = schema.safeParse({ ...BASE, items })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === 'La observación de Presión es obligatoria')).toBe(true)
    }
  })

  it('acepta un valor fuera de rango CON observación', () => {
    const schema = buildPlanillaGenericaSchema(CAMPOS_NUMERO)
    const items = [makeItem('B-001', { presion: 20 }, { presion: 'Manómetro fuera de calibración' })]
    const result = schema.safeParse({ ...BASE, items })
    expect(result.success).toBe(true)
  })

  it('sin min/max configurado, acepta cualquier número sin observación', () => {
    const campos = [{ clave: 'temperatura', etiqueta: 'Temperatura', tipo_campo: 'numero' as const }]
    const schema = buildPlanillaGenericaSchema(campos)
    const items = [makeItem('B-001', { temperatura: 999 }, {})]
    const result = schema.safeParse({ ...BASE, items })
    expect(result.success).toBe(true)
  })

  it('rechaza un valor no numérico', () => {
    const schema = buildPlanillaGenericaSchema(CAMPOS_NUMERO)
    const items = [makeItem('B-001', { presion: 'doce' as unknown as number })]
    const result = schema.safeParse({ ...BASE, items })
    expect(result.success).toBe(false)
  })
})

describe('respuestaEsNovedad / itemTieneNovedad — criterio compartido de "NO" (Regla 4)', () => {
  const CAMPO_CHECK = { clave: 'estado', etiqueta: 'Estado', tipo_campo: 'check' as const }
  const CAMPO_NUMERO = { clave: 'presion', etiqueta: 'Presión', tipo_campo: 'numero' as const, valor_min: 10, valor_max: 15 }
  const CAMPO_SELECT = { clave: 'marca', etiqueta: 'Marca', tipo_campo: 'select' as const, opciones: ['A', 'B'] }
  const CAMPO_TEXTO = { clave: 'nota', etiqueta: 'Nota', tipo_campo: 'texto' as const }
  const CAMPO_FECHA = { clave: 'vencimiento', etiqueta: 'Vencimiento', tipo_campo: 'fecha' as const }

  it('check en false es novedad', () => {
    expect(respuestaEsNovedad(CAMPO_CHECK, false)).toBe(true)
  })

  it('check en true no es novedad', () => {
    expect(respuestaEsNovedad(CAMPO_CHECK, true)).toBe(false)
  })

  it('numero fuera de rango es novedad', () => {
    expect(respuestaEsNovedad(CAMPO_NUMERO, 20)).toBe(true)
    expect(respuestaEsNovedad(CAMPO_NUMERO, 5)).toBe(true)
  })

  it('numero dentro de rango no es novedad', () => {
    expect(respuestaEsNovedad(CAMPO_NUMERO, 12)).toBe(false)
  })

  it('select/texto/fecha nunca son novedad, sea cual sea el valor', () => {
    expect(respuestaEsNovedad(CAMPO_SELECT, 'cualquiera')).toBe(false)
    expect(respuestaEsNovedad(CAMPO_TEXTO, '')).toBe(false)
    expect(respuestaEsNovedad(CAMPO_FECHA, '2026-01-01')).toBe(false)
  })

  it('itemTieneNovedad detecta un numérico fuera de rango entre varios campos mezclados', () => {
    const campos = [CAMPO_CHECK, CAMPO_NUMERO, CAMPO_SELECT]
    const item = { respuestas: { estado: true, presion: 20, marca: 'A' } }
    expect(itemTieneNovedad(item, campos)).toBe(true)
  })

  it('itemTieneNovedad es false si todo está en rango/OK', () => {
    const campos = [CAMPO_CHECK, CAMPO_NUMERO, CAMPO_SELECT]
    const item = { respuestas: { estado: true, presion: 12, marca: 'A' } }
    expect(itemTieneNovedad(item, campos)).toBe(false)
  })
})
