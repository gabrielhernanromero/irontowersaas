import { PlanillaHidrantesSubmitSchema } from '@/lib/validations/planilla'
import { PlanillaExtintoresSubmitSchema } from '@/lib/validations/extintor'

// Cantidad de ítems ahora viene del catálogo configurable (planilla_items_config),
// no de una constante fija — estos tests cubren que el schema acepta cualquier
// cantidad > 0 y sigue exigiendo la Regla 3 (NO → observación) sin importar el total.

function makeHidranteItem(numero: string, overrides: Partial<{
  gabinete: boolean
  manga: boolean
  lanza: boolean
  valvula: boolean
  obs_gabinete: string | null
  obs_manga: string | null
  obs_lanza: string | null
  obs_valvula: string | null
}> = {}) {
  return {
    numero,
    gabinete: true,
    manga: true,
    lanza: true,
    valvula: true,
    obs_gabinete: null,
    obs_manga: null,
    obs_lanza: null,
    obs_valvula: null,
    foto_url: null,
    ...overrides,
  }
}

function makeExtintorItem(numero: string, overrides: Partial<{
  tipo: string
  senalizacion: boolean
  acceso: boolean
  presion_peso: boolean
  obs_senalizacion: string | null
  obs_acceso: string | null
  obs_presion_peso: string | null
}> = {}) {
  return {
    numero,
    tipo: 'ABC',
    senalizacion: true,
    acceso: true,
    presion_peso: true,
    obs_senalizacion: null,
    obs_acceso: null,
    obs_presion_peso: null,
    foto_url: null,
    ...overrides,
  }
}

const BASE = {
  cliente_id: '123e4567-e89b-42d3-a456-426614174000',
  fecha: '2026-07-13',
  turno: 'diurno' as const,
  firma_dataurl: 'data:image/png;base64,abc123',
  firma_aclaracion: 'Juan Pérez — DNI 12345678',
}

describe('Catálogo configurable — cantidad variable de hidrantes', () => {
  it('rechaza un catálogo vacío (cliente sin ítems configurados)', () => {
    const result = PlanillaHidrantesSubmitSchema.safeParse({ ...BASE, items: [] })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map((i) => i.message)).toContain(
        'No hay hidrantes configurados para este cliente'
      )
    }
  })

  it('acepta un catálogo chico (3 ítems) que antes hubiera sido rechazado por length(48)', () => {
    const items = [
      makeHidranteItem('H-001'),
      makeHidranteItem('H-002'),
      makeHidranteItem('H-003'),
    ]
    const result = PlanillaHidrantesSubmitSchema.safeParse({ ...BASE, items })
    expect(result.success).toBe(true)
  })

  it('acepta un catálogo grande (120 ítems)', () => {
    const items = Array.from({ length: 120 }, (_, i) =>
      makeHidranteItem(`H-${String(i + 1).padStart(3, '0')}`)
    )
    const result = PlanillaHidrantesSubmitSchema.safeParse({ ...BASE, items })
    expect(result.success).toBe(true)
  })

  it('Regla 3 sigue vigente con catálogo chico: NO sin observación → inválido', () => {
    const items = [makeHidranteItem('H-001', { gabinete: false, obs_gabinete: null })]
    const result = PlanillaHidrantesSubmitSchema.safeParse({ ...BASE, items })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === 'La observación de Gabinete es obligatoria')).toBe(true)
    }
  })
})

describe('Catálogo configurable — extintores (ya usaba .min(1), sin cambios de schema)', () => {
  it('acepta cualquier cantidad > 0 con tipo_extintor por ítem', () => {
    const items = [
      makeExtintorItem('E-001', { tipo: 'CO2' }),
      makeExtintorItem('E-002', { tipo: 'ABC' }),
    ]
    const result = PlanillaExtintoresSubmitSchema.safeParse({ ...BASE, items })
    expect(result.success).toBe(true)
  })

  it('rechaza catálogo vacío', () => {
    const result = PlanillaExtintoresSubmitSchema.safeParse({ ...BASE, items: [] })
    expect(result.success).toBe(false)
  })
})
