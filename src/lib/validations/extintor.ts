import { z } from 'zod'

const ExtintorItemSchema = z.object({
  numero: z.string(),
  tipo: z.string().min(1, 'El tipo es obligatorio'),
  senalizacion: z.boolean(),
  acceso: z.boolean(),
  presion_peso: z.boolean(),
  obs_senalizacion: z.string().nullable().optional(),
  obs_acceso: z.string().nullable().optional(),
  obs_presion_peso: z.string().nullable().optional(),
  foto_url: z.string().nullable().optional(),
})

const EXTINTOR_CAMPOS = [
  { field: 'senalizacion',  obs: 'obs_senalizacion',  label: 'Señalización' },
  { field: 'acceso',        obs: 'obs_acceso',        label: 'Acceso' },
  { field: 'presion_peso',  obs: 'obs_presion_peso',  label: 'Presión/Peso' },
] as const

// Regla 3: cada campo en NO requiere su propia observación
function requireObsIfNo(
  item: z.infer<typeof ExtintorItemSchema>,
  ctx: z.RefinementCtx,
  index: number
) {
  for (const { field, obs, label } of EXTINTOR_CAMPOS) {
    if (!item[field] && !item[obs]?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `La observación de ${label} es obligatoria`,
        path: [index, obs],
      })
    }
  }
}

export const PlanillaExtintoresSubmitSchema = z.object({
  cliente_id: z.string().uuid('Seleccioná un cliente'),
  fecha: z.string().min(1, 'La fecha es obligatoria'),
  turno: z.enum(['diurno', 'nocturno'], { message: 'Seleccioná un turno' }),
  items: z.array(ExtintorItemSchema).min(1, 'Debe haber al menos 1 extintor'),
  firma_dataurl: z.string().min(1, 'La firma es obligatoria'),
  firma_aclaracion: z.string().min(1, 'La aclaración (nombre y apellido) es obligatoria'),
}).superRefine((data, ctx) => {
  data.items.forEach((item, i) => requireObsIfNo(item, ctx, i))
})

export type PlanillaExtintoresSubmit = z.infer<typeof PlanillaExtintoresSubmitSchema>
