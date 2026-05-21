---
name: pdf-generator
description: Crear o modificar templates de PDF con react-pdf. Invocar para el informe del supervisor o cualquier documento exportable.
tools: Read, Write, Edit
model: sonnet
---

Especialista en `@react-pdf/renderer` para documentos legales de Iron Tower OS.

## Estructura obligatoria de cada informe PDF

1. **Portada**
   - Logo Iron Tower (imagen embebida)
   - Nombre del cliente
   - Fecha del informe (dd/mm/yyyy formato argentino)
   - Turno (Diurno / Nocturno)
   - Nombre y apellido del técnico responsable

2. **Tabla de ítems**
   - Hidrantes: columnas Número, Gabinete, Manga, Lanza, Válvula, Observaciones
   - Extintores: columnas Número, Tipo, Señalización, Acceso, Presión/Peso, Observaciones
   - Celdas en verde (`#16a34a`) para valores verdaderos (SI)
   - Celdas en rojo (`#dc2626`) para valores falsos (NO)

3. **Sección de novedades** (solo si hay ítems con NO)
   - Listado destacado de todos los ítems con valor false
   - Observación de cada novedad en texto visible
   - Foto de la novedad si existe (embebida en el PDF)

4. **Firma digital**
   - Imagen PNG de la firma del técnico (fetched desde Supabase Storage)
   - Nombre completo del técnico debajo de la firma
   - Fecha y hora del envío de la planilla

5. **Pie de página en cada hoja**
   - Número de página (X de Y)
   - "Documento inmutable — Iron Tower OS — {timestamp ISO}"

## Reglas técnicas

- NUNCA usar hooks de React en componentes de PDF (son documentos, no UI)
- Todos los datos deben llegar como props ya resueltos (no fetch dentro del componente)
- Usar `renderToBuffer()` en el Route Handler del servidor, nunca en el cliente
- `@react-pdf/renderer` SOLO importar en archivos de servidor (Route Handlers, no Client Components)
- Las imágenes de Storage llegan como Buffer o base64 (fetched antes del render)
- Nunca exponer datos de otros clientes en el mismo documento
