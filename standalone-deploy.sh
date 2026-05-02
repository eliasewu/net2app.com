#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
#  NET2APP — FULLY STANDALONE DEBIAN 12 DEPLOYMENT
#  ▸ NO Base44 / No Cloud dependency — 100% self-hosted
#  ▸ Everything runs on THIS server: API, Dashboard UI, DB, SMS Gateway
#  ▸ Multiple server support — each server is fully independent
#
#  ARCHITECTURE:
#  Browser → Nginx:80 → React Dashboard SPA (/var/www/net2app)
#  Dashboard → Express API :5000 (JWT auth, full CRUD, Kannel control)
#  Kannel bearerbox:13001 + smsbox → SMPP clients/suppliers
#  MariaDB → clients, suppliers, routes, sms_log, users, billing
#  PM2 → process manager
#
#  ACCESS AFTER DEPLOY:
#  Dashboard: http://SERVER_IP/
#  API:       http://SERVER_IP:5000
#  Login:     admin@net2app.local / Admin@2025!
# ═══════════════════════════════════════════════════════════════════════════

[ "$EUID" -ne 0 ] && exec sudo bash "$0" "$@"
export DEBIAN_FRONTEND=noninteractive

GREEN="\033[0;32m"; RED="\033[0;31m"; YELLOW="\033[1;33m"; BLUE="\033[0;34m"; NC="\033[0m"
ok()     { echo -e "${GREEN}[OK]${NC} $1"; }
fail()   { echo -e "${RED}[FAIL]${NC} $1"; }
info()   { echo -e "${YELLOW}[i]${NC} $1"; }
header() { echo -e "\n${BLUE}══ $1 ══${NC}\n"; }

# ── CONFIG — change these before running ─────────────────────────────────────
DB_ROOT_PASS="Ariya2015@db"
DB_APP_USER="net2app"
DB_APP_PASS="Ariya2015@db"
DB_NAME="net2app"
KANNEL_PASS="Ariya2015@k"
API_TOKEN="Net2app@API2025!"
ADMIN_USER="admin"
ADMIN_PASS="Admin@2025!"
API_DIR="/opt/net2app-api"
WEBROOT="/var/www/net2app"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║   NET2APP STANDALONE SERVER DEPLOYMENT   $(date '+%Y-%m-%d') ║"
echo "║   NO BASE44 — 100% SELF-HOSTED                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"

header "STEP 1: System Update + Base Packages"
apt-get update -y && apt-get upgrade -y
apt-get install -y build-essential git curl wget vim net-tools \
  ufw fail2ban lsb-release gnupg ca-certificates libssl-dev \
  libxml2-dev uuid-dev pkg-config nginx mariadb-server mariadb-client \
  kannel python3 unzip
npm install -g pm2 2>/dev/null || true
ok "Base packages ready"

header "STEP 2: Node.js 20 + PM2"
which node &>/dev/null || { curl -fsSL https://deb.nodesource.com/setup_20.x | bash -; apt-get install -y nodejs; }
which pm2  &>/dev/null || npm install -g pm2
ok "Node $(node -v) + PM2 ready"

header "STEP 3: MariaDB — DB + All Tables"
systemctl enable mariadb && systemctl start mariadb
sleep 2
mysql -u root -p"$DB_ROOT_PASS" -e "SELECT 1" 2>/dev/null || \
  mysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '$DB_ROOT_PASS'; FLUSH PRIVILEGES;"
mysql -u root -p"$DB_ROOT_PASS" <<ROOTSQL
CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
DROP USER IF EXISTS '$DB_APP_USER'@'localhost';
CREATE USER '$DB_APP_USER'@'localhost' IDENTIFIED BY '$DB_APP_PASS';
GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_APP_USER'@'localhost';
FLUSH PRIVILEGES;
ROOTSQL

mysql -u root -p"$DB_ROOT_PASS" $DB_NAME <<'SQLEOF'
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128), email VARCHAR(128) NOT NULL,
  password_hash VARCHAR(64) NOT NULL,
  role ENUM('admin','manager','viewer') DEFAULT 'viewer',
  status ENUM('active','inactive','blocked') DEFAULT 'active',
  created_at DATETIME DEFAULT NOW(),
  updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  UNIQUE KEY uk_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS clients (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL, contact_person VARCHAR(128), email VARCHAR(128), phone VARCHAR(32),
  connection_type ENUM('SMPP','HTTP') DEFAULT 'SMPP',
  smpp_ip VARCHAR(64), smpp_port INT DEFAULT 9096,
  smpp_username VARCHAR(64), smpp_password VARCHAR(128),
  http_url TEXT, http_method ENUM('GET','POST') DEFAULT 'POST', http_params TEXT,
  dlr_url TEXT, billing_type ENUM('send','submit','delivery') DEFAULT 'submit',
  force_dlr TINYINT(1) DEFAULT 0, force_dlr_timeout INT DEFAULT 30,
  status ENUM('active','inactive','blocked') DEFAULT 'active',
  credit_limit DECIMAL(12,4) DEFAULT 0, currency VARCHAR(8) DEFAULT 'USD',
  balance DECIMAL(12,4) DEFAULT 0, tps_limit INT DEFAULT 100,
  allowed_senders TEXT, notes TEXT,
  created_at DATETIME DEFAULT NOW(), updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  INDEX(status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS suppliers (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  category ENUM('sms','voice_otp','whatsapp','telegram','device','android') DEFAULT 'sms',
  provider_type VARCHAR(64), contact_person VARCHAR(128), email VARCHAR(128), phone VARCHAR(32),
  connection_type ENUM('HTTP','SMPP','SIP','SDK','DEVICE','ANDROID') DEFAULT 'SMPP',
  smpp_ip VARCHAR(64), smpp_port INT DEFAULT 2775,
  smpp_username VARCHAR(64), smpp_password VARCHAR(128),
  http_url TEXT, http_method ENUM('GET','POST') DEFAULT 'POST', http_params TEXT,
  api_key VARCHAR(256), api_secret VARCHAR(256), dlr_url TEXT,
  status ENUM('active','inactive','blocked') DEFAULT 'active',
  priority INT DEFAULT 1, tps_limit INT DEFAULT 100,
  total_sent BIGINT DEFAULT 0, total_delivered BIGINT DEFAULT 0, total_failed BIGINT DEFAULT 0,
  notes TEXT,
  created_at DATETIME DEFAULT NOW(), updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  INDEX(category), INDEX(status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS routes (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL, client_id VARCHAR(64), client_name VARCHAR(128),
  supplier_id VARCHAR(64), supplier_name VARCHAR(128),
  backup_supplier_id VARCHAR(64), backup_supplier_name VARCHAR(128),
  mcc VARCHAR(8), mnc VARCHAR(8), country VARCHAR(64), network VARCHAR(128), prefix VARCHAR(32),
  routing_mode ENUM('LCR','ASR','Priority','Round Robin') DEFAULT 'Priority',
  status ENUM('active','inactive','blocked') DEFAULT 'active',
  created_at DATETIME DEFAULT NOW(), updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  INDEX(mcc,mnc), INDEX(client_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rates (
  id VARCHAR(64) PRIMARY KEY,
  type ENUM('client','supplier') DEFAULT 'client',
  entity_id VARCHAR(64), entity_name VARCHAR(128),
  mcc VARCHAR(8), mnc VARCHAR(8), country VARCHAR(64), network VARCHAR(128), prefix VARCHAR(32),
  rate DECIMAL(12,6) DEFAULT 0, currency VARCHAR(8) DEFAULT 'USD',
  status ENUM('active','inactive') DEFAULT 'active',
  created_at DATETIME DEFAULT NOW(),
  INDEX(entity_id), INDEX(mcc,mnc)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sms_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  message_id VARCHAR(64), client_id VARCHAR(64), client_name VARCHAR(128),
  supplier_id VARCHAR(64), supplier_name VARCHAR(128), route_id VARCHAR(64),
  sender_id VARCHAR(32), destination VARCHAR(32),
  mcc VARCHAR(8), mnc VARCHAR(8), country VARCHAR(64), network VARCHAR(128),
  content TEXT,
  status ENUM('pending','sent','delivered','failed','rejected','blocked') DEFAULT 'pending',
  fail_reason VARCHAR(256), dest_msg_id VARCHAR(64),
  parts TINYINT DEFAULT 1, cost DECIMAL(12,6) DEFAULT 0, sell_rate DECIMAL(12,6) DEFAULT 0,
  submit_time DATETIME DEFAULT NOW(), delivery_time DATETIME,
  sms_type ENUM('transactional','promotional','otp','voice_otp') DEFAULT 'transactional',
  INDEX(destination), INDEX(client_id), INDEX(status), INDEX(submit_time), INDEX(message_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS billing_summary (
  id VARCHAR(128) PRIMARY KEY,
  client_id VARCHAR(64), period DATE,
  total_sms BIGINT DEFAULT 0, total_cost DECIMAL(14,4) DEFAULT 0,
  total_revenue DECIMAL(14,4) DEFAULT 0, margin DECIMAL(14,4) DEFAULT 0,
  updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  INDEX(client_id, period)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS invoices (
  id VARCHAR(64) PRIMARY KEY,
  client_id VARCHAR(64), client_name VARCHAR(128),
  invoice_number VARCHAR(32), period_start DATE, period_end DATE,
  total_sms BIGINT DEFAULT 0, amount DECIMAL(14,4) DEFAULT 0, currency VARCHAR(8) DEFAULT 'USD',
  status ENUM('draft','sent','paid','overdue') DEFAULT 'draft',
  notes TEXT, created_at DATETIME DEFAULT NOW(),
  INDEX(client_id), INDEX(status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS alert_rules (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128), alert_type VARCHAR(64), threshold DECIMAL(12,4),
  window_minutes INT DEFAULT 60, min_messages INT DEFAULT 10,
  notify_email VARCHAR(256), client_id VARCHAR(64), supplier_id VARCHAR(64),
  severity ENUM('info','warning','critical') DEFAULT 'warning',
  is_active TINYINT(1) DEFAULT 1, cooldown_minutes INT DEFAULT 60,
  last_triggered_at DATETIME, created_at DATETIME DEFAULT NOW()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS system_settings (
  id VARCHAR(64) PRIMARY KEY,
  setting_key VARCHAR(128) NOT NULL, setting_value TEXT,
  category VARCHAR(64) DEFAULT 'system', description TEXT,
  updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  UNIQUE KEY uk_key (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mcc_mnc (
  id INT AUTO_INCREMENT PRIMARY KEY,
  mcc VARCHAR(8), mnc VARCHAR(8), country VARCHAR(64), network VARCHAR(128),
  prefix VARCHAR(32), iso VARCHAR(8),
  UNIQUE KEY uk_mcc_mnc (mcc,mnc)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
SQLEOF
ok "MariaDB: all tables created"

header "STEP 4: Billing Triggers"
mysql -u root -p"$DB_ROOT_PASS" $DB_NAME <<'TRIGEOF'
DROP TRIGGER IF EXISTS trg_sms_billing_update;
DELIMITER $$
CREATE TRIGGER trg_sms_billing_update
AFTER UPDATE ON sms_log FOR EACH ROW
BEGIN
  DECLARE v_billing_type VARCHAR(16);
  DECLARE v_force_dlr TINYINT(1);
  DECLARE v_do_client TINYINT(1) DEFAULT 0;
  IF NEW.status = OLD.status THEN LEAVE begin; END IF;
  SELECT IFNULL(billing_type,'submit'), IFNULL(force_dlr,0)
    INTO v_billing_type, v_force_dlr FROM clients WHERE id=NEW.client_id LIMIT 1;
  CASE v_billing_type
    WHEN 'send' THEN IF NEW.status NOT IN ('blocked','pending') THEN SET v_do_client=1; END IF;
    WHEN 'submit' THEN IF NEW.status NOT IN ('failed','rejected','blocked','pending') THEN SET v_do_client=1; END IF;
    WHEN 'delivery' THEN
      IF NEW.status='delivered' THEN SET v_do_client=1; END IF;
      IF v_force_dlr=1 AND NEW.status NOT IN ('failed','rejected','blocked','pending') THEN SET v_do_client=1; END IF;
    ELSE IF NEW.status NOT IN ('failed','rejected','blocked','pending') THEN SET v_do_client=1; END IF;
  END CASE;
  IF v_do_client=1 THEN
    UPDATE clients SET balance=balance-NEW.sell_rate WHERE id=NEW.client_id;
    INSERT INTO billing_summary (id,client_id,period,total_sms,total_cost,total_revenue,margin)
    VALUES (CONCAT(NEW.client_id,'_',DATE_FORMAT(DATE(NEW.submit_time),'%Y%m%d')),
      NEW.client_id, DATE(NEW.submit_time), 1, NEW.cost, NEW.sell_rate, NEW.sell_rate-NEW.cost)
    ON DUPLICATE KEY UPDATE
      total_sms=total_sms+1, total_cost=total_cost+NEW.cost,
      total_revenue=total_revenue+NEW.sell_rate, margin=margin+(NEW.sell_rate-NEW.cost),
      updated_at=NOW();
  END IF;
END$$
DELIMITER ;
TRIGEOF
ok "Billing triggers ready"

header "STEP 5: Create Default Admin User"
ADMIN_HASH=$(echo -n "$ADMIN_PASS" | sha256sum | awk '{print $1}')
mysql -u root -p"$DB_ROOT_PASS" $DB_NAME -e "
  INSERT INTO users (id,name,email,password_hash,role,status)
  VALUES (UUID(),'Admin','${ADMIN_USER}@net2app.local','$ADMIN_HASH','admin','active')
  ON DUPLICATE KEY UPDATE password_hash='$ADMIN_HASH', role='admin', status='active';
"
ok "Admin created: ${ADMIN_USER}@net2app.local / $ADMIN_PASS"

header "STEP 6: Kannel SMS Gateway"
mkdir -p /etc/kannel /var/log/kannel
chmod 755 /var/log/kannel
cat > /etc/kannel/kannel.conf <<KANNELEOF
group = core
admin-port = 13000
admin-password = $KANNEL_PASS
status-password = $KANNEL_PASS
smsbox-port = 13001
log-file = "/var/log/kannel/bearerbox.log"
log-level = 1
box-allow-ip = 127.0.0.1
access-log = "/var/log/kannel/access.log"
unified-prefix = "+,00,011"

group = smsbox
smsbox-id = "net2app_smsbox"
bearerbox-host = 127.0.0.1
bearerbox-port = 13001
sendsms-port = 13013
sendsms-interface = 127.0.0.1
log-file = "/var/log/kannel/smsbox.log"
log-level = 1
global-sender = "NET2APP"
max-msgs-per-second = 500
dlr-url = "http://127.0.0.1:5000/api/dlr?msgid=%i&status=%d&to=%p&from=%A"
KANNELEOF

cat > /etc/systemd/system/kannel-bearerbox.service <<'EOF'
[Unit]
Description=Kannel Bearerbox
After=network.target
[Service]
Type=simple
ExecStart=/usr/sbin/bearerbox /etc/kannel/kannel.conf
Restart=always
RestartSec=5
User=root
[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/kannel-smsbox.service <<'EOF'
[Unit]
Description=Kannel Smsbox
After=kannel-bearerbox.service
Requires=kannel-bearerbox.service
[Service]
Type=simple
ExecStartPre=/bin/sleep 4
ExecStart=/usr/sbin/smsbox /etc/kannel/kannel.conf
Restart=always
RestartSec=5
User=root
[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable kannel-bearerbox kannel-smsbox
pkill -f bearerbox 2>/dev/null || true; pkill -f smsbox 2>/dev/null || true; sleep 2
systemctl start kannel-bearerbox; sleep 4; systemctl start kannel-smsbox; sleep 2
systemctl is-active kannel-bearerbox && ok "Kannel bearerbox: RUNNING" || fail "Kannel bearerbox: FAILED"
systemctl is-active kannel-smsbox    && ok "Kannel smsbox: RUNNING"    || fail "Kannel smsbox: FAILED"

header "STEP 7: Kannel Sync Script (gen-kannel-conf.sh)"
mkdir -p $API_DIR
cat > $API_DIR/gen-kannel-conf.sh <<'GENKEOF'
#!/bin/bash
DB_USER="net2app"; DB_PASS="Ariya2015@db"; DB_NAME="net2app"; KANNEL_PASS="Ariya2015@k"
CONF=/etc/kannel/kannel.conf; BAK=/etc/kannel/kannel.conf.bak.$(date +%s)
[ -f "$CONF" ] && cp "$CONF" "$BAK"
cat > "$CONF" <<COREEOF
group = core
admin-port = 13000
admin-password = $KANNEL_PASS
status-password = $KANNEL_PASS
smsbox-port = 13001
log-file = "/var/log/kannel/bearerbox.log"
log-level = 1
box-allow-ip = 127.0.0.1
access-log = "/var/log/kannel/access.log"
unified-prefix = "+,00,011"

group = smsbox
smsbox-id = "net2app_smsbox"
bearerbox-host = 127.0.0.1
bearerbox-port = 13001
sendsms-port = 13013
sendsms-interface = 127.0.0.1
log-file = "/var/log/kannel/smsbox.log"
log-level = 1
global-sender = "NET2APP"
max-msgs-per-second = 500
dlr-url = "http://127.0.0.1:5000/api/dlr?msgid=%i&status=%d&to=%p&from=%A"
COREEOF
echo "# === SMSC Suppliers $(date) ===" >> "$CONF"
mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -N -B -e "SELECT id,name,smpp_ip,smpp_port,smpp_username,smpp_password,tps_limit FROM suppliers WHERE connection_type='SMPP' AND status='active'" 2>/dev/null | while IFS=$'\t' read -r id name ip port user pass tps; do
  tps=${tps:-100}
  printf "\ngroup = smsc\nsmsc = smpp\nsmsc-id = \"%s\"\nhost = %s\nport = %s\nsmsc-username = \"%s\"\nsmsc-password = \"%s\"\ntransceiver-mode = true\nreconnect-delay = 10\nmax-pending-submits = %s\n" "$name" "$ip" "$port" "$user" "$pass" "$tps" >> "$CONF"
done
echo "# === SMPP Clients $(date) ===" >> "$CONF"
mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -N -B -e "SELECT smpp_username,smpp_password,smpp_port,tps_limit FROM clients WHERE connection_type='SMPP' AND status='active' AND smpp_username IS NOT NULL AND smpp_username<>''" 2>/dev/null | while IFS=$'\t' read -r user pass port tps; do
  port=${port:-9096}; tps=${tps:-100}
  printf "\ngroup = smpp-server\nsystem-id = \"%s\"\npassword = \"%s\"\nport = %s\nmax-sms-per-second = %s\n" "$user" "$pass" "$port" "$tps" >> "$CONF"
done
kill -HUP $(pidof bearerbox) 2>/dev/null || pkill -HUP bearerbox 2>/dev/null || true
echo "[OK] kannel.conf regenerated and reloaded"
GENKEOF
chmod +x $API_DIR/gen-kannel-conf.sh
ok "gen-kannel-conf.sh ready"

header "STEP 8: Standalone Express API Server (server.js) — NO Base44"
cd $API_DIR
npm init -y 2>/dev/null | tail -1
npm install express mysql2 cors dotenv jsonwebtoken bcryptjs node-cron 2>&1 | tail -3

cat > $API_DIR/.env <<ENVEOF
PORT=5000
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DB=$DB_NAME
MYSQL_USER=$DB_APP_USER
MYSQL_PASS=$DB_APP_PASS
JWT_SECRET=$API_TOKEN
KANNEL_ADMIN_URL=http://127.0.0.1:13000
KANNEL_ADMIN_PASS=$KANNEL_PASS
API_TOKEN=$API_TOKEN
WEBROOT=$WEBROOT
ENVEOF
chmod 600 $API_DIR/.env

cat > $API_DIR/server.js <<'SERVEREOF'
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const express  = require('express');
const mysql    = require('mysql2/promise');
const jwt      = require('jsonwebtoken');
const crypto   = require('crypto');
const { exec } = require('child_process');
const net      = require('net');
const fs       = require('fs');
const cron     = require('node-cron');
const cors     = require('cors');
const path     = require('path');

const app = express();
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','DELETE','OPTIONS'], allowedHeaders: ['Authorization','Content-Type','X-Api-Token'] }));
app.options('*', cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const WEBROOT = process.env.WEBROOT || '/var/www/net2app';
if (fs.existsSync(WEBROOT)) app.use(express.static(WEBROOT));

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST||'localhost',
  port: parseInt(process.env.MYSQL_PORT)||3306,
  database: process.env.MYSQL_DB,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASS,
  connectionLimit: 30,
  waitForConnections: true
});

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';
function uuid() { return crypto.randomUUID(); }
function sha256(s) { return crypto.createHash('sha256').update(s).digest('hex'); }

const authMiddleware = (req, res, next) => {
  const bearer = (req.headers['authorization']||'').replace(/^Bearer /i,'').trim();
  const xtoken = (req.headers['x-api-token']||'').trim();
  const token  = bearer || xtoken;
  if (!token) return res.status(401).json({ error: 'No token provided' });
  if (token === process.env.API_TOKEN) { req.user = { id: 'system', role: 'admin' }; return next(); }
  try { req.user = jwt.verify(token, JWT_SECRET); return next(); }
  catch { return res.status(401).json({ error: 'Invalid or expired token' }); }
};
const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
};

app.get('/health', async (req, res) => {
  try {
    await pool.execute('SELECT 1');
    const [[{cnt}]] = await pool.execute('SELECT COUNT(*) AS cnt FROM sms_log WHERE DATE(submit_time)=CURDATE()');
    res.json({ ok: true, db: 'connected', sms_today: cnt, ts: new Date().toISOString() });
  } catch(e) { res.json({ ok: false, db: 'disconnected', error: e.message }); }
});

app.get('/api/version', (req, res) => res.json({ version: '2.0.0', standalone: true, base44: false }));

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const [[user]] = await pool.execute('SELECT * FROM users WHERE email=? AND status="active" LIMIT 1', [email]);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  if (user.password_hash !== sha256(password)) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ ok: true, token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  const [[user]] = await pool.execute('SELECT id,name,email,role,status,created_at FROM users WHERE id=?', [req.user.id]);
  res.json(user || {});
});

app.use('/api', authMiddleware);

app.get('/api/dashboard', async (req, res) => {
  const [[today]] = await pool.execute(`SELECT COUNT(*) AS total,SUM(status='delivered') AS delivered,SUM(status='failed' OR status='rejected') AS failed,IFNULL(SUM(sell_rate),0) AS revenue,IFNULL(SUM(cost),0) AS cost FROM sms_log WHERE DATE(submit_time)=CURDATE()`);
  const [[clients_count]] = await pool.execute('SELECT COUNT(*) AS cnt FROM clients WHERE status="active"');
  const [[suppliers_count]] = await pool.execute('SELECT COUNT(*) AS cnt FROM suppliers WHERE status="active"');
  const [hourly] = await pool.execute(`SELECT HOUR(submit_time) AS hour,COUNT(*) AS count,SUM(status='delivered') AS delivered FROM sms_log WHERE DATE(submit_time)=CURDATE() GROUP BY HOUR(submit_time) ORDER BY hour`);
  const [recent] = await pool.execute('SELECT message_id,client_name,sender_id,destination,status,submit_time,parts FROM sms_log ORDER BY submit_time DESC LIMIT 20');
  res.json({ today: today[0], active_clients: clients_count[0].cnt, active_suppliers: suppliers_count[0].cnt, hourly, recent });
});

app.get('/api/users', adminOnly, async (req, res) => {
  const [rows] = await pool.execute('SELECT id,name,email,role,status,created_at FROM users ORDER BY created_at DESC');
  res.json({ ok: true, data: rows });
});
app.post('/api/users', adminOnly, async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email + password required' });
  const id = uuid();
  await pool.execute('INSERT INTO users (id,name,email,password_hash,role) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),role=VALUES(role)', [id, name||email, email, sha256(password), role||'viewer']);
  res.json({ ok: true, id });
});
app.put('/api/users/:id', adminOnly, async (req, res) => {
  const { name, role, status, password } = req.body;
  if (password) await pool.execute('UPDATE users SET name=?,role=?,status=?,password_hash=? WHERE id=?', [name,role||'viewer',status||'active',sha256(password),req.params.id]);
  else await pool.execute('UPDATE users SET name=?,role=?,status=? WHERE id=?', [name,role||'viewer',status||'active',req.params.id]);
  res.json({ ok: true });
});
app.delete('/api/users/:id', adminOnly, async (req, res) => {
  await pool.execute('DELETE FROM users WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

app.get('/api/clients', async (req, res) => {
  const { status, search, limit=100 } = req.query;
  let q = 'SELECT * FROM clients'; const params = []; const where = [];
  if (status) { where.push('status=?'); params.push(status); }
  if (search) { where.push('(name LIKE ? OR email LIKE ?)'); params.push(`%${search}%`,`%${search}%`); }
  if (where.length) q += ' WHERE ' + where.join(' AND ');
  q += ' ORDER BY created_at DESC LIMIT ?'; params.push(parseInt(limit));
  const [rows] = await pool.execute(q, params);
  res.json({ ok: true, data: rows });
});
app.get('/api/clients/:id', async (req, res) => {
  const [[row]] = await pool.execute('SELECT * FROM clients WHERE id=?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});
app.post('/api/clients', async (req, res) => {
  const d = req.body;
  if (!d.name||!d.email||!d.connection_type) return res.status(400).json({ error: 'name,email,connection_type required' });
  const id = d.id || uuid();
  await pool.execute(`INSERT INTO clients (id,name,contact_person,email,phone,connection_type,smpp_ip,smpp_port,smpp_username,smpp_password,http_url,http_method,http_params,dlr_url,billing_type,force_dlr,force_dlr_timeout,status,credit_limit,currency,balance,tps_limit,allowed_senders,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),email=VALUES(email),connection_type=VALUES(connection_type),smpp_ip=VALUES(smpp_ip),smpp_port=VALUES(smpp_port),smpp_username=VALUES(smpp_username),smpp_password=VALUES(smpp_password),billing_type=VALUES(billing_type),force_dlr=VALUES(force_dlr),force_dlr_timeout=VALUES(force_dlr_timeout),status=VALUES(status),tps_limit=VALUES(tps_limit),updated_at=NOW()`,
    [id,d.name,d.contact_person||'',d.email,d.phone||'',d.connection_type,d.smpp_ip||'',d.smpp_port||9096,d.smpp_username||'',d.smpp_password||'',d.http_url||'',d.http_method||'POST',d.http_params||'',d.dlr_url||'',d.billing_type||'submit',d.force_dlr?1:0,d.force_dlr_timeout||30,d.status||'active',d.credit_limit||0,d.currency||'USD',d.balance||0,d.tps_limit||100,d.allowed_senders||'',d.notes||'']);
  res.json({ ok: true, id });
});
app.put('/api/clients/:id', async (req, res) => {
  const d = req.body;
  await pool.execute(`UPDATE clients SET name=?,contact_person=?,email=?,phone=?,connection_type=?,smpp_ip=?,smpp_port=?,smpp_username=?,smpp_password=?,billing_type=?,force_dlr=?,force_dlr_timeout=?,status=?,tps_limit=?,currency=?,balance=?,credit_limit=?,notes=?,updated_at=NOW() WHERE id=?`,
    [d.name,d.contact_person||'',d.email,d.phone||'',d.connection_type,d.smpp_ip||'',d.smpp_port||9096,d.smpp_username||'',d.smpp_password||'',d.billing_type||'submit',d.force_dlr?1:0,d.force_dlr_timeout||30,d.status||'active',d.tps_limit||100,d.currency||'USD',d.balance||0,d.credit_limit||0,d.notes||'',req.params.id]);
  res.json({ ok: true });
});
app.delete('/api/clients/:id', async (req, res) => { await pool.execute('DELETE FROM clients WHERE id=?',[req.params.id]); res.json({ok:true}); });
app.post('/api/clients/:id/topup', adminOnly, async (req, res) => {
  await pool.execute('UPDATE clients SET balance=balance+? WHERE id=?',[parseFloat(req.body.amount),req.params.id]);
  const [[row]] = await pool.execute('SELECT balance FROM clients WHERE id=?',[req.params.id]);
  res.json({ok:true,new_balance:row?.balance});
});

app.get('/api/suppliers', async (req, res) => {
  const { category, status } = req.query;
  let q = 'SELECT * FROM suppliers'; const params=[]; const where=[];
  if (category) { where.push('category=?'); params.push(category); }
  if (status)   { where.push('status=?');   params.push(status); }
  if (where.length) q += ' WHERE '+where.join(' AND ');
  q += ' ORDER BY priority ASC, created_at DESC';
  const [rows] = await pool.execute(q, params);
  res.json({ ok: true, data: rows });
});
app.post('/api/suppliers', async (req, res) => {
  const d = req.body;
  if (!d.name) return res.status(400).json({ error: 'name required' });
  const id = d.id || uuid();
  await pool.execute(`INSERT INTO suppliers (id,name,category,provider_type,contact_person,email,phone,connection_type,smpp_ip,smpp_port,smpp_username,smpp_password,http_url,http_method,http_params,api_key,api_secret,dlr_url,status,priority,tps_limit,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),category=VALUES(category),connection_type=VALUES(connection_type),smpp_ip=VALUES(smpp_ip),smpp_port=VALUES(smpp_port),smpp_username=VALUES(smpp_username),smpp_password=VALUES(smpp_password),http_url=VALUES(http_url),status=VALUES(status),priority=VALUES(priority),tps_limit=VALUES(tps_limit),updated_at=NOW()`,
    [id,d.name,d.category||'sms',d.provider_type||'',d.contact_person||'',d.email||'',d.phone||'',d.connection_type||'HTTP',d.smpp_ip||'',d.smpp_port||2775,d.smpp_username||'',d.smpp_password||'',d.http_url||'',d.http_method||'POST',d.http_params||'',d.api_key||'',d.api_secret||'',d.dlr_url||'',d.status||'active',d.priority||1,d.tps_limit||100,d.notes||'']);
  res.json({ ok: true, id });
});
app.put('/api/suppliers/:id', async (req, res) => {
  const d = req.body;
  await pool.execute(`UPDATE suppliers SET name=?,category=?,provider_type=?,connection_type=?,smpp_ip=?,smpp_port=?,smpp_username=?,smpp_password=?,http_url=?,api_key=?,api_secret=?,dlr_url=?,status=?,priority=?,tps_limit=?,notes=?,updated_at=NOW() WHERE id=?`,
    [d.name,d.category||'sms',d.provider_type||'',d.connection_type||'HTTP',d.smpp_ip||'',d.smpp_port||2775,d.smpp_username||'',d.smpp_password||'',d.http_url||'',d.api_key||'',d.api_secret||'',d.dlr_url||'',d.status||'active',d.priority||1,d.tps_limit||100,d.notes||'',req.params.id]);
  res.json({ ok: true });
});
app.delete('/api/suppliers/:id', async (req, res) => { await pool.execute('DELETE FROM suppliers WHERE id=?',[req.params.id]); res.json({ok:true}); });

app.get('/api/routes', async (req, res) => { const [rows] = await pool.execute('SELECT * FROM routes ORDER BY created_at DESC'); res.json({ok:true,data:rows}); });
app.post('/api/routes', async (req, res) => {
  const d = req.body;
  if (!d.name||!d.client_id||!d.supplier_id) return res.status(400).json({ error: 'name,client_id,supplier_id required' });
  const id = d.id||uuid();
  await pool.execute(`INSERT INTO routes (id,name,client_id,client_name,supplier_id,supplier_name,backup_supplier_id,backup_supplier_name,mcc,mnc,country,network,prefix,routing_mode,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),supplier_id=VALUES(supplier_id),status=VALUES(status),updated_at=NOW()`,
    [id,d.name,d.client_id,d.client_name||'',d.supplier_id,d.supplier_name||'',d.backup_supplier_id||null,d.backup_supplier_name||'',d.mcc||'',d.mnc||'',d.country||'',d.network||'',d.prefix||'',d.routing_mode||'Priority',d.status||'active']);
  res.json({ok:true,id});
});
app.put('/api/routes/:id', async (req, res) => {
  const d = req.body;
  await pool.execute('UPDATE routes SET name=?,supplier_id=?,supplier_name=?,backup_supplier_id=?,mcc=?,mnc=?,routing_mode=?,status=?,updated_at=NOW() WHERE id=?',
    [d.name,d.supplier_id,d.supplier_name||'',d.backup_supplier_id||null,d.mcc||'',d.mnc||'',d.routing_mode||'Priority',d.status||'active',req.params.id]);
  res.json({ok:true});
});
app.delete('/api/routes/:id', async (req, res) => { await pool.execute('DELETE FROM routes WHERE id=?',[req.params.id]); res.json({ok:true}); });

app.get('/api/rates', async (req, res) => {
  const { entity_id, type } = req.query;
  let q='SELECT * FROM rates WHERE status="active"'; const params=[];
  if (entity_id) { q+=' AND entity_id=?'; params.push(entity_id); }
  if (type) { q+=' AND type=?'; params.push(type); }
  q+=' ORDER BY mcc,mnc';
  const [rows] = await pool.execute(q, params);
  res.json({ok:true,data:rows});
});
app.post('/api/rates', async (req, res) => {
  const d=req.body; const id=uuid();
  await pool.execute('INSERT INTO rates (id,type,entity_id,entity_name,mcc,mnc,country,network,prefix,rate,currency) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    [id,d.type||'client',d.entity_id,d.entity_name||'',d.mcc||'',d.mnc||'',d.country||'',d.network||'',d.prefix||'',d.rate||0,d.currency||'USD']);
  res.json({ok:true,id});
});
app.put('/api/rates/:id', async (req, res) => {
  const d=req.body;
  await pool.execute('UPDATE rates SET rate=?,currency=?,status=? WHERE id=?',[d.rate||0,d.currency||'USD',d.status||'active',req.params.id]);
  res.json({ok:true});
});
app.delete('/api/rates/:id', async (req, res) => { await pool.execute('DELETE FROM rates WHERE id=?',[req.params.id]); res.json({ok:true}); });

app.get('/api/sms-logs', async (req, res) => {
  const { status,client_id,destination,limit=100,offset=0,from,to } = req.query;
  let q='SELECT * FROM sms_log'; const params=[]; const where=[];
  if (status)      { where.push('status=?');           params.push(status); }
  if (client_id)   { where.push('client_id=?');        params.push(client_id); }
  if (destination) { where.push('destination LIKE ?'); params.push(`%${destination}%`); }
  if (from)        { where.push('submit_time>=?');     params.push(from); }
  if (to)          { where.push('submit_time<=?');     params.push(to); }
  if (where.length) q+=' WHERE '+where.join(' AND ');
  q+=' ORDER BY submit_time DESC LIMIT ? OFFSET ?'; params.push(parseInt(limit),parseInt(offset));
  const [rows] = await pool.execute(q, params);
  const [[{cnt}]] = await pool.execute('SELECT COUNT(*) AS cnt FROM sms_log'+(where.length?' WHERE '+where.join(' AND '):''), params.slice(0,-2));
  res.json({ok:true,data:rows,total:cnt});
});
app.post('/api/sms-logs', async (req, res) => {
  const d=req.body;
  const msgId = d.message_id||'MSG-'+Date.now()+'-'+Math.random().toString(36).substr(2,6).toUpperCase();
  await pool.execute(`INSERT INTO sms_log (message_id,client_id,client_name,supplier_id,supplier_name,sender_id,destination,mcc,mnc,country,network,content,status,parts,cost,sell_rate,sms_type,submit_time) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW())`,
    [msgId,d.client_id||'',d.client_name||'',d.supplier_id||'',d.supplier_name||'',d.sender_id||'',d.destination||'',d.mcc||'',d.mnc||'',d.country||'',d.network||'',d.content||'',d.status||'pending',d.parts||1,d.cost||0,d.sell_rate||0,d.sms_type||'transactional']);
  res.json({ok:true,message_id:msgId});
});

app.get('/api/dlr', async (req, res) => {
  const {msgid,status}=req.query; const s=parseInt(status);
  const st=s===1?'delivered':(s===16?'pending':'failed');
  await pool.execute('UPDATE sms_log SET status=?,delivery_time=NOW() WHERE message_id=? OR dest_msg_id=?',[st,msgid,msgid]);
  res.json({ok:true});
});
app.post('/api/dlr', async (req, res) => {
  const {msgid,status}=req.body;
  const map={DELIVRD:'delivered',UNDELIV:'failed',REJECTD:'rejected',EXPIRED:'failed',DELETED:'failed'};
  const st=map[(status||'').toUpperCase()]||(parseInt(status)===1?'delivered':'failed');
  await pool.execute('UPDATE sms_log SET status=?,delivery_time=NOW() WHERE message_id=? OR dest_msg_id=?',[st,msgid,msgid]);
  res.json({ok:true});
});

app.post('/api/send', async (req, res) => {
  const { client_id, to, from: sender, message, supplier_id } = req.body;
  if (!client_id||!to||!message) return res.status(400).json({ error: 'client_id,to,message required' });
  const [[client]] = await pool.execute('SELECT * FROM clients WHERE id=? AND status="active"', [client_id]);
  if (!client) return res.status(404).json({ error: 'Client not found or inactive' });
  if (client.balance<=0 && client.credit_limit<=0) return res.status(402).json({ error: 'Insufficient balance' });
  const [[route]] = await pool.execute('SELECT * FROM routes WHERE client_id=? AND status="active" ORDER BY id LIMIT 1', [client_id]);
  const sid = supplier_id || route?.supplier_id;
  if (!sid) return res.status(400).json({ error: 'No active route found for client' });
  const [[supplier]] = await pool.execute('SELECT * FROM suppliers WHERE id=? AND status="active"', [sid]);
  if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
  const msgId = 'MSG-'+Date.now()+'-'+Math.random().toString(36).substr(2,6).toUpperCase();
  await pool.execute(`INSERT INTO sms_log (message_id,client_id,client_name,supplier_id,supplier_name,sender_id,destination,content,status,submit_time) VALUES (?,?,?,?,?,?,?,?,'pending',NOW())`,
    [msgId,client_id,client.name,sid,supplier.name,sender||client.name,to,message]);
  if (supplier.connection_type==='SMPP') {
    const url=`http://127.0.0.1:13013/cgi-bin/sendsms?username=${encodeURIComponent(supplier.smpp_username)}&password=${encodeURIComponent(supplier.smpp_password)}&to=${encodeURIComponent(to)}&from=${encodeURIComponent(sender||'NET2APP')}&text=${encodeURIComponent(message)}&smsc=${encodeURIComponent(supplier.name)}`;
    const r=await fetch(url,{signal:AbortSignal.timeout(10000)}); const body=await r.text();
    const ok=r.ok&&(body.includes('Accepted for delivery')||body.includes('0:'));
    await pool.execute('UPDATE sms_log SET status=?,dest_msg_id=? WHERE message_id=?',[ok?'sent':'failed',body.substring(0,64),msgId]);
    return res.json({ok,message_id:msgId,kannel_response:body});
  }
  if (supplier.connection_type==='HTTP'&&supplier.http_url) {
    const params={to,from:sender||'NET2APP',message,text:message,msg:message,mobile:to};
    if (supplier.api_key) params.api_key=supplier.api_key;
    if (supplier.api_secret) params.api_secret=supplier.api_secret;
    const qs=new URLSearchParams(params).toString();
    const r=await fetch(supplier.http_method==='POST'?supplier.http_url:`${supplier.http_url}?${qs}`,{
      method:supplier.http_method||'GET',
      headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:supplier.http_method==='POST'?qs:undefined,
      signal:AbortSignal.timeout(15000)
    });
    const rb=await r.text();
    await pool.execute('UPDATE sms_log SET status=? WHERE message_id=?',[r.ok?'sent':'failed',msgId]);
    return res.json({ok:r.ok,message_id:msgId,supplier_response:rb.substring(0,256)});
  }
  res.json({ok:false,message_id:msgId,error:'Unsupported supplier type'});
});

app.get('/api/kannel/status', async (req, res) => {
  try {
    const r=await fetch(`${process.env.KANNEL_ADMIN_URL}/status?password=${encodeURIComponent(process.env.KANNEL_ADMIN_PASS)}`,{signal:AbortSignal.timeout(5000)});
    const text=await r.text();
    res.json({ok:true,up:text.includes('bearerbox')||text.includes('uptime'),raw:text.substring(0,800)});
  } catch(e) { res.json({ok:false,up:false,error:e.message}); }
});
app.post('/api/kannel/sync', (req, res) => {
  exec('/opt/net2app-api/gen-kannel-conf.sh',(err,stdout,stderr)=>{ res.json({ok:!err,output:(stdout||'')+(stderr||''),error:err?.message||null}); });
});
app.post('/api/kannel/reload', (req, res) => {
  exec('kill -HUP $(pidof bearerbox) 2>/dev/null || pkill -HUP bearerbox',(err)=>{ res.json({ok:!err,message:err?err.message:'Kannel reloaded'}); });
});
app.post('/api/smpp/test', (req, res) => {
  const {host,port}=req.body;
  if (!host||!port) return res.status(400).json({error:'host+port required'});
  const sock=new net.Socket();
  const tid=setTimeout(()=>{sock.destroy();res.json({connected:false,reason:'Timeout 5s'});},5000);
  sock.connect(parseInt(port),host,()=>{clearTimeout(tid);sock.destroy();res.json({connected:true,reason:'TCP OK'});});
  sock.on('error',err=>{clearTimeout(tid);res.json({connected:false,reason:err.message});});
});

app.get('/api/billing/summary', async (req, res) => {
  const {from,to,client_id}=req.query;
  let q='SELECT * FROM billing_summary'; const params=[]; const where=[];
  if (client_id) { where.push('client_id=?'); params.push(client_id); }
  if (from) { where.push('period>=?'); params.push(from); }
  if (to) { where.push('period<=?'); params.push(to); }
  if (where.length) q+=' WHERE '+where.join(' AND ');
  q+=' ORDER BY period DESC';
  const [rows]=await pool.execute(q,params);
  res.json({ok:true,data:rows});
});

app.get('/api/reports/traffic', async (req, res) => {
  const {from,to,group_by='day'}=req.query;
  const fmt=group_by==='hour'?'%Y-%m-%d %H:00:00':'%Y-%m-%d';
  let q=`SELECT DATE_FORMAT(submit_time,?) AS period,COUNT(*) AS total,SUM(status='delivered') AS delivered,SUM(status='failed' OR status='rejected') AS failed,ROUND(SUM(sell_rate),2) AS revenue,ROUND(SUM(cost),2) AS cost FROM sms_log WHERE 1=1`;
  const params=[fmt];
  if (from) { q+=' AND submit_time>=?'; params.push(from); }
  if (to) { q+=' AND submit_time<=?'; params.push(to); }
  q+=' GROUP BY period ORDER BY period DESC LIMIT 90';
  const [rows]=await pool.execute(q,params);
  res.json({ok:true,data:rows});
});
app.get('/api/reports/clients', async (req, res) => {
  const [rows]=await pool.execute(`SELECT c.id,c.name,c.email,c.balance,c.currency,COUNT(l.id) AS total_sms,SUM(l.status='delivered') AS delivered,ROUND(SUM(l.sell_rate),2) AS revenue FROM clients c LEFT JOIN sms_log l ON l.client_id=c.id AND DATE(l.submit_time)>=DATE_SUB(CURDATE(),INTERVAL 30 DAY) GROUP BY c.id ORDER BY revenue DESC LIMIT 50`);
  res.json({ok:true,data:rows});
});

app.get('/api/invoices', async (req, res) => { const [rows]=await pool.execute('SELECT * FROM invoices ORDER BY created_at DESC LIMIT 200'); res.json({ok:true,data:rows}); });
app.post('/api/invoices', adminOnly, async (req, res) => {
  const d=req.body; const id=uuid(); const inv_num='INV-'+Date.now();
  await pool.execute('INSERT INTO invoices (id,client_id,client_name,invoice_number,period_start,period_end,total_sms,amount,currency,status,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    [id,d.client_id,d.client_name||'',inv_num,d.period_start||null,d.period_end||null,d.total_sms||0,d.amount||0,d.currency||'USD',d.status||'draft',d.notes||'']);
  res.json({ok:true,id,invoice_number:inv_num});
});
app.put('/api/invoices/:id', adminOnly, async (req, res) => {
  await pool.execute('UPDATE invoices SET status=?,notes=? WHERE id=?',[req.body.status||'draft',req.body.notes||'',req.params.id]);
  res.json({ok:true});
});

app.get('/api/settings', adminOnly, async (req, res) => { const [rows]=await pool.execute('SELECT * FROM system_settings ORDER BY category,setting_key'); res.json({ok:true,data:rows}); });
app.post('/api/settings', adminOnly, async (req, res) => {
  const {setting_key,setting_value,category,description}=req.body;
  if (!setting_key) return res.status(400).json({error:'setting_key required'});
  const id=uuid();
  await pool.execute('INSERT INTO system_settings (id,setting_key,setting_value,category,description) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value),updated_at=NOW()',
    [id,setting_key,setting_value||'',category||'system',description||'']);
  res.json({ok:true});
});

app.get('/api/alert-rules', adminOnly, async (req, res) => { const [rows]=await pool.execute('SELECT * FROM alert_rules ORDER BY created_at DESC'); res.json({ok:true,data:rows}); });
app.post('/api/alert-rules', adminOnly, async (req, res) => {
  const d=req.body; const id=uuid();
  await pool.execute('INSERT INTO alert_rules (id,name,alert_type,threshold,window_minutes,min_messages,notify_email,client_id,supplier_id,severity,is_active,cooldown_minutes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    [id,d.name,d.alert_type,d.threshold||0,d.window_minutes||60,d.min_messages||10,d.notify_email||'',d.client_id||null,d.supplier_id||null,d.severity||'warning',d.is_active!==false?1:0,d.cooldown_minutes||60]);
  res.json({ok:true,id});
});
app.put('/api/alert-rules/:id', adminOnly, async (req, res) => {
  const d=req.body;
  await pool.execute('UPDATE alert_rules SET name=?,threshold=?,notify_email=?,severity=?,is_active=? WHERE id=?',[d.name,d.threshold||0,d.notify_email||'',d.severity||'warning',d.is_active?1:0,req.params.id]);
  res.json({ok:true});
});
app.delete('/api/alert-rules/:id', adminOnly, async (req, res) => { await pool.execute('DELETE FROM alert_rules WHERE id=?',[req.params.id]); res.json({ok:true}); });

app.get('/api/mccmnc', async (req, res) => {
  const {mcc,prefix,country}=req.query;
  let q='SELECT * FROM mcc_mnc WHERE 1=1'; const params=[];
  if (mcc) { q+=' AND mcc=?'; params.push(mcc); }
  if (prefix) { q+=' AND prefix LIKE ?'; params.push(`${prefix}%`); }
  if (country) { q+=' AND country LIKE ?'; params.push(`%${country}%`); }
  q+=' ORDER BY mcc,mnc LIMIT 200';
  const [rows]=await pool.execute(q,params);
  res.json({ok:true,data:rows});
});

app.get('*', (req, res) => {
  const index = path.join(WEBROOT, 'index.html');
  if (fs.existsSync(index)) res.sendFile(index);
  else res.json({ service: 'Net2app Standalone API', version: '2.0.0', standalone: true, login: 'POST /api/auth/login' });
});

cron.schedule('0 0 * * *', async () => {
  try {
    await pool.execute(`INSERT INTO billing_summary (id,client_id,period,total_sms,total_cost,total_revenue,margin) SELECT CONCAT(client_id,'_',DATE_FORMAT(CURDATE()-INTERVAL 1 DAY,'%Y%m%d')),client_id,CURDATE()-INTERVAL 1 DAY,COUNT(*),IFNULL(SUM(cost),0),IFNULL(SUM(sell_rate),0),IFNULL(SUM(sell_rate-cost),0) FROM sms_log WHERE DATE(submit_time)=CURDATE()-INTERVAL 1 DAY GROUP BY client_id ON DUPLICATE KEY UPDATE updated_at=NOW()`);
    console.log('[CRON] Daily billing summary updated');
  } catch(e) { console.error('[CRON]', e.message); }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Net2app Standalone API v2.0 — port ${PORT}`);
  console.log(`NO Base44 dependency — 100% self-hosted`);
  console.log(`Admin login: admin@net2app.local / Admin@2025!`);
  try { await pool.execute('SELECT 1'); console.log('MariaDB: connected OK'); }
  catch(e) { console.error('MariaDB: FAILED -', e.message); }
});
SERVEREOF

pm2 delete net2app-api 2>/dev/null || true
pm2 start $API_DIR/server.js --name net2app-api --cwd $API_DIR
pm2 save && pm2 startup 2>/dev/null || true
sleep 3
curl -s http://127.0.0.1:5000/health | grep -q '"ok":true' && ok "Standalone API: RUNNING on :5000" || fail "API: check pm2 logs net2app-api"

header "STEP 9: Build Standalone Dashboard"
if [ -d "/opt/net2app/.git" ]; then
  cd /opt/net2app && git fetch origin && git reset --hard origin/main
else
  git clone https://github.com/eliasewu/net2app.com.git /opt/net2app
fi
cd /opt/net2app
cat > /opt/net2app/.env <<VITEEOF
VITE_STANDALONE=true
VITE_API_URL=http://$(hostname -I | awk '{print $1}'):5000
VITEEOF
npm install --production=false 2>&1 | tail -5
npm run build 2>&1 | tail -5
mkdir -p $WEBROOT && rm -rf $WEBROOT/* && cp -r /opt/net2app/dist/* $WEBROOT/
ok "Dashboard built → $WEBROOT"

header "STEP 10: Nginx"
cat > /etc/nginx/sites-available/net2app <<'NGINXEOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    root /var/www/net2app;
    index index.html;
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_connect_timeout 10s;
        proxy_read_timeout 60s;
    }
    location = /health {
        proxy_pass http://127.0.0.1:5000/health;
    }
    location / { try_files $uri $uri/ /index.html; }
    location ~* \.(js|css|png|jpg|ico|woff2?)$ { expires 7d; add_header Cache-Control "public, immutable"; }
    gzip on;
    gzip_types text/plain application/javascript application/json text/css;
}
NGINXEOF
ln -sf /etc/nginx/sites-available/net2app /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl enable nginx && systemctl reload nginx
ok "Nginx: SPA + /api/ proxy configured"

header "STEP 11: UFW Firewall"
ufw allow 22/tcp   comment "SSH"
ufw allow 80/tcp   comment "HTTP"
ufw allow 443/tcp  comment "HTTPS"
ufw allow 5000/tcp comment "API direct"
ufw allow 9095:9200/tcp comment "SMPP ports"
ufw deny 3306      comment "MariaDB local"
ufw allow from 127.0.0.1 to any port 13000 comment "Kannel admin"
ufw allow from 127.0.0.1 to any port 13013 comment "Kannel sendsms"
echo "y" | ufw enable 2>/dev/null || true
ok "UFW configured"

header "STEP 12: Fail2Ban"
systemctl enable fail2ban && systemctl restart fail2ban
ok "Fail2Ban ready"

header "STEP 13: Initial Kannel Sync"
bash $API_DIR/gen-kannel-conf.sh && ok "kannel.conf synced" || info "Sync skipped — add SMPP clients/suppliers first"

header "STEP 14: Final Health Check"
SERVER_IP=$(hostname -I | awk '{print $1}')
systemctl is-active nginx            && ok "Nginx:      RUNNING" || fail "Nginx: DOWN"
systemctl is-active mariadb          && ok "MariaDB:    RUNNING" || fail "MariaDB: DOWN"
systemctl is-active kannel-bearerbox && ok "Bearerbox:  RUNNING" || fail "Bearerbox: DOWN"
systemctl is-active kannel-smsbox    && ok "Smsbox:     RUNNING" || fail "Smsbox: DOWN"
pm2 list | grep net2app-api | grep -q online && ok "API:        RUNNING" || fail "API: DOWN"
curl -s http://127.0.0.1:5000/health | grep -q '"ok":true' && ok "API /health: OK" || fail "API /health: FAIL"

echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║  NET2APP STANDALONE — DEPLOYMENT COMPLETE                       ║"
echo "╠══════════════════════════════════════════════════════════════════╣"
echo "║  Dashboard:  http://$SERVER_IP/                                 ║"
echo "║  API:        http://$SERVER_IP:5000                             ║"
echo "║  Health:     http://$SERVER_IP/health                           ║"
echo "╠══════════════════════════════════════════════════════════════════╣"
echo "║  LOGIN: admin@net2app.local / Admin@2025!                       ║"
echo "╠══════════════════════════════════════════════════════════════════╣"
echo "║  POST /api/auth/login  →  JWT token  →  use in Authorization    ║"
echo "╠══════════════════════════════════════════════════════════════════╣"
echo "║  ✅ NO Base44 — 100% self-hosted                                 ║"
echo "║  ✅ JWT auth + full CRUD API                                     ║"
echo "║  ✅ SMS send via Kannel SMPP or HTTP suppliers                   ║"
echo "║  ✅ DLR callbacks at /api/dlr                                    ║"
echo "║  ✅ Real-time billing triggers in MariaDB                        ║"
echo "║  ✅ Kannel sync: bash /opt/net2app-api/gen-kannel-conf.sh        ║"
echo "║  ✅ Deploy N servers — each fully independent                    ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
