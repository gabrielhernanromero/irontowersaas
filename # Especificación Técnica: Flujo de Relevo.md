# Especificación Técnica: Flujo de Relevo Crítico e Incidencias Persistentes
## Sistema de Gestión Operativa - Iron Tower Security

Este documento detalla la arquitectura, el flujo de pantallas (UX), el modelo de datos y las reglas de negocio necesarias para implementar el traspaso de mando inmutable y el arrastre de incidencias persistentes utilizando el stack tecnológico del proyecto.

---

## 1. Arquitectura de Datos (Modelado PostgreSQL / Supabase)

Para dar soporte al flujo de relevos y evitar la pérdida de información entre turnos, se mantiene la estructura lineal del `libro_turno` y `libro_novedad`, pero **se añade una nueva entidad** llamada `incidencias`. Esta tabla almacena los problemas activos que "flotan" de turno en turno hasta que cambian a estado resuelto.

### 1.1. Modificación sugerida en tablas existentes
*   **`libro_turno`**: Se debe agregar la columna `cliente_id` (UUID, FK a `clientes`) para saber en qué objetivo geográfico se está ejecutando la guardia y poder filtrar sus incidencias locales.

### 1.2. Nueva Tabla: `incidencias`
Clasifica los eventos dinámicos que requieren seguimiento inter-turno (ej: averías, vulnerabilidades perimetrales).

| Campo | Tipo | Restricciones | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Identificador único de la incidencia. |
| `cliente_id` | UUID | FOREIGN KEY -> `clientes(id)` | Objetivo/Predio donde ocurre el evento. |
| `turno_creacion_id`| UUID | FOREIGN KEY -> `libro_turno(id)` | Turno exacto donde se descubrió. |
| `turno_cierre_id`  | UUID | FOREIGN KEY -> `libro_turno(id)`, NULLABLE | Turno donde se solucionó el problema. |
| `titulo` | VARCHAR | NOT NULL | Título corto (ej: "Falla en portón norte"). |
| `descripcion` | TEXT | NOT NULL | Detalle del problema detectado. |
| `severidad` | VARCHAR | CHECK (bajo, medio, alto) | Nivel de criticidad para disparar alertas. |
| `estado` | VARCHAR | DEFAULT 'abierto' (abierto, resuelto) | Estado operativo de la incidencia. |
| `foto_url` | TEXT | NULLABLE | Evidencia fotográfica inicial en Supabase Storage. |
| `created_at` | TIMESTAMPTZ| DEFAULT now() | Fecha y hora de registro en servidor. |

---

## 2. Flujo de Estados del Turno y Lógica Operativa

El ciclo de vida del `libro_turno` se rige por la máquina de estados: `abierto` $\rightarrow$ `pendiente_relevo` $\rightarrow$ `cerrado`.

[ Técnico A: Abierto ]
│  (Registra novedades y checklists)
▼
[ Técnico A: Pendiente_Relevo ] ──► (Bloqueo de edición / Datos congelados)
│
├─► [ Técnico B pone PIN / QR ]
├─► [ Scroll obligatorio de Novedades e Incidencias ]
▼
[ Transacción Atómica / RPC ]
├─► Técnico A pasa a 'Cerrado' + Timestamp Fin + Hash SHA-256
└─► Técnico B pasa a 'Abierto' (Nuevo Turno Automático)


### Paso 1: Cierre del Turno A (`abierto` -> `pendiente_relevo`)
1. El Técnico A finaliza su jornada, completa sus novedades del día y presiona "Preparar Entrega de Guardia".
2. El sistema cambia el estado del turno a `pendiente_relevo`. 
3. **Regla de Inmutabilidad:** A partir de este microsegundo, las políticas RLS de Supabase impiden cualquier operación de `UPDATE` o `INSERT` en la tabla `libro_novedad` vinculada a este `turno_id`. El reporte queda congelado.

### Paso 2: Autenticación del Técnico B (Dispositivo Compartido/Tablet)
1. La aplicación detecta que la sesión activa posee un turno en estado `pendiente_relevo`.
2. Bloquea la interfaz gráfica mostrando una pantalla de Login Limpia: *"Puesto en Espera de Relevo"*.
3. El Técnico B debe ingresar su **PIN numérico de 4 dígitos** o escanear su **Código QR corporativo**.
4. El Route Handler de Next.js valida las credenciales y el ID del técnico entrante contra la tabla `users`.

### Paso 3: Pantalla de Relevo Obligatoria (UX de Lectura y Firma)
Antes de tomar control del puesto, el Técnico B es obligado a visualizar el estado del objetivo en un componente cliente de Next.js:
1. **Sección Novedades Inmediatas:** Muestra un feed cronológico con los registros de la tabla `libro_novedad` del Turno A.
2. **Sección Incidencias Activas:** Muestra la lista de registros de la tabla `incidencias` filtradas por el `cliente_id` del puesto donde el `estado == 'abierto'`.
3. **Mecanismo Anti-Fraude (Scroll Lock):** El contenedor del canvas de firma digital (`react-signature-canvas`) se mantiene deshabilitado. Se utiliza un listener de React para detectar cuando el scroll vertical del listado de novedades alcanza el `scrollHeight` (fondo). En ese instante se desbloquea el panel de firma.
4. El Técnico B estampa su firma con el dedo e indica sus aclaraciones.

---

## 3. Especificación de la API (Next.js Route Handlers)

El proceso de traspaso debe ser **atómico**. Si la creación del turno B falla, el turno A no debe cerrarse, evitando "zonas grises" horarias. Se implementa mediante una función RPC en la base de datos o una transacción secuencial controlada en `/api/turnos/relevo/route.ts`.

### 3.1. Validación de Esquema con Zod
```typescript
import { z } from 'zod';

export const RelevoSchema = z.object({
  turnoAnteriorId: z.string().uuid(),
  tecnicoEntranteId: z.string().uuid(),
  pinEntrante: z.string().length(4),
  clienteId: z.string().uuid(),
  firmaRelevoBase64: z.string().min(1), // Captura del canvas
  relevoNombre: z.string().min(2),
  relevoDni: z.string().min(7),
});


3.2. Lógica del Endpoint (POST /api/turnos/relevo)Al recibir el payload validado, el servidor ejecuta las siguientes acciones dentro de un bloque try/catch:Verificación de Identidad: Consulta la tabla users buscando correspondencia exacta entre tecnicoEntranteId y el hash del pinEntrante.Cálculo de Integridad ($SHA-256$): El Route Handler recupera todas las novedades del turno que cierra. Genera un hash criptográfico SHA-256 utilizando el módulo crypto de Node.js para asegurar que la información no sea alterada post-firma.Subida de Evidencia (Supabase Storage): Convierte el firmaRelevoBase64 a un archivo binario y lo almacena en el bucket firmas-relevos bajo la nomenclatura relevo-[turnoAnteriorId].png.Ejecución de Transacción Cierre/Apertura:


-- Lógica interna ejecutada en Supabase PostgreSQL
BEGIN;
  -- 1. Cerrar Turno A
  UPDATE libro_turno SET 
    estado = 'cerrado',
    horario_fin = NOW(),
    firma_relevo_url = [URL_STORAGE],
    relevo_nombre = [relevoNombre],
    relevo_dni = [relevoDni]
  WHERE id = [turnoAnteriorId];

  -- 2. Abrir Turno B Automáticamente
  INSERT INTO libro_turno (folio_numero, fecha, turno, tecnico_id, tecnico_nombre, tecnico_dni, horario_inicio, estado, cliente_id)
  VALUES ([SiguienteFolio], CURRENT_DATE, [CalcularTurnoSegunHora], [tecnicoEntranteId], [nombreEntrante], [dniEntrante], NOW(), 'abierto', [clienteId]);
COMMIT;




Estrategia de Resiliencia y Modo Offline

Dado que el personal de Iron Tower Security opera frecuentemente en perímetros industriales con conectividad intermitente (redes móviles saturadas o subsuelos blindados), el flujo de novedades adopta la doctrina de **Sincronización Asincrónica Local**:

1. **Almacenamiento del Estado de Conectividad:** Se monitorea el estado de la red en el frontend. Toda acción de carga de novedad o firma de relevo se impacta **primero** en la capa de almacenamiento local persistente del dispositivo.
2. **Estructura de payload local:** Los registros capturados sin señal se etiquetan con la bandera `sincronizado = false` y se guardan temporalmente junto a las rutas locales del File System de las imágenes tomadas por la cámara.
3. **Subida por Cola (Queue Processor):** Al detectar el restablecimiento de celdas de red/Wi-Fi, un servicio en segundo plano procesa la cola en orden cronológico estricto: primero sube las imágenes al bucket de Supabase Storage, recupera las URLs públicas y finalmente impacta los JSON en la base de datos remota, cambiando el flag local a `sincronizado = true`.

---

## 5. Control de Seguridad y Auditoría (Políticas RLS)

Para blindar legalmente a la empresa ante inspecciones o peritajes judiciales, la base de datos aplica seguridad estricta a nivel de filas (Row Level Security):

```sql
-- Habilitar RLS en la tabla libro_turno
ALTER TABLE libro_turno ENABLE ROW LEVEL SECURITY;

-- Política: Los técnicos solo pueden editar un turno si es propio y está abierto
CREATE POLICY "Permitir actualización solo en turnos abiertos propios"
ON libro_turno
FOR UPDATE
USING (auth.uid() = tecnico_id AND estado = 'abierto');

-- Política: Bloqueo total de eliminación
CREATE POLICY "Prohibir borrado de registros de guardia"
ON libro_turno
FOR DELETE
USING (false); -- Nadie, ni el creador, puede borrar una fila de la guardia


Con esta arquitectura, el sistema garantiza la continuidad operativa mediante el traspaso de incidencias abiertas, erradica la suplantación de identidad por PIN/QR y certifica la validez jurídica del libro de guardia digital.