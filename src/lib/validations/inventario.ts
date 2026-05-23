import { z } from 'zod'

export const ItemControlSchema = z.object({
  elementoId: z.string().uuid(),
  estadoOperativo: z.enum(['ok', 'falla', 'faltante']),
  observacion: z.string().optional(),
}).refine(
  (data) => {
    if (data.estadoOperativo !== 'ok' && (!data.observacion || data.observacion.trim().length < 10)) {
      return false
    }
    return true
  },
  {
    message: 'Describí el problema con al menos 10 caracteres.',
    path: ['observacion'],
  }
)

export const RelevoInventarioSchema = z.object({
  turnoNuevoId:    z.string().uuid(),
  turnoAnteriorId: z.string().uuid(),
  clienteId:       z.string().uuid(),
  controles: z.array(ItemControlSchema).min(1, { message: 'Debe auditar al menos un elemento.' }),
})

export const ReporteFallaSchema = z.object({
  turnoId:         z.string().uuid(),
  elementoId:      z.string().uuid(),
  tipo:            z.enum(['dañado', 'extraviado']),
  descripcionFalla: z.string().min(10, { message: 'Explicá el desperfecto con al menos 10 caracteres.' }),
  fotoUrl:         z.string().optional(),
})

export type ItemControlInput      = z.infer<typeof ItemControlSchema>
export type RelevoInventarioInput = z.infer<typeof RelevoInventarioSchema>
export type ReporteFallaInput     = z.infer<typeof ReporteFallaSchema>
