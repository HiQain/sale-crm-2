# NexusCRM

A full-stack CRM application for lead management, client journeys, and billing tracking with role-based access control.

## Stack

- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui (`artifacts/crm`)
- **Backend**: Express API server (`artifacts/api-server`)
- **Database**: PostgreSQL via Replit's built-in database, Drizzle ORM (`lib/db`)
- **Auth**: Session-based (cookie), bcrypt password hashing

## How to run

All workflows are managed by Replit. The three services start automatically:

| Service | Workflow | Port |
|---------|----------|------|
| CRM frontend | `artifacts/crm: web` | 22444 |
| API server | `artifacts/api-server: API Server` | 8080 |
| Mockup sandbox | `artifacts/mockup-sandbox: Component Preview Server` | auto |

The preview proxy routes `/api/*` to the API server and everything else to the CRM frontend.

## Seeding the database

```bash
npm run seed --workspace=@workspace/scripts
```

This creates the admin user, sample leads, companies, contacts, deals, tasks, client journeys, and billings.

## Admin credentials

- **Email**: admin@hiqain.com
- **Password**: set via `npm run seed --workspace=@workspace/scripts` (dev default - change before deploying)

## Project structure

```text
artifacts/
  crm/            - React frontend
  api-server/     - Express REST API
  mockup-sandbox/ - Design/component preview tool
lib/
  db/               - Drizzle schema + migrations
  api-client-react/ - Generated React Query hooks
  api-spec/         - OpenAPI spec + orval codegen config
  api-zod/          - Generated Zod validators
scripts/
  src/seed/         - Database seed script
```

## Modules

- **Leads** (`/admin/leads`) - Lead pipeline with custom columns
- **Client Journeys** (`/admin/client-journeys`) - Client lifecycle tracking
- **Billings** (`/admin/billings`) - Invoice and payment records
- **Users** (`/admin/users`) - User management (admin only)

## User preferences

- Use `npm` for package management
- Keep the existing project structure
