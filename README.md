# Net2app — SMS & VoIP Gateway Platform

A full-featured SMS gateway platform. Supports SMPP, HTTP suppliers, Kannel, MariaDB, real-time billing, and fully standalone self-hosted deployment.

---

## 🚀 Standalone Deployment (NO Base44 / NO Cloud)

Deploy a completely self-hosted instance on any Debian 12 server.

### One-Line Deploy
```bash
bash <(curl -s https://raw.githubusercontent.com/eliasewu/net2app.com/main/standalone-deploy.sh)
```

### What Gets Installed
| Component | Details |
|---|---|
| **MariaDB** | users, clients, suppliers, routes, rates, sms_log, billing, invoices, alerts, settings |
| **Kannel** | bearerbox + smsbox — SMPP SMS gateway |
| **Node.js 20 + express@4** | API server on port 5000 (express@4 pinned — avoids path-to-regexp v8 crash) |
| **Nginx** | SPA dashboard + /api/ reverse proxy |
| **PM2** | Process manager with auto-restart + startup |
| **UFW** | 22,80,443,5000 open; 3306,13000 localhost only |
| **Fail2Ban** | SSH brute force protection |

### Access After Deploy
```
Dashboard:  http://SERVER_IP/
API:        http://SERVER_IP:5000
Health:     http://SERVER_IP/health   (no auth)
Login:      admin@net2app.local / Admin@2025!
```

### API Authentication
```bash
# Get JWT token
curl -s -X POST http://SERVER_IP:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@net2app.local","password":"Admin@2025!"}'

# Use token
curl -H "Authorization: Bearer YOUR_TOKEN" http://SERVER_IP:5000/api/clients
```

### Key API Endpoints
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | Open | Login → JWT |
| GET | `/health` | Open | Health check |
| GET | `/api/dashboard` | JWT | Stats + recent logs |
| CRUD | `/api/clients` | JWT | Client management |
| CRUD | `/api/suppliers` | JWT | Supplier management |
| CRUD | `/api/routes` | JWT | Route management |
| CRUD | `/api/rates` | JWT | Rate cards |
| GET | `/api/sms-logs` | JWT | SMS logs (filterable, paginated) |
| POST | `/api/send` | JWT | Send SMS via SMPP or HTTP |
| GET/POST | `/api/dlr` | Open | DLR callback (Kannel → API) |
| GET | `/api/kannel/status` | JWT | Kannel status |
| POST | `/api/kannel/sync` | JWT | Regenerate kannel.conf from DB |
| POST | `/api/smpp/test` | JWT | TCP connect test |
| GET | `/api/billing/summary` | JWT | Billing summary |
| GET | `/api/reports/traffic` | JWT | Traffic by day/hour |

### Kannel Auto-Sync
```bash
bash /opt/net2app-api/gen-kannel-conf.sh
```
Reads active SMPP suppliers + clients from MariaDB and reloads Kannel (zero downtime).

---

## 🔧 Troubleshooting

### `PathError: Missing parameter name at index 1: *` (API crash)
Fixed in v2.1 — express@4 pinned, SPA fallback uses `app.use()` not `app.get('*')`:
```bash
cd /opt/net2app-api
npm install express@4 mysql2 cors dotenv jsonwebtoken node-cron
pm2 restart net2app-api && pm2 logs net2app-api --lines 20
```

### MariaDB trigger error `LEAVE begin`
Fixed in v2.1 — uses labeled block `trig_block: BEGIN ... LEAVE trig_block`. Re-run STEP 4.

### Kannel not starting
```bash
systemctl restart kannel-bearerbox && sleep 8 && systemctl restart kannel-smsbox
journalctl -u kannel-bearerbox -n 30
```

### Check all services
```bash
systemctl status nginx mariadb kannel-bearerbox kannel-smsbox
pm2 list
curl -s http://127.0.0.1:5000/health
```

### Re-create admin user
```bash
HASH=$(echo -n 'Admin@2025!' | sha256sum | awk '{print $1}')
mysql -u net2app -p'Ariya2015@db' net2app -e \
  "INSERT INTO users (id,name,email,password_hash,role,status) \
   VALUES (UUID(),'Admin','admin@net2app.local','$HASH','admin','active') \
   ON DUPLICATE KEY UPDATE password_hash='$HASH';"
```

---

## 📋 Changelog

### v2.1 (2026-05-02)
- ✅ **Fixed**: `PathError: Missing parameter name at index 1: *` — pinned `express@4`, replaced `app.get('*')` with `app.use()`
- ✅ **Fixed**: MariaDB trigger `LEAVE begin` — use `trig_block: BEGIN ... LEAVE trig_block`
- ✅ **Fixed**: Kannel startup timing — 8s bearerbox wait, 6s smsbox, with retry
- ✅ **Removed**: unused `bcryptjs`, `multer` packages

### v2.0
- Initial standalone release — NO Base44 dependency
- JWT auth, full CRUD API (30+ endpoints), Kannel, MariaDB real-time billing triggers

---

## 🏗 Architecture

```
Browser → Nginx:80 → React SPA (/var/www/net2app)
                   → /api/* proxy → Express@4:5000
                                        → MariaDB
                                        → Kannel:13013 (send SMS)
Kannel bearerbox:13001 → SMPP suppliers (outbound)
Kannel smsbox → server.js:5000/api/dlr (DLR callbacks, no auth)
```

---

## 📄 License
Proprietary — Tri Angle Trade Centre FZE LLC
