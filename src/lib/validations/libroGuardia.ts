import { z } from 'zod'

const horaRegex = /^\d{2}:\d{2}$/

export const LibroGuardiaSchema = z.object({
  planilla_id: z.string().uuid().nullable().optional(),
  fecha: z.string().min(1, 'La fecha es obligatoria'),
  turno: z.enum(['diurno', 'nocturno'], { message: 'Seleccioná un turno' }),
  horario_inicio: z.string().regex(horaRegex, 'Ingresá el horario de inicio (HH:MM)'),
  horario_fin: z.string().regex(horaRegex, 'Ingresá el horario de fin (HH:MM)'),
  sin_novedades: z.boolean(),
  // Campos de novedad — obligatorios solo si sin_novedades=false
  hora: z.string().regex(horaRegex, 'Ingresá la hora en formato HH:MM').optional().or(z.literal('')),
  descripcion: z.string().optional(),
  riesgo_detectado: z.string().optional(),
  medidas_adoptadas: z.string().optional(),
  observaciones_generales: z.string().nullable().optional(),
}).superRefine((data, ctx) => {
  if (!data.sin_novedades) {
    if (!data.hora?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Ingresá la hora de la novedad', path: ['hora'] })
    }
    if (!data.descripcion?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Describí brevemente la novedad', path: ['descripcion'] })
    }
    if (!data.riesgo_detectado?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Describí el riesgo detectado', path: ['riesgo_detectado'] })
    }
    if (!data.medidas_adoptadas?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Describí las medidas adoptadas', path: ['medidas_adoptadas'] })
    }
  }
})

export type LibroGuardiaInput = z.infer<typeof LibroGuardiaSchema>
