# NexusCRM

A professional, full-stack CRM (Customer Relationship Management) system with role-based authentication, Airtable-style spreadsheet tables, pipeline management, and complete CRUD for contacts, companies, deals, tasks, and activities.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/crm run dev` — run the CRM frontend (port 22444)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `SESSION_SECRET` — session signing secret (required in production)

## Auth

- Admin login: `admin@hiqain.com` / `password`
- Sample user: `sarah.chen@hiqain.com` / `password`
- Admin can create new users from `/admin/users`
- Session-based auth (express-session + connect-pg-simple)
- Role-based access: admin sees all data; users see only their own assigned records

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19, Vite, Wouter, TanStack Query, Tailwind CSS, shadcn/ui, Recharts
- API: Express 5, express-session, bcryptjs
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (zod/v4), drizzle-zod
- API codegen: Orval (from OpenAPI spec at `lib/api-spec/openapi.yaml`)

## Where things live

- `lib/api-spec/openapi.yaml` — single source of truth for API contracts
- `lib/db/src/schema/` — Drizzle schema (users, contacts, companies, deals, tasks, activities)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/lib/auth.ts` — session auth middleware
- `artifacts/crm/src/pages/` — React page components
- `artifacts/crm/src/contexts/AuthContext.tsx` — auth state + ProtectedRoute
- `artifacts/crm/src/components/ui/data-grid.tsx` — Airtable-style table component

## Architecture decisions

- Contract-first: OpenAPI spec → Orval codegen → typed React Query hooks and Zod schemas
- Session cookies (not JWT): simpler, server-authoritative, easy revocation
- Role-based data scoping in route handlers: non-admin users get their own records only (ownerId/assigneeId filter)
- No `GET /users/:id` for other users' profiles (admin-or-self enforced)
- SESSION_SECRET required in production; dev falls back with warning

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._
