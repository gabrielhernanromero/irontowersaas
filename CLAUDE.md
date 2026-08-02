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

## Estándares de ingeniería (CI/CD)

- **CI obligatorio**: GitHub Actions (`.github/workflows/ci.yml`) corre `lint` + `typecheck` + `test:coverage` en cada PR y push a `staging`/`main`. No mergear con el check en rojo.
- **Conventional Commits**: los mensajes de commit se validan con `commitlint` (hook `commit-msg`). Formato `tipo: descripción` (`feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`).
- **Pre-commit automático**: Husky corre `lint-staged` (ESLint `--fix`) sobre los archivos `.ts`/`.tsx` staged antes de cada commit.
- **Cobertura mínima en reglas legales**: `jest.config.js` tiene `coverageThreshold` sobre los archivos que implementan la Regla 3 (`src/lib/validations/{extintor,libroGuardia,planilla,planillaGenerica}.ts`), calibrado al nivel medido — protege contra regresiones, no exige 100%.
  - **Gap conocido**: `checkDuplicatePlanilla.ts` (Regla 1) y `createAlerta.ts` (Regla 4) no tienen tests hoy — no llevan threshold porque un piso de 0% no protege nada. Pendiente escribirles tests.
- **Tests de integración** (`tests/integration/`) necesitan una DB real vía `.env.local` — no corren en CI (no hay secrets de Supabase configurados ahí a propósito, para no pegarle a `staging` en cada PR). Se corren a mano antes de mergear cambios riesgosos, junto con QA manual en staging.
- **ESLint recién se instaló** (antes no existía en el repo). `@typescript-eslint/no-explicit-any` y `no-unused-vars` están en `warn` (no bloquean CI) porque hay ~90 warnings de deuda preexistente en código nunca linteado — se van bajando de a poco, no exigir 0 warnings de golpe en un PR no relacionado.

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
