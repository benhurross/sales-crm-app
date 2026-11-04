# PLAN -- AP Plus Sales CRM

> Insurance brokerage sales lead management, target tracking and reporting.
> Migrated from the legacy "Sales Lead Mastersheet" Excel workbook.

---

## Architecture decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Next.js 16, client-side rendering, App Router | Matches AP IT System App; CSR per AGENTS.md |
| Styling | Tailwind CSS 4, shadcn/ui, Radix UI | Same as AP IT System App; glass/mesh brand theme |
| Fonts | IBM Plex Sans + IBM Plex Sans Arabic | AP Plus brand; same `--font-plex` / `--font-plex-arabic` variables |
| Database | PostgreSQL 18 via Docker on port 5435 | Per AGENTS.md; isolated container |
| ORM | Drizzle ORM | Matches AP IT System App; migrations in `drizzle/` |
| Auth | better-auth with credential provider | Simple username/password; same lib as IT System App |
| State | TanStack Query + TanStack Table | Server-state caching, advanced table features |
| Forms | react-hook-form + Zod 4 | Same stack as IT System App |
| Charts | Recharts 3 | Same as IT System App; uses AP Plus chart palette |
| Icons | lucide-react | Consistent with IT System App |
| Currency | Saudi Riyal sign (U+20C1) via `@emran-alhaddad/saudi-riyal-font` | Per AGENTS.md |
| Exports | ExcelJS (Excel), playwright-core (PDF) | Per AGENTS.md; AP Plus letterhead |
| Testing | Vitest (unit), Playwright (e2e) | Per AGENTS.md |
| Layout | Compact topbar + collapsible sidebar | Maximizes working area per AGENTS.md |

### Pinned versions

| Package | Version |
|---|---|
| next | ^16.3 |
| react / react-dom | ^19.3 |
| tailwindcss | ^4.3 |
| drizzle-orm | ^0.45 |
| better-auth | ^1.7 |
| zod | ^4.6 |
| typescript | ~6.0 |
| vitest | ^5.0 |
| @playwright/test | ^1.63 |

---

## Data model (from Sales Lead Mastersheet)

### Entities derived from the workbook

**Lead** (Main Data sheet -- 2,470 rows)
The core entity. Each row is a sales lead/prospect:
- `producer` -- the salesperson working the lead
- `prospect_name` -- company/client name
- `start_working_date` -- when the lead was submitted
- `rfq_type` -- "New" | "Renewal"
- `cob` -- Class of Business: "General" | "Medical" | "Motor"
- `bor` -- Broker of Record received (boolean)
- `quoted` -- quote issued (boolean)
- `status` -- "Secured" | "Pending" | "Lost"
- `estimated_premium` -- expected gross written premium (SAR)
- `commission` -- expected commission amount
- `current_insurer` -- existing insurance company
- `city` -- "Jeddah" | "Riyadh" | etc.
- `bor_timestamp` / `quote_timestamp` -- date tracking for BOR/quote milestones
- `month` / `year` -- period tracking
- `comments` -- free text notes

**Producer** (Targets sheet + Salesman Target sheet)
Sales team members:
- `code` -- e.g. "J-2", "R-1" (region prefix + number)
- `name` -- full name
- `employment_status` -- "Active" | "Resigned" | "Transferred"
- `region` -- "Jeddah" | "Riyadh"
- `title` -- job title (e.g. "Business Development Officer", "Unit Manager")
- `annual_target` -- yearly premium target (SAR)
- `join_date` -- date of joining

**Insurance Company** (Current Insurer column)
Lookup table: Tawuniya, Bupa, GIG, Medgulf, Liva, Wataniya, etc.

**Prospect Client** (Prospect Clients sheet -- 3,300 rows)
Client pipeline tracking:
- `producer_name`, `client_name`, `premiums`, `month`, `current_insurer`, `lob`, `month_number`

### Dashboard KPIs (from Dashboard sheet)
- Total leads, secured, pending, lost counts
- Success rate and weighted success rate
- Premium totals by status (secured / pending / lost)
- Charts: by RFQ type, by city, by business type, by month, by quarter
- Target achievement per producer (bar chart)
- Producer performance leaderboard

---

## RBAC + Data-level access control

### Roles

| Role | Permissions |
|---|---|
| **Admin** | Full CRUD on all data; manage users, targets, lookups; view all reports; export |
| **Manager** | View all leads; edit own team's leads; set targets; view all reports; export |
| **Salesman** | CRUD own leads only; view own targets and reports; export own data |

### Data-level filtering
- Every lead is owned by a `producer_id` (foreign key to `users`)
- API routes enforce: salesmen see only rows where `producer_id = currentUser.id`
- Managers see rows where `producer_id` is in their team
- Admins see all rows
- This is attribute-based access layered on top of RBAC

---

## Phases

### Phase 0 -- Project scaffolding
- [x] Initialize Next.js 16 project with TypeScript
- [x] Configure Tailwind CSS 4 with AP Plus brand theme (copy `globals.css` from IT System App)
- [x] Copy brand assets (logos, fonts) from IT System App
- [x] Set up shadcn/ui components
- [x] Configure ESLint, Prettier
- [x] Create `.gitignore`, `.env.example`, `docker-compose.yml`
- [x] Set up Drizzle ORM with PostgreSQL
- [x] Create `npm run` scripts matching AGENTS.md spec
- [x] Initialize git repository

**Success criteria:** `npm run dev` starts on port 3400; `npm run db:up` starts Postgres on 5435; `npm run lint` and `npm run typecheck` pass.

### Phase 1 -- Database schema and auth
- [x] Design and create Drizzle schema: `users`, `producers`, `leads`, `insurance_companies`, `prospect_clients`, `targets`, `audit_log`
- [x] Generate and run migrations
- [x] Set up better-auth with credential provider
- [x] Create sign-in page
- [x] Implement RBAC middleware (admin / manager / salesman roles)
- [x] Create admin user seed script
- [x] Write unit tests for auth and RBAC logic

**Success criteria:** Users can sign in; role-based route protection works; `npm run test` passes for auth tests.

### Phase 2 -- App layout and navigation
- [x] Build app shell: collapsible sidebar + topbar (maximize working area)
- [x] Copy and adapt mesh background, glass card styling from IT System App
- [x] Implement dark/light theme toggle
- [x] Build navigation: Dashboard, Leads, Targets, Reports, Prospects, Settings
- [x] Create `PageHeader` component
- [x] Create responsive layout (mobile sidebar as sheet)
- [x] Create `format.ts` with Saudi Riyal sign (U+20C1), number/date formatters

**Success criteria:** Navigation works; theme toggle works; layout is responsive; glass/mesh theme matches IT System App.

### Phase 3 -- Leads module (core CRUD)
- [x] API routes: `GET /api/leads` (list with filters, pagination, sorting), `POST /api/leads`, `GET /api/leads/[id]`, `PUT /api/leads/[id]`, `DELETE /api/leads/[id]`
- [x] Data-level access control on all lead endpoints
- [x] Leads list page with TanStack Table: fixed headers, column sorting, filtering, pagination
- [x] Inline status badges (Secured=green, Pending=amber, Lost=red)
- [x] Lead detail/edit form with validation (react-hook-form + Zod)
- [x] Create new lead form
- [ ] Bulk status update
- [x] Search and multi-column filters (producer, status, COB, RFQ type, city, date range)
- [x] Salesmen management page (producers list with CRUD)
- [x] Unit tests for lead CRUD API logic

**Success criteria:** Full CRUD on leads works with role-based data filtering; table has fixed headers and matches styling spec; all form validations pass; unit tests pass.

### Phase 4 -- Targets module
- [x] API routes: `GET /api/targets` (with secured premium aggregation), `PUT /api/targets/[id]`
- [x] Targets management page (admin/manager only)
- [x] Set annual and monthly targets per producer (inline edit)
- [x] Target vs. actual achievement calculation
- [x] Achievement percentage display with color-coded progress bars
- [x] Producer leaderboard table (ranked by secured premium, top 10 with medals)
- [x] Unit tests for target calculations (`achievementPct`, `achievementColor`, `progressColor`, `rankBySecured`)

**Success criteria:** Targets can be set and edited; achievement calculations are correct; leaderboard sorts properly.

### Phase 5 -- Dashboard
- [x] Summary KPI stat cards: total leads, secured count, pending count, lost count, total premium, success rate
- [x] Premium breakdown by status (secured / pending / lost totals)
- [x] Charts (Recharts):
  - Leads by RFQ type (New vs Renewal) -- pie/donut
  - Leads by COB (General / Medical / Motor) -- pie/donut
  - Leads by city -- bar chart
  - Monthly lead trend -- line chart
  - Quarterly performance -- grouped bar chart
  - Target vs. secured per producer -- horizontal bar chart
  - Producer leaderboard -- ranked table
- [x] Date range and producer filters on dashboard
- [x] Dashboard respects RBAC (salesman sees own data only)
- [x] Unit tests for dashboard aggregation logic

**Success criteria:** Dashboard loads with correct aggregations; all charts render; filters work; data matches mastersheet totals for test data.

### Phase 6 -- Prospect clients module
- [x] API routes for prospect clients CRUD
- [x] Prospect clients list page with table
- [x] Link prospects to leads (via producerId + currentInsurerId foreign keys)
- [x] Unit tests

**Success criteria:** Prospect clients can be managed; data links correctly to leads.

### Phase 7 -- Reports and exports
- [x] Sales report page: monthly producer activity, BOR, premium, secured, target, result, achievement %
- [x] Filterable by date range, producer, status
- [x] Excel export with ExcelJS (AP Plus letterhead template)
- [x] PDF export via playwright-core / Chromium
- [x] Create export templates in `src/server/exports/`
- [x] Unit tests for report calculations

**Success criteria:** Reports match the "Sales Report" sheet structure from the mastersheet; Excel and PDF exports generate correctly with AP Plus branding.

### Phase 8 -- Data migration (ETL)
- [x] Create `scripts/etl.ts` to import from Sales Lead Mastersheet.xlsx + SupportingFiles/
- [x] Parse and normalize all sheets: Main Data, Targets, Salesman Target, Prospect Clients
- [x] Read individual AP Sales files from SupportingFiles (primary lead source)
- [x] Map columns to database schema
- [x] Handle data quality: missing values, date format normalization, boolean parsing, insurer name normalization, fuzzy producer name matching
- [x] Create user accounts from SalesmenList.xlsx (9 salesmen + 1 admin)
- [x] Validate imported data with counts and status breakdown
- [x] Unit tests for ETL helper functions (29 tests)

**Success criteria:** 583 leads (from 8 AP Sales files + mastersheet cached values), 22 producers with targets, 3,300 prospect clients, 23 insurance companies imported; 10 user accounts created; all data normalized and linked.

### Phase 9 -- Settings and admin
- [x] User management page (admin only): create, edit, deactivate users
- [x] Lookup tables management: insurance companies
- [x] Password change
- [ ] Audit log viewer (deferred to Phase 11)

**Success criteria:** Admin can manage users and lookups via settings pages; all roles can change their own password; 120 unit tests pass; lint, typecheck, and build clean.

### Phase 10 -- Integration testing (Playwright e2e)
- [ ] Set up Playwright config for port 3500
- [ ] Auth flow tests: sign in, sign out, role-based redirects
- [ ] Leads CRUD e2e: create, edit, delete, filter, sort
- [ ] Dashboard rendering and chart interaction tests
- [ ] Targets management e2e
- [ ] Report generation and export download tests
- [ ] RBAC e2e: verify salesman cannot see other salesmen's data
- [ ] Responsive layout tests (mobile, tablet, desktop)
- [ ] Accessibility checks with axe-core

**Success criteria:** All e2e tests pass; `npm run e2e` exits 0; no accessibility violations at AA level.

### Phase 11 -- Polish and release
- [ ] Run full quality gate: `lint`, `typecheck`, `test`, `build`, `e2e`
- [ ] Performance check: dashboard loads under 2s, table pagination is smooth
- [ ] Fix any defects from e2e
- [ ] Minimal README.md
- [ ] Final data seed from mastersheet
- [ ] Server running on port 3400 (dev) / 3500 (e2e)

**Success criteria:** All quality gates pass; the MVP is usable end-to-end with real data; dev server is running.

---

## File structure

```
SalesAppCRM/
  .env.example
  .env.local
  .gitignore
  docker-compose.yml
  package.json
  tsconfig.json
  postcss.config.mjs
  next.config.ts
  drizzle.config.ts
  vitest.config.ts
  playwright.config.ts
  drizzle/                    # Generated migrations
  scripts/
    migrate.ts
    seed.ts
    seed-demo.ts
    etl.ts                    # Import from Sales Lead Mastersheet
    create-admin.ts
    set-password.ts
  public/
    brand/                    # AP Plus logos (copied from IT System App)
  src/
    app/
      globals.css             # AP Plus theme (from IT System App)
      fonts.ts
      layout.tsx
      (auth)/
        sign-in/page.tsx
      (app)/
        layout.tsx            # App shell with sidebar
        page.tsx              # Dashboard (home)
        leads/
          page.tsx            # Leads list
          [id]/page.tsx       # Lead detail
          new/page.tsx        # New lead form
        targets/page.tsx
        reports/page.tsx
        prospects/page.tsx
        settings/
          page.tsx
          users/page.tsx
      api/
        auth/[...all]/route.ts
        leads/route.ts
        leads/[id]/route.ts
        targets/route.ts
        targets/[id]/route.ts
        reports/route.ts
        reports/export/route.ts
        prospects/route.ts
        prospects/[id]/route.ts
        settings/
          users/route.ts
          lookups/route.ts
    components/
      app-shell/
        app-shell.tsx
        app-sidebar.tsx
        topbar.tsx
        mesh-background.tsx
      ui/                     # shadcn/ui components
      leads/
        leads-table.tsx
        lead-form.tsx
        lead-filters.tsx
        status-badge.tsx
      targets/
        targets-table.tsx
        target-form.tsx
        achievement-bar.tsx
      dashboard/
        stat-cards.tsx
        charts/
          leads-by-type.tsx
          leads-by-cob.tsx
          leads-by-city.tsx
          monthly-trend.tsx
          quarterly-performance.tsx
          producer-targets.tsx
      reports/
        sales-report-table.tsx
        export-button.tsx
      page-header.tsx
      stat-card.tsx
      empty-state.tsx
    server/
      db/
        index.ts              # Drizzle client
        schema.ts             # All table definitions
      services/
        leads.ts
        targets.ts
        reports.ts
        prospects.ts
        users.ts
        lookups.ts
      exports/
        letterhead.ts         # AP Plus letterhead template
        excel.ts
        pdf.ts
      auth.ts                 # better-auth config
      rbac.ts                 # Role + data-level access logic
    lib/
      format.ts               # Riyal sign, number/date formatting
      auth-client.ts
      api.ts                  # Fetch wrapper
      constants.ts            # Enums: status, COB, RFQ type, cities
    hooks/
      use-leads.ts
      use-targets.ts
      use-dashboard.ts
    __tests__/
      server/
        leads.test.ts
        targets.test.ts
        rbac.test.ts
        reports.test.ts
      components/
        leads-table.test.tsx
        dashboard.test.tsx
    e2e/
      auth.spec.ts
      leads.spec.ts
      dashboard.spec.ts
      targets.spec.ts
      reports.spec.ts
      rbac.spec.ts
```
