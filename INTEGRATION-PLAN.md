# Sales CRM and AP IT System integration plan

**Status: on hold (2026-11-18).** Resume once both apps are served over HTTPS with an internal certificate.

Goal: the AP IT System (IT) manages accounts and access for the Sales CRM (CRM), shares its tools with the CRM through a menu that IT switches on and off, and receives IT tickets raised from inside the CRM.

The two projects stay separate. They talk only over HTTP, configured by environment settings; neither imports the other's code.

## What the review found

| Area | AP IT System | Effect on the plan |
|---|---|---|
| Stack | Next.js 16, better-auth 1.7 (admin plugin), Drizzle, PostgreSQL. Port 3200 on 192.168.0.119 | Same stack as the CRM. better-auth can be an OpenID Connect provider (IT) and client (CRM), so no new auth product is needed |
| Accounts | Admins create accounts in Settings (no self sign-up). Roles: `admin`, `it_staff`, `employee`. A user links to an `employees` record (name, email, department, location) | Every salesman already needs an IT account to raise tickets. CRM access is added as a per-app role on that account |
| API keys | `api_tokens` with scopes (`kpis`, `workstation`): hashed, revocable, last use noted, under Settings > API access | Add one scope, `integration`, for the CRM's server-to-server calls. Same pattern, no new mechanism |
| Tickets | `POST /api/tickets` for signed-in users. The requester is an employee. Types `incident` and `request`, with issue type, location and channel lookups. SLA due dates and emails are already handled | Add an integration endpoint that opens a ticket for an employee by email, with channel `sales-crm` |
| Tools | PDF toolkit (merge, split, organize, compress, fill, sign, to Word, images to PDF, stamp). Each tool is on, behind approval, or off, with department blocks and per-person exceptions. **They run in the browser: files are never uploaded** | These are pages, not server APIs. The CRM links to them, and IT's existing on/approval/off settings decide who sees them. There is no PowerPoint tool yet |
| Same host | Both apps run on 192.168.0.119 (ports 3200 and 3600) with better-auth's default cookie name | **Existing defect:** browsers don't separate cookies by port, so signing in to one app can sign the user out of the other. Phase 0 fixes this |

## Phase 0: Separate the session cookies (both apps)

- Set `advanced.cookiePrefix` in each app's `auth.ts`: `ap-it` in IT, `sales-crm` in the CRM. Update any code that reads the cookie by name. In the CRM that is `src/proxy.ts`.
- Everyone is signed out once when this is deployed.

Success criteria
- [ ] Signed in to both apps in one browser, signing in or out of one leaves the other untouched (Playwright test in each app)

## Phase 1: Single sign-on, with IT managing access

IT system
- Add better-auth's OpenID Connect provider plugin. Check the installed better-auth docs for the current plugin name before writing code.
- Register the CRM as a client. Redirect URI: `http://192.168.0.119:3600/api/auth/oauth2/callback/ap-it`.
- New table `app_access` (`userId`, `app`, `role`). For the CRM the roles are `salesman`, `manager` and `admin`.
- In Settings > Users, add a **Sales CRM access** field per user: none, salesman, manager or admin.
- Put an `apps` claim in the ID token and userinfo, for example `{ "sales-crm": "manager" }`. Banned users and users without access get no claim.

Sales CRM
- Add better-auth's generic OAuth plugin with provider `ap-it`, using the discovery URL and client ID and secret from `.env.local` (`IT_SYSTEM_URL`, `IT_OIDC_CLIENT_ID`, `IT_OIDC_CLIENT_SECRET`).
- At every sign-in, take the role from the `apps` claim and refuse sign-in when there is none. A role changed in IT applies at the user's next sign-in.
- Link existing CRM users to the IT account by email, so they keep their producer link and history. `db:repair` keeps doing the producer matching.
- Shorten sessions to 12 hours so removed access takes effect the same day.
- Sign-in page: one **Sign in with AP IT System** button.
- Keep password sign-in only for local admin accounts, as an emergency way in when IT is down (`LOCAL_LOGIN=admin`).
- Users page becomes read-only for names, emails and roles. It still sets which producer record an account belongs to.
- Script `npm run sso:check` lists CRM users with no matching IT account, so IT can create them before switching over.

Success criteria
- [ ] A user with CRM access signs in to the CRM through IT and lands with the role IT gave them
- [ ] A user without CRM access, or banned in IT, cannot sign in to the CRM
- [ ] Changing the role in IT changes it in the CRM at the next sign-in
- [ ] Existing salesmen keep seeing their own leads after switching (producer link kept)
- [ ] A local admin can still sign in with a password when IT is stopped
- [ ] Unit tests for claim-to-role mapping. Playwright test signing in through both apps

## Phase 2: Tool menu controlled from IT

IT system
- New table `app_menu` (`app`, `key`, `label_en`, `label_ar`, `icon`, `path`, `toolKey` (optional), `enabled`, `position`), edited in Settings > Tools > **Other apps**.
- `GET /api/integration/menu?app=sales-crm&email=<user>` (scope `integration`) returns the entries enabled for that app. An entry tied to a tool appears only if the tool is `allowed` for that person (the existing `toolStatus`). A tool needing approval appears with "Request access".

Sales CRM
- The sidebar gets a **Tools** section built from that response, cached for 5 minutes per user. Labels follow the CRM's language.
- Entries open the IT page (for example `/en/tools/pdf?mode=merge`) in a new tab, already signed in because of single sign-on. Pages are not embedded in a frame: it breaks cookies and IT's security headers.
- If IT doesn't answer within 2 seconds, the section is hidden and the CRM carries on.

Success criteria
- [ ] Turning an entry off in IT removes it from the CRM menu within 5 minutes, with no CRM change or restart
- [ ] A tool blocked for a person's department doesn't appear for them
- [ ] With IT stopped, the CRM loads normally without the Tools section
- [ ] Unit tests for menu filtering (IT) and caching and fallback (CRM). Playwright test toggling an entry

## Phase 3: IT tickets from the CRM

IT system (scope `integration`)
- `GET /api/integration/ticket-options`: ticket types, issue types and locations, in English and Arabic.
- `POST /api/integration/tickets` `{ requesterEmail, type, subject, description, issueType, location, context: { app, page, browser } }`.
  - The requester is found by employee email; unknown or inactive employees get a 422.
  - Channel is `sales-crm`, added to the channel lookup.
  - Priority is medium and nobody is assigned, the same as tickets employees raise themselves. SLA and emails work as now.
  - The context is appended to the description, so IT sees where the problem happened.
- `GET /api/integration/tickets?requesterEmail=` and `GET /api/integration/tickets/:id`: the requester's own tickets, with status and public replies only.
- Every call is written to the audit log as "via Sales CRM".

Sales CRM
- **Get IT help** is one of the IT-controlled menu entries (Phase 2), so IT can switch it off.
- It opens a dialog: type, issue type, subject, description. The page and browser are filled in automatically.
- **My IT tickets** page lists status and replies, with an "Open in IT System" link to the full ticket.
- The CRM sends the signed-in user's email. The API key is trusted to state it, which is acceptable on the office network.

Success criteria
- [ ] A ticket raised in the CRM appears in IT's queue with the right requester, channel `sales-crm` and SLA due date
- [ ] The requester gets IT's usual confirmation email
- [ ] My IT tickets shows status changes made in IT
- [ ] A user can only see their own tickets
- [ ] A revoked key gets 401
- [ ] Unit tests for both endpoints and the CRM form. Playwright test across both apps

## Phase 4: Shared server tools (later, when needed)

- The CRM's PDF report exports need Chromium on the server to turn HTML into PDF. IT's PDF tools work in the browser on existing PDFs, so they can't replace this.
  - Moving the exports would mean an HTML-to-PDF service in IT, with Chromium installed there instead. That moves the dependency rather than removing it.
  - Do it when a second app needs PDF reports: `POST /api/integration/render/pdf` `{ html, landscape }` returns a PDF.
- PowerPoint: build it in IT as a service, `POST /api/integration/render/pptx` `{ title, slides: [...] }` returns a .pptx. The CRM adds **Export to PowerPoint** on the dashboard, shown only while IT's menu entry for it is on.
- Excel exports stay in the CRM: ExcelJS is a small library with no system dependencies.

## Security and operations

- **HTTPS:** both apps run over plain HTTP on the office network. Single sign-on and API keys would cross it in clear text. Put both behind HTTPS with an internal certificate before Phase 1 goes live; Apache already fronts the CRM.
- **Keys:** one `integration` key per app, held in that app's `.env.local`. Keys can be revoked in IT under Settings > API access.
- **Availability:** IT becomes a dependency for sign-in. The local admin login (Phase 1) and the Tools fallback (Phase 2) keep the CRM usable when IT is down. IT's existing daily backups now protect both apps' access.
- **Deployment order:** in each phase, deploy IT first, then the CRM. The CRM features stay off until their settings are present in `.env.local`.

## Decisions needed

1. **Who sets CRM roles in IT:** IT admins only, or should sales managers also be able to grant salesman access?
2. **HTTPS:** can the server get an internal certificate before single sign-on goes live?
3. **Emergency login:** keep a local password admin in the CRM, as recommended?
