import { z } from 'zod'

const hora = /^\d{2}:\d{2}$/

export const VerificacionElementoSchema = z.object({
  elemento_id:      z.string().uuid(),
  nombre:           z.string(),
  estado_operativo: z.enum(['ok', 'falla', 'faltante']),
  observacion:      z.string().optional(),
})

export const PersonalApoyoSchema = z.object({
  usuario_id: z.string().uuid(),
  nombre:     z.string(),
  presente:   z.boolean(),
})

export const AbrirTurnoSchema = z.object({
  fecha: z.string().min(1, 'La fecha es obligatoria'),
  turno: z.enum(['diurno', 'nocturno'], { message: 'Seleccioná un turno' }),
  tecnico_nombre: z.string().min(2, 'Ingresá tu nombre completo'),
  tecnico_dni: z.string().min(7, 'DNI inválido').max(10, 'DNI inválido'),
  horario_inicio: z.string().regex(hora, 'Formato HH:MM'),
  cliente_id: z.string().uuid().optional(),
  esquema_id: z.string().uuid().optional(),
  // Flag de encargado interino (apoyo que abre cuando el encargado no se presentó)
  interino: z.boolean().optional(),
  // Personal de apoyo con estado de presencia (confirma el encargado al abrir)
  personal_apoyo: z.array(PersonalApoyoSchema).optional(),
  // Relevo del turno anterior (opcional — si hay turno cerrado sin relevo)
  turno_saliente_id: z.string().uuid().optional(),
  relevo_firma_dataurl: z.string().optional(),
  // Verificación de elementos del puesto al abrir guardia
  verificacion_elementos: z.array(VerificacionElementoSchema).optional(),
})

export const NuevaNovedadSchema = z.object({
  turno_id: z.string().uuid(),
  hora: z.string().regex(hora, 'Formato HH:MM'),
  descripcion: z.string().min(1, 'Describí la novedad'),
  riesgo_detectado: z.string().optional(),
  medidas_adoptadas: z.string().optional(),
  observaciones_generales: z.string().optional(),
  foto_url: z.string().optional(),
  // Alerta urgente para el encargado (solo apoyo)
  es_alerta: z.boolean().optional(),
  // Incidencia persistente — se arrastra de turno en turno hasta resolverse (solo encargado)
  es_incidencia: z.boolean().optional(),
  incidencia_titulo: z.string().optional(),
  incidencia_severidad: z.enum(['bajo', 'medio', 'alto']).optional(),
}).refine(
  (d) => !(d.es_incidencia && !d.incidencia_titulo?.trim()),
  { message: 'El título de la incidencia es obligatorio', path: ['incidencia_titulo'] }
)

export const CerrarTurnoSchema = z.object({
  turno_id: z.string().uuid(),
  horario_fin: z.string().regex(hora, 'Formato HH:MM'),
  firma_cierre_dataurl: z.string().min(1, 'Tu firma es obligatoria para cerrar el turno'),
})

export const RelevoPSchema = z.object({
  turno_saliente_id: z.string().uuid(),
  relevo_nombre: z.string().min(2, 'Ingresá tu nombre completo'),
  relevo_dni: z.string().min(7, 'DNI inválido').max(10),
  firma_relevo_dataurl: z.string().min(1, 'Tu firma es obligatoria para confirmar el relevo'),
  // Datos para crear el nuevo turno del entrante
  horario_inicio: z.string().regex(hora, 'Formato HH:MM'),
  fecha: z.string().min(1, 'La fecha es obligatoria'),
  turno: z.enum(['diurno', 'nocturno']),
})

// ── Relevo por Especificación Técnica (PIN auth + SHA-256 + firmas-relevos) ──
export const RelevoEspecSchema = z.object({
  turnoAnteriorId:   z.string().uuid('ID de turno inválido'),
  tecnicoEntranteId: z.string().uuid('ID de técnico inválido'),
  pinEntrante:       z.string().length(4, 'El PIN debe tener exactamente 4 dígitos'),
  clienteId:         z.string().uuid('ID de cliente inválido'),
  firmaRelevoBase64: z.string().min(1, 'La firma es obligatoria'),
  relevoNombre:      z.string().min(2, 'Ingresá tu nombre completo'),
  relevoDni:         z.string().min(7, 'DNI inválido').max(10, 'DNI inválido'),
})

export const SeguimientoSchema = z.object({
  incidencia_id: z.string().uuid('ID inválido'),
  turno_id:      z.string().uuid('ID inválido'),
  descripcion:   z.string().min(5, 'Mínimo 5 caracteres'),
})

export const ResolucionSchema = z.object({
  incidencia_id:          z.string().uuid('ID inválido'),
  turno_id:               z.string().uuid('ID inválido'),
  descripcion_resolucion: z.string().min(15, 'Describí en detalle cómo se resolvió (mínimo 15 caracteres)'),
  foto_url:               z.string().optional(),
})

export type SeguimientoInput  = z.infer<typeof SeguimientoSchema>
export type ResolucionInput   = z.infer<typeof ResolucionSchema>
export type AbrirTurnoInput    = z.infer<typeof AbrirTurnoSchema>
export type NuevaNovedadInput  = z.infer<typeof NuevaNovedadSchema>
export type CerrarTurnoInput   = z.infer<typeof CerrarTurnoSchema>
export type RelevoPInput       = z.infer<typeof RelevoPSchema>
export type RelevoEspecInput   = z.infer<typeof RelevoEspecSchema>
