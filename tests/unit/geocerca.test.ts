import {
  distanciaHaversineMetros,
  clasificarDistancia,
  evaluarGeocerca,
  UMBRAL_EXCEPCION_M,
  UMBRAL_ALERTA_M,
} from '@/lib/gps/geocerca'

describe('distanciaHaversineMetros', () => {
  it('devuelve 0 para el mismo punto', () => {
    expect(distanciaHaversineMetros(-34.6037, -58.3816, -34.6037, -58.3816)).toBe(0)
  })

  it('calcula una distancia real conocida (Obelisco → Congreso, CABA, ~2.6km)', () => {
    // Obelisco: -34.6037,-58.3816 · Congreso: -34.6095,-58.3927
    const distancia = distanciaHaversineMetros(-34.6037, -58.3816, -34.6095, -58.3927)
    expect(distancia).toBeGreaterThan(1000)
    expect(distancia).toBeLessThan(1300)
  })
})

describe('clasificarDistancia', () => {
  it('null → sin_datos', () => {
    expect(clasificarDistancia(null)).toBe('sin_datos')
  })

  it('0m → normal', () => {
    expect(clasificarDistancia(0)).toBe('normal')
  })

  it(`${UMBRAL_EXCEPCION_M}m exacto → normal (corte estrictamente mayor)`, () => {
    expect(clasificarDistancia(UMBRAL_EXCEPCION_M)).toBe('normal')
  })

  it(`${UMBRAL_EXCEPCION_M + 1}m → excepcion`, () => {
    expect(clasificarDistancia(UMBRAL_EXCEPCION_M + 1)).toBe('excepcion')
  })

  it(`${UMBRAL_ALERTA_M}m exacto → excepcion (corte estrictamente mayor)`, () => {
    expect(clasificarDistancia(UMBRAL_ALERTA_M)).toBe('excepcion')
  })

  it(`${UMBRAL_ALERTA_M + 1}m → alerta`, () => {
    expect(clasificarDistancia(UMBRAL_ALERTA_M + 1)).toBe('alerta')
  })
})

describe('evaluarGeocerca', () => {
  it('sin coordenada capturada → sin_datos, sin lanzar excepción', () => {
    const resultado = evaluarGeocerca(
      { lat: null, lon: null },
      { lat: -34.6037, lon: -58.3816 }
    )
    expect(resultado).toEqual({ distanciaM: null, estado: 'sin_datos' })
  })

  it('sin coordenada de referencia (cliente sin cargar) → sin_datos', () => {
    const resultado = evaluarGeocerca(
      { lat: -34.6037, lon: -58.3816 },
      { lat: null, lon: null }
    )
    expect(resultado).toEqual({ distanciaM: null, estado: 'sin_datos' })
  })

  it('ambos puntos presentes y cercanos → normal', () => {
    const resultado = evaluarGeocerca(
      { lat: -34.6037, lon: -58.3816 },
      { lat: -34.6038, lon: -58.3817 }
    )
    expect(resultado.estado).toBe('normal')
    expect(resultado.distanciaM).not.toBeNull()
  })

  it('puntos lejanos → alerta', () => {
    const resultado = evaluarGeocerca(
      { lat: -34.6037, lon: -58.3816 },
      { lat: -34.6095, lon: -58.3927 }
    )
    expect(resultado.estado).toBe('alerta')
  })
})
