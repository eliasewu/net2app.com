// Net2app — SMPP API Server deploy script
export const SMPP_API_SERVER_SCRIPT = `#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
#  Net2app — SMPP API Server (Node.js/Express)
#  Handles: DLR callbacks, TCP SMPP test, Kannel reload, SMPP user mgmt
#  Run as root: bash setup-smpp-api.sh
# ═══════════════════════════════════════════════════════════════════
set -e
GREEN='\\033[0;32m'; RED='\\033[0;31m'; YELLOW='\\033[1;33m'; NC='\\033[0m'
ok()   { echo -e "\${GREEN}[OK]\${NC} \$1"; }
fail() { echo -e "\${RED}[FAIL]\${NC} \$1"; exit 1; }
info() { echo -e "\${YELLOW}[i]\${NC} \$1"; }

if [ "\$EUID" -ne 0 ]; then exec sudo bash "\$0" "\$@"; fi

API_DIR="/opt/net2app-api"
API_TOKEN="\${1:-CHANGE_THIS_SECRET_TOKEN}"

echo ""; echo "════════════════════════════════════════"
echo "  Net2app SMPP API Server Setup"
echo "  Token: \${API_TOKEN}"
echo "════════════════════════════════════════"

info "Installing Node.js 20..."
which node &>/dev/null || { curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs; }
which pm2 &>/dev/null || npm install -g pm2
ok "Node.js: \$(node -v)"

mkdir -p \$API_DIR
cd \$API_DIR
npm init -y 2>/dev/null | tail -1

info "Installing dependencies..."
npm install express mysql2 cors dotenv 2>&1 | tail -2
ok "Dependencies installed"

info "Writing .env..."
cat > \$API_DIR/.env << EOF
PORT=5000
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DB=net2app
MYSQL_USER=net2app
MYSQL_PASS=Telco1988
KANNEL_ADMIN_URL=http://127.0.0.1:13000
KANNEL_ADMIN_PASS=CHANGE_ADMIN_PASSWORD
API_TOKEN=\${API_TOKEN}
EOF
chmod 600 \$API_DIR/.env
ok ".env written (chmod 600)"

info "Writing server.js..."
cat > \$API_DIR/server.js << 'SERVEREOF'
require('dotenv').config();
const express  = require('express');
const mysql    = require('mysql2/promise');
const { exec } = require('child_process');
const net      = require('net');
const cors     = require('cors');
const fs       = require('fs');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT) || 3306,
  database: process.env.MYSQL_DB || 'net2app',
  user: process.env.MYSQL_USER || 'net2app',
  password: process.env.MYSQL_PASS || 'Telco1988',
  connectionLimit: 20, charset: 'utf8mb4', timezone: '+00:00'
});

const auth = (req, res, next) => {
  const token = (req.headers['authorization'] || '').replace('Bearer ', '');
  const isLocal = req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1';
  if (token === process.env.API_TOKEN) return next();
  if (req.path.startsWith('/api/dlr') && isLocal) return next();
  if (req.path === '/health') return next();
  res.status(401).json({ error: 'Unauthorized' });
};

app.use(auth);

app.get('/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// ── DLR from Kannel (GET) ─────────────────────────────────────────
// kannel.conf: dlr-url = "http://127.0.0.1:5000/api/dlr?msgid=%i&status=%d&to=%p&from=%A"
app.get('/api/dlr', async (req, res) => {
  const { msgid, status, to, from } = req.query;
  const s = parseInt(status);
  const smsStatus = s === 1 ? 'delivered' : (s === 16 ? 'pending' : 'failed');
  try {
    await pool.execute(
      'UPDATE sms_log SET status=?, delivery_time=NOW() WHERE message_id=? OR dest_msg_id=?',
      [smsStatus, msgid, msgid]
    );
    res.json({ ok: true, msgid, status: smsStatus });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DLR from HTTP suppliers (POST) ───────────────────────────────
app.post('/api/dlr', async (req, res) => {
  const { msgid, status } = req.body;
  const map = { DELIVRD: 'delivered', UNDELIV: 'failed', REJECTD: 'rejected', EXPIRED: 'failed', DELETED: 'failed', ACCEPTD: 'sent', ENROUTE: 'sent' };
  const smsStatus = map[(status || '').toUpperCase()] || (parseInt(status) === 1 ? 'delivered' : 'failed');
  try {
    await pool.execute(
      'UPDATE sms_log SET status=?, delivery_time=NOW() WHERE message_id=? OR dest_msg_id=?',
      [smsStatus, msgid, msgid]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── TCP SMPP Test ─────────────────────────────────────────────────
app.post('/api/smpp/test', (req, res) => {
  const { host, port } = req.body;
  if (!host || !port) return res.status(400).json({ error: 'host and port required' });
  const sock = new net.Socket();
  const tid = setTimeout(() => { sock.destroy(); res.json({ connected: false, reason: 'Timeout (5s)' }); }, 5000);
  sock.connect(parseInt(port), host, () => { clearTimeout(tid); sock.destroy(); res.json({ connected: true, reason: 'TCP OK to ' + host + ':' + port }); });
  sock.on('error', err => { clearTimeout(tid); res.json({ connected: false, reason: err.message }); });
});

// ── Reload Kannel (send HUP) ──────────────────────────────────────
app.post('/api/smpp/reload', (req, res) => {
  exec('kill -HUP $(pidof bearerbox) 2>/dev/null || pkill -HUP bearerbox 2>/dev/null', (err) => {
    res.json({ ok: !err, message: err ? err.message : 'Kannel reloaded (HUP sent to bearerbox)' });
  });
});

// ── Apply Kannel Config + Reload ──────────────────────────────────
app.post('/api/smpp/apply-config', (req, res) => {
  const { config } = req.body;
  if (!config) return res.status(400).json({ error: 'config required' });
  const bak = '/etc/kannel/kannel.conf.bak.' + Date.now();
  try {
    if (fs.existsSync('/etc/kannel/kannel.conf')) fs.copyFileSync('/etc/kannel/kannel.conf', bak);
    fs.writeFileSync('/etc/kannel/kannel.conf', config, 'utf8');
    exec('kill -HUP $(pidof bearerbox) 2>/dev/null || pkill -HUP bearerbox 2>/dev/null', (err) => {
      res.json({ ok: true, backup: bak, reloaded: !err });
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Provision Client SMPP User ────────────────────────────────────
app.post('/api/smpp/user/add', async (req, res) => {
  const { client_id, smpp_username, smpp_password, smpp_port } = req.body;
  try {
    await pool.execute(
      `INSERT INTO smpp_users (client_id,smpp_username,smpp_password,smpp_port,status)
       VALUES (?,?,?,?,'active')
       ON DUPLICATE KEY UPDATE smpp_password=?,smpp_port=?,status='active',updated_at=NOW()`,
      [client_id, smpp_username, smpp_password, smpp_port || 9096, smpp_password, smpp_port || 9096]
    );
    res.json({ ok: true, message: `SMPP user ${smpp_username}:${smpp_port} provisioned` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Remove Client SMPP User ───────────────────────────────────────
app.post('/api/smpp/user/remove', async (req, res) => {
  const { client_id, smpp_username } = req.body;
  try {
    await pool.execute(`UPDATE smpp_users SET status='inactive' WHERE client_id=? AND smpp_username=?`, [client_id, smpp_username]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Billing Dashboard ─────────────────────────────────────────────
app.get('/api/billing/dashboard', async (req, res) => {
  const { tenant_id = 'default' } = req.query;
  try {
    const [rows] = await pool.execute('CALL sp_today_dashboard(?)', [tenant_id]);
    res.json({ ok: true, data: rows[0] });
  } catch {
    try {
      const [rows] = await pool.execute(
        `SELECT COUNT(*) as total_sms,
          SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END) as delivered,
          SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as failed,
          IFNULL(SUM(cost),0) as total_cost, IFNULL(SUM(sell_rate),0) as total_revenue
         FROM sms_log WHERE tenant_id=? AND DATE(submit_time)=CURDATE()`, [tenant_id]
      );
      res.json({ ok: true, data: rows });
    } catch (e2) { res.status(500).json({ error: e2.message }); }
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', async () => {
  console.log(\`Net2app API on port \${PORT}\`);
  try { await pool.execute('SELECT 1'); console.log('MariaDB connected'); }
  catch (e) { console.error('MariaDB error:', e.message); }
});
SERVEREOF
ok "server.js written"

info "Creating smpp_users table..."
mysql -u root -pTelco1988 net2app 2>/dev/null << 'EOF'
CREATE TABLE IF NOT EXISTS smpp_users (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  client_id VARCHAR(64) NOT NULL,
  smpp_username VARCHAR(64) NOT NULL,
  smpp_password VARCHAR(128),
  smpp_port INT DEFAULT 9096,
  status ENUM('active','inactive') DEFAULT 'active',
  last_bind DATETIME,
  bind_count INT DEFAULT 0,
  created_at DATETIME DEFAULT NOW(),
  updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  UNIQUE KEY uk_user (smpp_username),
  INDEX idx_client (client_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
EOF
ok "smpp_users table created"

info "Adding UFW rule for API port..."
ufw allow from 127.0.0.1 to any port 5000 comment 'Net2app API (localhost)' 2>/dev/null || true

info "Starting PM2..."
pm2 delete net2app-api 2>/dev/null || true
pm2 start \$API_DIR/server.js --name net2app-api
pm2 save
pm2 startup 2>/dev/null || true
ok "PM2 started"

sleep 3
echo ""; echo "── Health Check ──"
curl -s http://127.0.0.1:5000/health && echo ""
echo ""; echo "── SMPP Test (change host/port) ──"
echo "curl -X POST http://127.0.0.1:5000/api/smpp/test -H 'Authorization: Bearer \${API_TOKEN}' -H 'Content-Type: application/json' -d '{\"host\":\"smpp.provider.com\",\"port\":2775}'"

echo ""; echo "════════════════════════════════════════"
echo -e "\${GREEN}  NET2APP API SERVER READY!\${NC}"
echo "════════════════════════════════════════"
echo "  URL: http://127.0.0.1:5000"
echo "  Token: \${API_TOKEN}"
echo "  pm2 logs net2app-api"
echo "  pm2 status"
echo "  API endpoints:"
echo "    GET  /health"
echo "    GET  /api/dlr?msgid=X&status=1"
echo "    POST /api/smpp/test"
echo "    POST /api/smpp/reload"
echo "    POST /api/smpp/apply-config"
echo "    POST /api/smpp/user/add"
echo "    POST /api/smpp/user/remove"
echo "    GET  /api/billing/dashboard"
echo "════════════════════════════════════════"`;

export const MARIADB_SMPP_TABLE = `-- Add smpp_users table to net2app DB (run once)
USE net2app;

CREATE TABLE IF NOT EXISTS smpp_users (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  client_id VARCHAR(64) NOT NULL,
  smpp_username VARCHAR(64) NOT NULL,
  smpp_password VARCHAR(128),
  smpp_port INT DEFAULT 9096,
  status ENUM('active','inactive') DEFAULT 'active',
  last_bind DATETIME,
  bind_count INT DEFAULT 0,
  created_at DATETIME DEFAULT NOW(),
  updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  UNIQUE KEY uk_user (smpp_username),
  INDEX idx_client (client_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add bind tracking columns to suppliers (if not exist)
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS bind_status VARCHAR(32) DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS bind_reason VARCHAR(256),
  ADD COLUMN IF NOT EXISTS bind_type   VARCHAR(32) DEFAULT 'transceiver',
  ADD COLUMN IF NOT EXISTS system_type VARCHAR(32) DEFAULT 'SMPP',
  ADD COLUMN IF NOT EXISTS last_bind_at DATETIME;

-- Add smpp fields to clients (if not exist)
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS smpp_port INT DEFAULT 9096;

SELECT 'smpp_users table ready' AS result;`;