# APPLUS IBS

An insurance brokerage system for AP Plus, built on data migrated from the legacy ERP. The implementation plan, decisions and phase checklists are in `PLAN.md`.

## Business requirements

- Create a separate module only for Sales App similar to 'Claude Cowork/ERP DB'
- Role-based access control (RBAC) combined with attribute-based / data-level access control.
- Refer to the file "Sales Lead Mastersheet" to get an idea and add to the existing Sales CRM Module in the applus-ibs.

## Technical details

- A modern Next.js app, client-side rendered, with a backend and a database; data persists.
- Use popular libraries, a modern and elegant UI, and tried and tested UI/UX patterns.
- Apply the Core UI/UX Principles
- Make sure that tables have the same styles, with fixed header at top when scrolled.

## Styling

- Use the same CSS styling, theme, fonts and images as the "Claude Cowork\AP IT System App" project.
- Create different App layout, which maximizes working area space usage.
- That project is separate. Copy what is needed into this project; never reference files across projects. The two may be integrated later.

## Strategy

1. Write the plan with success criteria for each phase, to be checked off. Include project scaffolding (with `.gitignore`) and rigorous unit testing.
2. Execute the plan, ensuring all criteria are met.
3. Carry out extensive integration testing with Playwright, fixing defects.
4. Only complete when the MVP is finished and tested, with the server running and ready for the user.

## Coding standards

1. Use the latest versions of libraries and idiomatic approaches as of today.
2. Keep it simple. Never over-engineer, always simplify, no unnecessary defensive programming.
3. Be concise. Keep the README minimal. Never use emojis.

## Environment

- Node v24. Scripts and the ETL run with `tsx`.
- Next.js 16 app at the project root. Dev server on 3400 (`npm run dev`); the end-to-end server on 3500; production on 3600 (`npm start`, RHEL steps in `README.md`).
- PostgreSQL 18 in this project's own Docker container on port 5435 (`npm run db:up`). Drizzle ORM, with migrations in `drizzle/`.
- Settings are in `.env.local` (template: `.env.example`).
- Report exports: Excel with ExcelJS, PDF printed by Chromium through `playwright-core` (`npx playwright install chromium`), both on the AP Plus letterhead in `src/server/exports/`.
- Amounts show the Saudi Riyal sign (U+20C1, `RIYAL` in `src/lib/format.ts`), never "SAR". The font `@emran-alhaddad/saudi-riyal-font` draws it in the app and in PDFs.
- Before release work, run `lint`, `typecheck`, `test`, `build` and `e2e`. Versions and pins are recorded in `PLAN.md`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
