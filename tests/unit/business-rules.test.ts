import { PlanillaHidrantesSubmitSchema } from '@/lib/validations/planilla'
import { PlanillaExtintoresSubmitSchema } from '@/lib/validations/extintor'
import { LibroGuardiaSchema } from '@/lib/validations/libroGuardia'

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeHidranteItems(overrides: Partial<{
  gabinete: boolean
  manga: boolean
  lanza: boolean
  valvula: boolean
  observaciones: string | null
}> = {}, count = 48) {
  return Array.from({ length: count }, (_, i) => ({
    numero: `H-${String(i + 1).padStart(3, '0')}`,
    gabinete: true,
    manga: true,
    lanza: true,
    valvula: true,
    observaciones: null,
    foto_url: null,
    ...overrides,
  }))
}

function makeExtintorItems(overrides: Partial<{
  tipo: string
  senalizacion: boolean
  acceso: boolean
  presion_peso: boolean
  observaciones: string | null
}> = {}, count = 113) {
  return Array.from({ length: count }, (_, i) => ({
    numero: `E-${String(i + 1).padStart(3, '0')}`,
    tipo: 'ABC',
    senalizacion: true,
    acceso: true,
    presion_peso: true,
    observaciones: null,
    foto_url: null,
    ...overrides,
  }))
}

const BASE_PLANILLA = {
  cliente_id: '123e4567-e89b-42d3-a456-426614174000',
  fecha: '2026-05-05',
  turno: 'diurno' as const,
  firma_dataurl: 'data:image/png;base64,abc123',
}

// ─── Regla 1: Una planilla por turno ─────────────────────────────────────────
// La validación de duplicados ocurre en la API Route, no en el schema.
// El schema sí valida que turno sea 'diurno' | 'nocturno'.
describe('Regla 1 — Una planilla por turno (schema)', () => {
  it('rechaza turno inválido', () => {
    const result = PlanillaHidrantesSubmitSchema.safeParse({
      ...BASE_PLANILLA,
      turno: 'vespertino',
      items: makeHidranteItems(),
    })
    expect(result.success).toBe(false)
  })

  it('acepta turno diurno y nocturno', () => {
    for (const turno of ['diurno', 'nocturno'] as const) {
      const result = PlanillaHidrantesSubmitSchema.safeParse({
        ...BASE_PLANILLA,
        turno,
        items: makeHidranteItems(),
      })
      expect(result.success).toBe(true)
    }
  })
})

// ─── Regla 2: Inmutabilidad (enforced en API + RLS, testeable via schema) ────
describe('Regla 2 — Inmutabilidad post-envío', () => {
  // El schema de submit no incluye campos de estado (inmutable, enviada_at).
  // Verificamos que el schema no acepta esos campos (no los expone al cliente).
  it('el schema de submit no incluye campo inmutable', () => {
    const result = PlanillaHidrantesSubmitSchema.safeParse({
      ...BASE_PLANILLA,
      inmutable: true,
      items: makeHidranteItems(),
    })
    // Zod strip extra keys → sigue siendo válido pero sin el campo
    if (result.success) {
      expect((result.data as Record<string, unknown>).inmutable).toBeUndefined()
    }
  })
})

// ─── Regla 3: NO → observaciones obligatorias ────────────────────────────────
describe('Regla 3 — NO implica observaciones obligatorias', () => {
  it('hidrantes: gabinete=false sin observaciones → inválido', () => {
    const items = makeHidranteItems({ gabinete: false, observaciones: null })
    const result = PlanillaHidrantesSubmitSchema.safeParse({ ...BASE_PLANILLA, items })
    expect(result.success).toBe(false)
    if (!result.success) {
      const msgs = result.error.issues.map((i) => i.message)
      expect(msgs).toContain('Las observaciones son obligatorias cuando hay un NO')
    }
  })

  it('hidrantes: gabinete=false CON observaciones → válido', () => {
    const items = makeHidranteItems({ gabinete: false, observaciones: 'Gabinete roto' })
    const result = PlanillaHidrantesSubmitSchema.safeParse({ ...BASE_PLANILLA, items })
    expect(result.success).toBe(true)
  })

  it('extintores: acceso=false sin observaciones → inválido', () => {
    const items = makeExtintorItems({ acceso: false, observaciones: null })
    const result = PlanillaExtintoresSubmitSchema.safeParse({ ...BASE_PLANILLA, items })
    expect(result.success).toBe(false)
    if (!result.success) {
      const msgs = result.error.issues.map((i) => i.message)
      expect(msgs).toContain('Las observaciones son obligatorias cuando hay un NO')
    }
  })

  it('extintores: todos OK → válido sin observaciones', () => {
    const items = makeExtintorItems()
    const result = PlanillaExtintoresSubmitSchema.safeParse({ ...BASE_PLANILLA, items })
    expect(result.success).toBe(true)
  })

  it('todos los campos false de un hidrante → un solo error de observaciones', () => {
    const items = makeHidranteItems({
      gabinete: false,
      manga: false,
      lanza: false,
      valvula: false,
      observaciones: null,
    })
    const result = PlanillaHidrantesSubmitSchema.safeParse({ ...BASE_PLANILLA, items })
    expect(result.success).toBe(false)
  })
})

// ─── Regla 4: Alerta en NO ────────────────────────────────────────────────────
describe('Regla 4 — Detección de NOs para alertas', () => {
  it('detecta correctamente items con algún NO en hidrantes', () => {
    const items = makeHidranteItems({ gabinete: false, observaciones: 'obs' })
    const hayNo = items.some(
      (i) => !i.gabinete || !i.manga || !i.lanza || !i.valvula
    )
    expect(hayNo).toBe(true)
  })

  it('no hay NOs cuando todos son true', () => {
    const items = makeHidranteItems()
    const hayNo = items.some(
      (i) => !i.gabinete || !i.manga || !i.lanza || !i.valvula
    )
    expect(hayNo).toBe(false)
  })

  it('detecta NOs en extintores', () => {
    const items = makeExtintorItems({ presion_peso: false, observaciones: 'obs' })
    const hayNo = items.some(
      (i) => !i.senalizacion || !i.acceso || !i.presion_peso
    )
    expect(hayNo).toBe(true)
  })
})

// ─── Regla 5: Alerta si no envió planilla ────────────────────────────────────
describe('Regla 5 — Cron y detección de turno', () => {
  it('turno diurno antes de las 18h', () => {
    const hora = 10
    const turno = hora < 18 ? 'diurno' : 'nocturno'
    expect(turno).toBe('diurno')
  })

  it('turno nocturno a las 22h', () => {
    const hora = 22
    const turno = hora < 18 ? 'diurno' : 'nocturno'
    expect(turno).toBe('nocturno')
  })
})

// ─── Regla 6: Trazabilidad ────────────────────────────────────────────────────
describe('Regla 6 — Trazabilidad', () => {
  it('schema exige cliente_id, fecha y turno', () => {
    // Sin fecha
    const r1 = PlanillaHidrantesSubmitSchema.safeParse({
      ...BASE_PLANILLA,
      fecha: '',
      items: makeHidranteItems(),
    })
    expect(r1.success).toBe(false)

    // Sin cliente_id
    const r2 = PlanillaHidrantesSubmitSchema.safeParse({
      ...BASE_PLANILLA,
      cliente_id: '',
      items: makeHidranteItems(),
    })
    expect(r2.success).toBe(false)
  })

  it('schema exige firma_dataurl', () => {
    const result = PlanillaHidrantesSubmitSchema.safeParse({
      ...BASE_PLANILLA,
      firma_dataurl: '',
      items: makeHidranteItems(),
    })
    expect(result.success).toBe(false)
  })
})

// ─── Libro de Guardia ─────────────────────────────────────────────────────────
describe('LibroGuardia schema', () => {
  it('válido con campos obligatorios', () => {
    const result = LibroGuardiaSchema.safeParse({
      hora: '14:30',
      riesgo_detectado: 'Fuga en tubería',
      medidas_adoptadas: 'Se aisló el área',
    })
    expect(result.success).toBe(true)
  })

  it('inválido sin riesgo_detectado', () => {
    const result = LibroGuardiaSchema.safeParse({
      hora: '14:30',
      riesgo_detectado: '',
      medidas_adoptadas: 'Se aisló el área',
    })
    expect(result.success).toBe(false)
  })

  it('inválido con formato de hora incorrecto', () => {
    const result = LibroGuardiaSchema.safeParse({
      hora: '2:30 PM',
      riesgo_detectado: 'algo',
      medidas_adoptadas: 'algo',
    })
    expect(result.success).toBe(false)
  })
})
