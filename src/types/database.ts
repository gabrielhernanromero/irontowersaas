export type Rol = 'admin' | 'supervisor' | 'tecnico' | 'cliente'
export type TipoPlanilla = 'hidrantes' | 'extintores'
export type Turno = 'diurno' | 'nocturno'
export type TipoAlerta = 'novedad_planilla' | 'planilla_pendiente' | 'certificacion_vence' | 'ronda_proxima' | 'ronda_vencida' | 'ausencia_encargado' | 'ronda_asignada' | 'novedad_apoyo' | 'cierre_anticipado' | 'turno_sin_cerrar'
export type EstadoTurno = 'abierto' | 'pendiente_relevo' | 'cerrado'
export type TipoNovedad = 'apertura' | 'novedad' | 'cierre' | 'alerta' | 'sistema'
export type EstadoAdmin = 'activo' | 'en_mantenimiento' | 'inactivo'
export type EstadoOperativo = 'ok' | 'falla' | 'faltante'

export interface User {
  id: string
  email: string
  nombre: string
  apellido: string
  dni: string | null
  rol: Rol
  activo: boolean
  turno_habitual: Turno | null
  rol_habitual: 'encargado' | 'apoyo' | null
  cliente_id: string | null
  created_at: string
}

export interface UserConEmpresa extends User {
  clientes: Pick<Cliente, 'id' | 'nombre_empresa'> | null
}

export interface Cliente {
  id: string
  nombre_empresa: string
  cuit: string
  direccion: string
  contacto_nombre: string
  contacto_email: string
  contacto_telefono: string
  activo: boolean
  frecuencia_ronda_minutos: number | null
  aviso_ronda_minutos: number
  planillas_habilitadas: string[]
}

export interface Planilla {
  id: string
  tipo: TipoPlanilla
  tecnico_id: string
  cliente_id: string
  turno_id?: string | null
  fecha: string
  turno: Turno
  firma_url: string | null
  firma_aclaracion?: string | null
  enviada_at: string | null
  inmutable: boolean
  user_agent: string
  created_at: string
  tecnicos?: User
  clientes?: Cliente
}

export interface PlanillaHidrante {
  id: string
  planilla_id: string
  numero: string
  gabinete: boolean
  manga: boolean
  lanza: boolean
  valvula: boolean
  obs_gabinete: string | null
  obs_manga: string | null
  obs_lanza: string | null
  obs_valvula: string | null
  foto_url: string | null
}

export interface PlanillaExtintor {
  id: string
  planilla_id: string
  numero: string
  tipo: string
  senalizacion: boolean
  acceso: boolean
  presion_peso: boolean
  obs_senalizacion: string | null
  obs_acceso: string | null
  obs_presion_peso: string | null
  foto_url: string | null
}

export interface LibroTurno {
  id: string
  folio_numero: number
  fecha: string
  turno: Turno
  tecnico_id: string
  tecnico_nombre: string
  tecnico_dni: string
  horario_inicio: string
  horario_fin: string | null
  estado: EstadoTurno
  firma_cierre_url: string | null
  firma_relevo_url: string | null
  relevo_nombre: string | null
  relevo_dni: string | null
  hash_novedades: string | null
  cliente_id: string | null
  esquema_id: string | null
  interino: boolean
  aviso_supervisor_at: string | null
  created_at: string
  novedades?: LibroNovedad[]
}

export interface Incidencia {
  id: string
  cliente_id: string
  turno_creacion_id: string
  turno_cierre_id: string | null
  titulo: string
  descripcion: string
  severidad: 'bajo' | 'medio' | 'alto' | null
  estado: 'abierto' | 'resuelto'
  foto_url: string | null
  elemento_afectado_id: string | null
  tecnico_detector_id: string | null
  tecnico_imputado_id: string | null
  turno_imputado_id: string | null
  // Flujo de aprobación del encargado (agregado en migración turnos_bicefalo)
  requiere_aprobacion: boolean
  estado_aprobacion: 'pendiente_revision' | 'aprobada' | 'rechazada'
  aprobada_por: string | null
  aprobada_at: string | null
  created_at: string
  libro_turno?: { tecnico_nombre: string; tecnico_dni: string } | null
  detector?: { nombre: string; apellido: string } | null
}

export interface EsquemaCobertura {
  id: string
  cliente_id: string
  nombre: string
  hora_inicio: string  // "HH:MM:SS"
  hora_fin: string
  activo: boolean
  created_at: string
  asignaciones?: AsignacionPersistente[]
}

export interface AsignacionPersistente {
  id: string
  esquema_id: string
  usuario_id: string
  rol_turno: 'encargado' | 'apoyo'
  created_at: string
  usuario?: Pick<User, 'id' | 'nombre' | 'apellido' | 'dni'>
}

// Excepción diaria (reemplaza a la asignación persistente para un día concreto)
export interface AsignacionTurno {
  id: string
  esquema_id: string
  usuario_id: string
  rol_turno: 'encargado' | 'apoyo'
  fecha: string
  created_by: string
  created_at: string
}

export interface ParticipacionTurno {
  id: string
  turno_id: string
  usuario_id: string
  rol_turno: 'apoyo'
  joined_at: string
}

export interface ElementoPuesto {
  id: string
  cliente_id: string
  nombre: string
  codigo_patrimonial: string
  categoria: string | null
  descripcion: string | null
  estado_admin: EstadoAdmin
  fecha_retiro_mantenimiento: string | null
  motivo_mantenimiento: string | null
  created_at: string
  // Populated via join
  incidencias?: { id: string; estado: string }[]
}

export interface ControlInventarioTurno {
  id: string
  turno_id: string
  elemento_id: string
  estado_operativo: EstadoOperativo
  observacion: string | null
  created_at: string
}

export interface LibroNovedad {
  id: string
  turno_id: string
  tecnico_id: string
  tipo: TipoNovedad
  hora: string
  descripcion: string
  riesgo_detectado: string | null
  medidas_adoptadas: string | null
  observaciones_generales: string | null
  foto_url: string | null
  incidencia_id: string | null
  planilla_id: string | null
  // Populated when fetched with joins
  incidencias?: {
    id: string
    titulo: string
    severidad: 'bajo' | 'medio' | 'alto' | null
    estado: 'abierto' | 'resuelto'
  } | null
  users?: { nombre: string; apellido: string } | null
  libro_turno?: { rol_turno: 'encargado' | 'apoyo' | null; tecnico_nombre: string | null } | null
  acusado_en?: string | null
  acusado_por?: string | null
  created_at: string
}

// Legacy — tabla original, se mantiene por historial
export interface LibroGuardia {
  id: string
  planilla_id: string | null
  tecnico_id: string
  fecha: string | null
  turno: Turno | null
  horario_inicio: string | null
  horario_fin: string | null
  sin_novedades: boolean
  hora: string | null
  descripcion: string | null
  riesgo_detectado: string | null
  medidas_adoptadas: string | null
  observaciones_generales: string | null
  foto_url: string | null
  created_at: string
  tecnicos?: User
}

export interface Alerta {
  id: string
  tipo: TipoAlerta
  mensaje: string
  leida: boolean
  destinatario_id: string
  planilla_id: string | null
  turno_id: string | null
  novedad_id: string | null
  resuelta: boolean
  resuelta_en: string | null
  resolucion_observacion: string | null
  resuelta_por: string | null
  created_at: string
}

export interface PlanillaConItems extends Planilla {
  items_hidrantes?: PlanillaHidrante[]
  items_extintores?: PlanillaExtintor[]
}
