import { z } from 'zod'

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/

const GenericaItemSchema = z.object({
  numero: z.string(),
  respuestas: z.record(z.union([z.boolean(), z.string(), z.number()])),
  observaciones: z.record(z.string().nullable()),
  foto_url: z.string().nullable().optional(),
})

export type GenericaItem = z.infer<typeof GenericaItemSchema>

export interface CampoDef {
  clave: string
  etiqueta: string
  tipo_campo?: 'check' | 'select' | 'texto' | 'numero' | 'fecha' | 'ubicacion'
  opciones?: string[]
  valor_min?: number | null
  valor_max?: number | null
}

// Criterio único de "¿esto es una novedad?" — lo usan Zod (acá abajo, para
// exigir observación), la ruta de envío (para decidir si alerta a
// supervisores, Regla 4) y el PDF (para resaltar filas y armar la sección
// "Novedades"). Centralizado para que ningún lugar pueda desincronizarse:
// - check: valor === false.
// - numero: fuera del valor_min/valor_max configurado (si no hay ninguno
//   configurado, nunca es novedad).
// - select/texto/fecha: nunca son novedad (no son un check pasa/no-pasa).
export function respuestaEsNovedad(campo: CampoDef, valor: unknown): boolean {
  if (campo.tipo_campo === 'numero') {
    if (typeof valor !== 'number' || !Number.isFinite(valor)) return false
    if (campo.valor_min != null && valor < campo.valor_min) return true
    if (campo.valor_max != null && valor > campo.valor_max) return true
    return false
  }
  if (campo.tipo_campo === 'select' || campo.tipo_campo === 'texto' || campo.tipo_campo === 'fecha' || campo.tipo_campo === 'ubicacion') {
    return false
  }
  return valor === false // tipo_campo='check' (default)
}

export function itemTieneNovedad(
  item: { respuestas: Record<string, unknown> },
  campos: CampoDef[]
): boolean {
  return campos.some((c) => respuestaEsNovedad(c, item.respuestas[c.clave]))
}

// Regla 3: cada campo configurado debe estar presente.
// - tipo_campo='check' (default, igual que antes): boolean, y en false requiere
//   su propia observación — igual que HIDRANTE_CAMPOS/EXTINTOR_CAMPOS en
//   validations/planilla.ts y extintor.ts, pero iterando la lista de campos
//   configurada por el supervisor en vez de una lista fija.
// - tipo_campo='select': string no vacío, y si el campo tiene opciones
//   configuradas debe ser una de ellas. Nunca requiere observación.
// - tipo_campo='texto': string no vacío. Nunca requiere observación.
// - tipo_campo='fecha': string no vacío en formato YYYY-MM-DD. Nunca
//   requiere observación.
// - tipo_campo='numero': number finito; si queda fuera del rango
//   configurado (respuestaEsNovedad) requiere observación, igual que un
//   check en NO.
// También rechaza keys en "respuestas" que no correspondan a ningún campo
// configurado — si no, un cliente podría mandar datos bajo una key inventada
// y esquivar la obligación de observación (z.record() por sí solo acepta
// cualquier key).
function validarItemCampos(
  item: GenericaItem,
  campos: CampoDef[],
  ctx: z.RefinementCtx,
  index: number
) {
  const clavesValidas = new Set(campos.map((c) => c.clave))

  for (const clave of Object.keys(item.respuestas)) {
    if (!clavesValidas.has(clave)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Campo desconocido: ${clave}`,
        path: [index, 'respuestas', clave],
      })
    }
  }

  for (const campo of campos) {
    const { clave, etiqueta } = campo
    const valor = item.respuestas[clave]

    if (campo.tipo_campo === 'select') {
      if (typeof valor !== 'string' || !valor.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Falta completar ${etiqueta}`,
          path: [index, 'respuestas', clave],
        })
        continue
      }
      const opciones = campo.opciones ?? []
      if (opciones.length > 0 && !opciones.includes(valor)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Elegí una opción válida para ${etiqueta}`,
          path: [index, 'respuestas', clave],
        })
      }
      continue
    }

    if (campo.tipo_campo === 'texto' || campo.tipo_campo === 'ubicacion') {
      if (typeof valor !== 'string' || !valor.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Falta completar ${etiqueta}`,
          path: [index, 'respuestas', clave],
        })
      }
      continue
    }

    if (campo.tipo_campo === 'fecha') {
      if (typeof valor !== 'string' || !FECHA_REGEX.test(valor)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Falta completar ${etiqueta}`,
          path: [index, 'respuestas', clave],
        })
      }
      continue
    }

    if (campo.tipo_campo === 'numero') {
      if (typeof valor !== 'number' || !Number.isFinite(valor)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Falta completar ${etiqueta}`,
          path: [index, 'respuestas', clave],
        })
        continue
      }
      if (respuestaEsNovedad(campo, valor) && !item.observaciones[clave]?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `La observación de ${etiqueta} es obligatoria`,
          path: [index, 'observaciones', clave],
        })
      }
      continue
    }

    // tipo_campo='check' (default)
    if (typeof valor !== 'boolean') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Falta completar ${etiqueta}`,
        path: [index, 'respuestas', clave],
      })
      continue
    }
    if (valor === false && !item.observaciones[clave]?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `La observación de ${etiqueta} es obligatoria`,
        path: [index, 'observaciones', clave],
      })
    }
  }
}

export function buildPlanillaGenericaSchema(campos: CampoDef[]) {
  return z.object({
    cliente_id: z.string().uuid('Seleccioná un cliente'),
    fecha: z.string().min(1, 'La fecha es obligatoria'),
    turno: z.enum(['diurno', 'nocturno'], { message: 'Seleccioná un turno' }),
    items: z.array(GenericaItemSchema).min(1, 'No hay ítems configurados para este tipo de planilla'),
    firma_dataurl: z.string().min(1, 'La firma es obligatoria'),
    firma_aclaracion: z.string().min(1, 'La aclaración (nombre y apellido) es obligatoria'),
  }).superRefine((data, ctx) => {
    data.items.forEach((item, i) => validarItemCampos(item, campos, ctx, i))
  })
}

export type PlanillaGenericaSubmit = z.infer<ReturnType<typeof buildPlanillaGenericaSchema>>
