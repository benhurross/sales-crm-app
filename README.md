# Sales CRM

AP Plus insurance brokerage sales lead management system.

## Setup

```bash
npm install
npm run db:up       # start PostgreSQL on port 5435
npm run db:migrate  # run migrations
npm run dev         # start dev server on port 3400
```

## Deploy on RHEL

Production runs on port 3600 (`npm start`). Needs Node 24 and Docker or Podman (with compose) on the server.

```bash
sudo useradd --system --create-home salescrm
sudo mkdir -p /opt/sales-crm && sudo chown salescrm: /opt/sales-crm
# clone the repo into /opt/sales-crm, then as salescrm:
cp .env.example .env.local   # set BETTER_AUTH_SECRET
npm ci
npm run db:up
npm run db:migrate           # creates empty tables only
npm run build
```

Load the data. The workbooks are not in git (they hold company data), so copy `Sales Lead Mastersheet.xlsx` and the `SupportingFiles/` folder into `/opt/sales-crm` first:

```bash
npm run etl                  # imports leads, prospects, producers, insurers and user accounts
npm run db:link              # links prospects to their leads
```

`etl` wipes the database first, including users and passwords, so run it once at setup, not on a live system.

Run it as a service and open the port:

```bash
sudo cp deploy/sales-crm.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now sales-crm
sudo firewall-cmd --permanent --add-port=3600/tcp && sudo firewall-cmd --reload
```

The app is then at `http://<server-ip>:3600`. Logs: `journalctl -u sales-crm -f`.
