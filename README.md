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
# copy the project into /opt/sales-crm (without node_modules and .next), then as salescrm:
cp .env.example .env.local   # set BETTER_AUTH_SECRET
npm ci
npm run db:up
npm run db:migrate
npm run build
npm run admin:create -- <email> "Full Name"   # prints a one-time password
```

Run it as a service and open the port:

```bash
sudo cp deploy/sales-crm.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now sales-crm
sudo firewall-cmd --permanent --add-port=3600/tcp && sudo firewall-cmd --reload
```

The app is then at `http://<server-ip>:3600`. Logs: `journalctl -u sales-crm -f`.
