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

Users open port 3600, served by Apache (httpd), which compresses responses and passes them to the app on `127.0.0.1:3601` (`npm start`). Needs Node 24, httpd, and Docker or Podman (with compose) on the server, plus Chromium's libraries for PDF exports:

```bash
sudo dnf install -y nss atk at-spi2-atk cups-libs libdrm libxkbcommon libXcomposite libXdamage libXfixes libXrandr mesa-libgbm pango cairo alsa-lib
```

```bash
sudo useradd --system --create-home salescrm
sudo mkdir -p /opt/sales-crm && sudo chown salescrm: /opt/sales-crm
# clone the repo into /opt/sales-crm, then as salescrm:
cp .env.example .env.local   # set BETTER_AUTH_SECRET
npm ci
npx playwright install chromium   # used for PDF exports
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

Run it as a service:

```bash
sudo cp deploy/sales-crm.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now sales-crm
```

Put Apache in front on port 3600 (SELinux must allow httpd to listen on 3600 and to connect to the app):

```bash
sudo cp deploy/httpd-sales-crm.conf /etc/httpd/conf.d/sales-crm.conf
sudo semanage port -a -t http_port_t -p tcp 3600    # use -m if it says "already defined"
sudo setsebool -P httpd_can_network_connect 1
sudo apachectl configtest
sudo systemctl enable httpd && sudo systemctl restart httpd
sudo firewall-cmd --permanent --add-port=3600/tcp && sudo firewall-cmd --reload
```

The app is then at `http://<server-ip>:3600`. Logs: `journalctl -u sales-crm -f` and `/var/log/httpd/error_log`.
