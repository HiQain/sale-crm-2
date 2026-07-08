# NexusCRM

A full-stack CRM application with a React frontend, Express API server, and PostgreSQL database.

## Stack

- **Frontend** (`artifacts/crm`): React 19 + Vite + TanStack Query + Tailwind CSS + shadcn/ui + wouter
- **API Server** (`artifacts/api-server`): Express 5 + Drizzle ORM + session-based auth (bcrypt + connect-pg-simple)
- **Database** (`lib/db`): PostgreSQL via Drizzle ORM
- **Shared libs**: `lib/api-spec` (OpenAPI), `lib/api-client-react` (generated React Query hooks), `lib/api-zod` (Zod schemas)
- **Package manager**: pnpm workspaces

## Running the app

Two workflows run in parallel:

| Workflow | Command | Notes |
|---|---|---|
| `artifacts/api-server: API Server` | `pnpm --filter @workspace/api-server run dev` | Builds then starts on `$PORT` |
| `artifacts/crm: web` | `pnpm --filter @workspace/crm run dev` | Vite dev server on `$PORT` |

## Environment variables

| Variable | Source | Notes |
|---|---|---|
| `DATABASE_URL` | Replit-managed | Auto-injected; do not set manually |
| `SESSION_SECRET` | Replit Secret | Used to sign session cookies |
| `PORT` | Replit-managed | Auto-injected per artifact |

## Database schema

Managed with Drizzle ORM. To push schema changes to the development DB:

```bash
cd lib/db && pnpm run push
```

Tables: `users`, `companies`, `contacts`, `deals`, `tasks`, `activities`, `session`

## Demo credentials

| Role | Email | Password |
|---|---|---|
| Admin | admin@hiqain.com | password |
| User | sarah.chen@hiqain.com | password |

## Architecture

- Role-based access control: admins see `/admin/*` routes, regular users see `/user/*`
- API routes are prefixed `/api/*` and proxied from the frontend via Vite
- OpenAPI spec in `lib/api-spec/openapi.yaml` drives code-gen for the React Query client

## User preferences

_None recorded yet._
