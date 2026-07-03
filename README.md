# HRIS System – Web App

Human Resource Information System (internship project). Built with **Next.js**, **shadcn/ui**, and **tweakcn**-friendly theme. Backend (Spring Boot) and mobile (Android) to follow.

## Roles (no Payroll)

- **HR Admin** – full access, user/role management, audit logs  
- **HR Staff** – manage employee records, create/process requests  
- **Manager** – approve requests for their team, view team info  
- **Employee** – view own profile, submit requests  

## Tech stack

- **Frontend:** Next.js 16 (App Router), TypeScript, Tailwind v4, shadcn-style UI (Button, Card, Table, Tabs, Dialog, Badge, Input, Label)
- **Theme:** CSS variables in `src/app/globals.css` (neutral + corporate blue), ready for tweakcn
- **Data:** Mock data in `src/lib/mock.ts` (replace with API later); Supabase (Postgres) tables in `supabase/migrations/`, client in `src/lib/supabase`.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You’ll see the dashboard. Use **Sign out** to go to the login page (`/auth/login`). Login is UI-only for now (any email/password).

## Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard – Total Employees, Pending Requests, Departments |
| `/employees` | Employee list with search, “Add Employee” dialog |
| `/employees/[id]` | Employee profile – Personal, Employment, Job History (effective-dated) |
| `/departments` | Departments and managers |
| `/leave` | Leave management – requests (workflow) and balances by type |
| `/requests` | My Requests / To Approve (workflow placeholders) |
| `/audit` | Audit log (HR Admin; wire to API later) |
| `/auth/login` | Login (wire to Spring Boot auth later) |

## Next steps

1. **Backend:** Spring Boot REST API + Supabase (Postgres). Implement auth, RBAC, effective-dated employee/job/comp history, workflow_requests, audit_logs.
2. **Wire frontend:** Replace `src/lib/mock.ts` with `fetch`/API client to your backend.
3. **Auth:** Protect `(dashboard)` routes; use token from login; optional Supabase Auth or Spring Security.
4. **Mobile:** Reuse same API from Android Studio.

## Supabase setup

Project name in Supabase: **human-resource-information-system**.

1. Create a project at [supabase.com](https://supabase.com) (or use your existing **human-resource-information-system** project).
2. Copy `.env.local.example` to `.env.local` and set:
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL (Settings → API)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon public key (Settings → API)
3. Create tables: in Supabase Dashboard go to **SQL Editor**, open `supabase/migrations/20250302000000_create_hris_tables.sql`, and run it. Or use Supabase CLI: `npx supabase link` then `npx supabase db push`.
4. Tables: `departments`, `employees`, `job_history`, `leave_requests`, `leave_balances`, `workflow_requests`, `attendance`, `audit_logs`. Revise the migration later if needed.
5. In app: `import { supabase } from "@/lib/supabase";` then e.g. `supabase.from("employees").select("*")`.
6. **SSO handoff (Recruitment → HRIS):** Run migration `20260418120000_sso_handoff_tickets_and_audit.sql`. Recruitment inserts into `sso_handoff_tickets` (SHA-256 of raw ticket as `secret_hash`, `user_id`, `expires_at`). Users are sent to `/auth/consume?ticket=…&next=…`. Server needs `SUPABASE_SERVICE_ROLE_KEY`.
7. **Cross-app URLs (optional):** `NEXT_PUBLIC_RECRUITMENT_URL` (no trailing slash), `NEXT_PUBLIC_RECRUITMENT_ENTRY_PATH` (default `/dashboard`), `NEXT_PUBLIC_HRIS_URL` (used when generating magic-link `redirectTo`). For local dev, HRIS origin can be inferred from the request if `NEXT_PUBLIC_HRIS_URL` is unset.
8. **SSO fallback:** If GoTrue redirect allowlists block magic-link returns, set `NEXT_PUBLIC_SSO_MAGICLINK_FALLBACK=true` to use in-app `verifyOtp` instead (dev only; see `src/lib/auth/ssoSessionStrategy.ts`).

## Project structure

```
src/
├── app/
│   ├── (dashboard)/          # Protected area (sidebar + topbar)
│   │   ├── layout.tsx
│   │   ├── page.tsx          # Dashboard
│   │   ├── employees/
│   │   ├── departments/
│   │   ├── requests/
│   │   └── audit/
│   ├── auth/login/
│   ├── globals.css           # Theme (tweakcn/shadcn vars)
│   └── layout.tsx
├── components/
│   ├── layout/               # Sidebar, Topbar
│   └── ui/                   # Button, Card, Table, Tabs, Dialog, etc.
└── lib/
    ├── utils.ts              # cn()
    └── mock.ts               # Replace with API
```
