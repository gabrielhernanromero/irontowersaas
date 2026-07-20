import { validateItemsMatchCatalog } from '@/lib/utils/validatePlanillaItemsCatalog'

let mockData: { numero: string }[] | null = null
let mockError: { message: string } | null = null

jest.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ data: mockData, error: mockError }),
          }),
        }),
      }),
    }),
  }),
}))

describe('validateItemsMatchCatalog', () => {
  beforeEach(() => {
    mockData = null
    mockError = null
  })

  it('ok cuando los números enviados coinciden exactamente con el catálogo activo', async () => {
    mockData = [{ numero: 'H-001' }, { numero: 'H-002' }, { numero: 'H-003' }]
    const result = await validateItemsMatchCatalog('cliente-1', 'hidrantes', ['H-001', 'H-002', 'H-003'])
    expect(result.ok).toBe(true)
  })

  it('falla si el técnico envía un ítem que ya no está activo en el catálogo', async () => {
    mockData = [{ numero: 'H-001' }, { numero: 'H-002' }]
    const result = await validateItemsMatchCatalog('cliente-1', 'hidrantes', ['H-001', 'H-002', 'H-003'])
    expect(result.ok).toBe(false)
  })

  it('falla si el supervisor agregó un ítem nuevo que el técnico no cargó', async () => {
    mockData = [{ numero: 'H-001' }, { numero: 'H-002' }, { numero: 'H-003' }]
    const result = await validateItemsMatchCatalog('cliente-1', 'hidrantes', ['H-001', 'H-002'])
    expect(result.ok).toBe(false)
  })

  it('falla si el catálogo quedó vacío pero se enviaron ítems viejos', async () => {
    mockData = []
    const result = await validateItemsMatchCatalog('cliente-1', 'hidrantes', ['H-001'])
    expect(result.ok).toBe(false)
  })

  it('propaga el error si la consulta a Supabase falla', async () => {
    mockError = { message: 'connection refused' }
    await expect(
      validateItemsMatchCatalog('cliente-1', 'hidrantes', ['H-001'])
    ).rejects.toThrow('connection refused')
  })
})
