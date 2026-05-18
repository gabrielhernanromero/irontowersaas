# Iron Tower OS — Reglas del proyecto

## Qué es esto

Sistema SaaS para gestión de operaciones de campo de Iron Tower (empresa IRATA argentina). Digitaliza el flujo de planillas de hidrantes, extintores y libro de guardia.

## Stack

Next.js 14 · TypeScript · Tailwind CSS · Supabase (Auth + PostgreSQL + Storage + Realtime) · @supabase/ssr · react-hook-form + Zod · react-signature-canvas · @react-pdf/renderer · Resend · Vercel

## Reglas CRÍTICAS (legales — jamás violar)

1. **Una planilla por turno**: `checkDuplicatePlanilla()` antes de cada INSERT
2. **Inmutable post-envío**: nunca UPDATE/DELETE si `inmutable=true`; RLS lo bloquea en DB
3. **NO → observación obligatoria**: Zod `superRefine` + UI enforcement
4. **Alerta en NO**: `alertarSupervisores()` tras INSERT con algún false
5. **Alerta si no envió**: Vercel Cron 10:00/22:00 → `/api/cron/check-pending`
6. **Trazabilidad**: `tecnico_id`, `enviada_at`, `user_agent` en cada planilla

## Patrones de código obligatorios

### Supabase — siempre lazy-load

```typescript
// src/lib/supabase/client.ts  → Client Components
export function supabase() { return createBrowserClient(...) }

// src/lib/supabase/server.ts  → Server Components, Route Handlers
export function supabaseServer() { return createServerClient(..., { cookies }) }

// src/lib/supabase/admin.ts   → Solo Route Handlers confiables
export function supabaseAdmin() { return createClient(..., serviceRoleKey) }
```

### Auth — usar `requireRole()` en layouts/pages de servidor

```typescript
// Redirige a /login si no hay sesión, a /unauthorized si no tiene el rol
const user = await requireRole('tecnico', 'admin')
```

### Middleware

- Protege todas las rutas salvo `/login` y `/unauthorized`
- Nunca llamar `redirect()` dentro de layouts (solo el middleware redirige)

## Flujo de trabajo por feature

```
1. /check-legal-rules   → qué reglas aplican
2. /plan                → plan con archivos (aprobar antes de ejecutar)
3. /new-supabase-migration → si toca la DB
4. Tests primero (TDD)
5. Implementación
6. mobile-first-reviewer → si es UI
7. /pre-commit
8. git commit
```

## Lo que NUNCA hacer

- `UPDATE` o `DELETE` sobre planilla con `inmutable=true`
- Hardcodear credenciales o API keys
- Commitear `.env.local`
- Usar `supabaseAdmin()` en Client Components
- `@react-pdf/renderer` en Client Components
- Avanzar sin plan aprobado en tareas que tocan más de 3 archivos

## Mobile-first

- Diseñar primero para 375px
- Targets táctiles mínimo 44×44px
- Texto mínimo 16px
- Sin hover como única interacción

## Agentes disponibles

- `business-rules-guardian` — verificar las 6 reglas antes de cada feature
- `supabase-expert` — migraciones SQL, RLS, Storage
- `mobile-first-reviewer` — revisar UI de técnico
- `pdf-generator` — templates de PDF con react-pdf
