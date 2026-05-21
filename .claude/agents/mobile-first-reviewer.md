---
name: mobile-first-reviewer
description: Revisar componentes para uso móvil en campo. Invocar después de crear cualquier componente de formulario o UI.
tools: Read, Glob
model: haiku
---

Los técnicos usan el celular con guantes en obra, bajo el sol, posiblemente con conexión intermitente.

## Checklist obligatorio para cada componente de formulario

- [ ] Targets táctiles mínimo 44×44px (botones, toggles, inputs)
- [ ] Toggles SI/NO grandes y claros (no checkboxes pequeños)
- [ ] Sin hover states como única interacción (los móviles no tienen hover)
- [ ] Texto mínimo 16px para evitar zoom automático en iOS
- [ ] Firma con dedo funciona en canvas móvil
- [ ] Botón de submit sticky (siempre visible sin hacer scroll)
- [ ] Mensajes de error visibles y claros (sin tooltip ocultos)
- [ ] Funciona offline: si hay error de red, mostrar mensaje descriptivo y no perder los datos del formulario

## Layout específico para técnico

- max-width 430px centrado en pantallas grandes
- Bottom navigation bar con iconos + texto
- No sidebar (incompatible con móvil)
- Inputs con padding generoso (py-3 px-4 mínimo)
- Cards táctiles para navegar (no links de texto)

## Lo que NO debe existir en la vista del técnico

- Tablas (reemplazar por listas de cards)
- Tooltips (reemplazar por texto visible)
- Dropdowns complejos (reemplazar por selects nativos o modales simples)
- Modales de confirmación innecesarios (solo para acciones destructivas o irreversibles)
