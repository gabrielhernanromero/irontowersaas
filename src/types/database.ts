export type Rol = 'admin' | 'supervisor' | 'tecnico' | 'cliente'
export type TipoPlanilla = 'hidrantes' | 'extintores'
export type Turno = 'diurno' | 'nocturno'
export type TipoAlerta = 'novedad_planilla' | 'planilla_pendiente' | 'certificacion_vence'
export type EstadoTurno = 'abierto' | 'pendiente_relevo' | 'cerrado'
export type TipoNovedad = 'apertura' | 'novedad' | 'cierre'

export interface User {
  id: string
  email: string
  nombre: string
  apellido: string
  dni: string | null
  rol: Rol
  activo: boolean
  turno_habitual: Turno | null
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
  created_at: string
}

export interface LibroNovedad {
  id: string
  turno_id: string
  tipo: TipoNovedad
  hora: string
  descripcion: string
  riesgo_detectado: string | null
  medidas_adoptadas: string | null
  observaciones_generales: string | null
  foto_url: string | null
  incidencia_id: string | null
  // Populated when fetched with join: select('*, incidencias(*)')
  incidencias?: {
    id: string
    titulo: string
    severidad: 'bajo' | 'medio' | 'alto' | null
    estado: 'abierto' | 'resuelto'
  } | null
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
  created_at: string
}

export interface PlanillaConItems extends Planilla {
  items_hidrantes?: PlanillaHidrante[]
  items_extintores?: PlanillaExtintor[]
}
