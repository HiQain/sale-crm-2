# NexusCRM

A full-stack CRM application for managing leads, deals, companies, contacts, tasks, and billing. Built as a pnpm monorepo with a React frontend and Express API backend.

## Stack

- **Frontend**: React 19, Vite, Tailwind CSS 4, Radix UI (shadcn/ui), Wouter (routing), TanStack Query
- **Backend**: Node.js, Express, Pino logging, express-session with PostgreSQL session store
- **Database**: PostgreSQL via Drizzle ORM
- **Auth**: Session-based (bcryptjs passwords, PostgreSQL session store)

## Project Structure

```
artifacts/
  crm/          # React + Vite frontend (preview path: /)
  api-server/   # Express API server (preview path: /api)
lib/
  db/           # Drizzle schema + DB client (@workspace/db)
  api-client-react/  # Generated API client with React Query hooks
  api-zod/      # Zod schemas for API contract
  api-spec/     # OpenAPI spec
```

## Running the Project

Three workflows run automatically:
- **CRM frontend** — `pnpm --filter @workspace/crm run dev` (preview path `/`)
- **API server** — `pnpm --filter @workspace/api-server run dev` (preview path `/api`)
- **Canvas / Component Preview Server** — `pnpm --filter @workspace/mockup-sandbox run dev` (preview path `/__mockup`)

Setup already done: `pnpm install`, `pnpm --filter @workspace/db run push` (applies Drizzle schema to Postgres). `DATABASE_URL` and `SESSION_SECRET` are already configured.

## Environment Variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Auto-set by Replit PostgreSQL |
| `SESSION_SECRET` | Yes | Set in Replit Secrets |
| `PORT` | Yes | Auto-set per artifact |
| `BASE_PATH` | Yes | Auto-set per artifact |

## Database

Schema is managed with Drizzle Kit. To push schema changes:

```bash
pnpm --filter @workspace/db run push
```

## Admin Account

- **Email**: admin@hiqain.com
- **Password**: password
- **Role**: admin

## Sample Data

Pre-seeded with 5 companies, 5 contacts, 5 leads, 5 deals, and 5 tasks across various pipeline stages.

## User Preferences

- Keep the existing monorepo structure (artifacts/ + lib/)
- Use pnpm workspace commands (`pnpm --filter <package>`)
- Drizzle ORM for all database access — no raw SQL in application code
