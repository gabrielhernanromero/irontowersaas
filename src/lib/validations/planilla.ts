import { z } from 'zod'

const HidranteItemSchema = z.object({
  numero: z.string(),
  gabinete: z.boolean(),
  manga: z.boolean(),
  lanza: z.boolean(),
  valvula: z.boolean(),
  obs_gabinete: z.string().nullable().optional(),
  obs_manga: z.string().nullable().optional(),
  obs_lanza: z.string().nullable().optional(),
  obs_valvula: z.string().nullable().optional(),
  foto_url: z.string().nullable().optional(),
})

const HIDRANTE_CAMPOS = [
  { field: 'gabinete', obs: 'obs_gabinete', label: 'Gabinete' },
  { field: 'manga',    obs: 'obs_manga',    label: 'Manga' },
  { field: 'lanza',    obs: 'obs_lanza',    label: 'Lanza' },
  { field: 'valvula',  obs: 'obs_valvula',  label: 'Válvula' },
] as const

// Regla 3: cada campo en NO requiere su propia observación
function requireObsIfNo(
  item: z.infer<typeof HidranteItemSchema>,
  ctx: z.RefinementCtx,
  index: number
) {
  for (const { field, obs, label } of HIDRANTE_CAMPOS) {
    if (!item[field] && !item[obs]?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `La observación de ${label} es obligatoria`,
        path: [index, obs],
      })
    }
  }
}

export const PlanillaHidrantesSubmitSchema = z.object({
  cliente_id: z.string().uuid('Seleccioná un cliente'),
  fecha: z.string().min(1, 'La fecha es obligatoria'),
  turno: z.enum(['diurno', 'nocturno'], { message: 'Seleccioná un turno' }),
  items: z.array(HidranteItemSchema).length(48, 'Deben ser exactamente 48 hidrantes'),
  firma_dataurl: z.string().min(1, 'La firma es obligatoria'),
  firma_aclaracion: z.string().min(1, 'La aclaración (nombre y apellido) es obligatoria'),
}).superRefine((data, ctx) => {
  data.items.forEach((item, i) => requireObsIfNo(item, ctx, i))
})

export type PlanillaHidrantesSubmit = z.infer<typeof PlanillaHidrantesSubmitSchema>
