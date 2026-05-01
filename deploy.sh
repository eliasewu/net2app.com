#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
#  Net2app — Full Debian 12 Deployment v3.3
#  Features: SMS Gateway + API + DB + Invoices + Volume Thresholds + Supplier Reports
#  Usage: bash deploy.sh   (run as root on fresh Debian 12)
# ═══════════════════════════════════════════════════════════════════

if [ "$EUID" -ne 0 ]; then exec sudo bash "$0" "$@"; fi
set -e

GREEN="\033[0;32m"; RED="\033[0;31m"; YELLOW="\033[1;33m"; BLUE="\033[0;34m"; NC="\033[0m"
ok()     { echo -e "${GREEN}[OK]${NC} $1"; }
fail()   { echo -e "${RED}[FAIL]${NC} $1"; exit 1; }
info()   { echo -e "${YELLOW}[i]${NC} $1"; }
header() { echo -e "\n${BLUE}══ $1 ══${NC}\n"; }

# ── CONFIG — change before running ─────────────────────────────────
DB_ROOT_PASS="Telco1988"
DB_APP_USER="net2app"
DB_APP_PASS="Telco1988"
DB_NAME="net2app"
KANNEL_ADMIN_PASS="CHANGE_ADMIN_PASSWORD"
AMI_PASS="Telco1988"
API_TOKEN="CHANGE_THIS_SECRET_TOKEN"
GITHUB_REPO="https://github.com/eliasewu/net2app.com.git"
DEPLOY_DIR="/opt/net2app"
WEBROOT="/var/www/html"
API_DIR="/opt/net2app-api"
BRANCH="main"
# ────────────────────────────────────────────────────────────────────

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  NET2APP — Full Debian 12 Deployment v3.3"
echo "  $(date)"
echo "════════════════════════════════════════════════════════════"

# ══ STEP 1: System Update ════════════════════════════════════════════
header "STEP 1: System Update & Base Packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y && apt-get upgrade -y
apt-get install -y \
  build-essential git curl wget vim net-tools tcpdump nmap \
  ufw fail2ban supervisor lsb-release gnupg ca-certificates \
  libssl-dev libncurses5-dev libxml2-dev libsqlite3-dev \
  uuid-dev libjansson-dev libedit-dev libgsm1-dev \
  mpg123 sox unixodbc unixodbc-dev pkg-config \
  php8.2 php8.2-mysql php8.2-curl nginx
ok "Base packages installed"

# ══ STEP 2: MariaDB ══════════════════════════════════════════════════
header "STEP 2: MariaDB Database Server"
apt-get install -y mariadb-server mariadb-client
systemctl enable mariadb && systemctl start mariadb
sleep 2

mysql -u root << EOF
ALTER USER "root"@"localhost" IDENTIFIED BY "${DB_ROOT_PASS}";
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS "${DB_APP_USER}"@"localhost" IDENTIFIED BY "${DB_APP_PASS}";
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO "${DB_APP_USER}"@"localhost";
FLUSH PRIVILEGES;
EOF

mysql -u root -p"${DB_ROOT_PASS}" ${DB_NAME} << 'SQLEOF'
-- ============================================================
--  Net2app v3.3 Schema — All tables created by deploy.sh
--  No manual SQL needed on the server!
-- ============================================================

CREATE TABLE IF NOT EXISTS clients (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
  name VARCHAR(128),
  email VARCHAR(128),
  smpp_ip VARCHAR(64),
  smpp_port INT DEFAULT 9096,
  smpp_username VARCHAR(64),
  smpp_password VARCHAR(128),
  connection_type ENUM('SMPP','HTTP') DEFAULT 'SMPP',
  billing_type ENUM('send','submit','delivery') DEFAULT 'submit',
  force_dlr TINYINT(1) DEFAULT 0,
  force_dlr_timeout INT DEFAULT 30,
  status ENUM('active','inactive','blocked') DEFAULT 'active',
  balance DECIMAL(12,4) DEFAULT 0,
  currency VARCHAR(8) DEFAULT 'USD',
  tps_limit INT DEFAULT 100,
  credit_limit DECIMAL(12,4) DEFAULT 0,
  daily_sms_limit INT DEFAULT 0 COMMENT 'Max SMS per day, 0=unlimited',
  threshold_notify_email VARCHAR(256) COMMENT 'Email for threshold alerts',
  created_at DATETIME DEFAULT NOW(),
  INDEX(tenant_id), INDEX(status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS suppliers (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
  name VARCHAR(128),
  category ENUM('sms','voice_otp','whatsapp','telegram','device','android') DEFAULT 'sms',
  connection_type ENUM('HTTP','SMPP','SIP','SDK','DEVICE','ANDROID') DEFAULT 'SMPP',
  smpp_ip VARCHAR(64),
  smpp_port INT DEFAULT 2775,
  smpp_username VARCHAR(64),
  smpp_password VARCHAR(128),
  http_url TEXT,
  http_method ENUM('GET','POST') DEFAULT 'POST',
  http_params TEXT,
  api_key VARCHAR(256),
  api_secret VARCHAR(256),
  dlr_url TEXT,
  status ENUM('active','inactive','blocked') DEFAULT 'active',
  priority INT DEFAULT 1,
  tps_limit INT DEFAULT 100,
  bind_status VARCHAR(32) DEFAULT 'unknown',
  last_bind_at DATETIME,
  created_at DATETIME DEFAULT NOW(),
  INDEX(tenant_id), INDEX(category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS routes (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
  name VARCHAR(128),
  client_id VARCHAR(64),
  client_name VARCHAR(128),
  supplier_id VARCHAR(64),
  supplier_name VARCHAR(128),
  mcc VARCHAR(8),
  mnc VARCHAR(8),
  country VARCHAR(64),
  network VARCHAR(128),
  prefix VARCHAR(32),
  routing_mode ENUM('LCR','ASR','Priority','Round Robin') DEFAULT 'Priority',
  status ENUM('active','inactive','blocked') DEFAULT 'active',
  fail_count INT DEFAULT 0,
  auto_block_threshold INT DEFAULT 10,
  is_auto_blocked TINYINT(1) DEFAULT 0,
  INDEX(tenant_id), INDEX(mcc, mnc), INDEX(supplier_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sms_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
  message_id VARCHAR(64),
  client_id VARCHAR(64),
  client_name VARCHAR(128),
  supplier_id VARCHAR(64),
  supplier_name VARCHAR(128),
  sender_id VARCHAR(32),
  destination VARCHAR(32),
  mcc VARCHAR(8),
  mnc VARCHAR(8),
  country VARCHAR(64),
  network VARCHAR(128),
  content TEXT,
  status ENUM('pending','sent','delivered','failed','rejected','blocked') DEFAULT 'pending',
  fail_reason VARCHAR(256),
  dest_msg_id VARCHAR(64),
  parts TINYINT DEFAULT 1,
  cost DECIMAL(12,6) DEFAULT 0,
  sell_rate DECIMAL(12,6) DEFAULT 0,
  submit_time DATETIME DEFAULT NOW(),
  delivery_time DATETIME,
  INDEX(tenant_id), INDEX(destination), INDEX(client_id), INDEX(status), INDEX(submit_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS billing_summary (
  id VARCHAR(128) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  period DATE,
  total_sms BIGINT DEFAULT 0,
  total_cost DECIMAL(14,4) DEFAULT 0,
  total_revenue DECIMAL(14,4) DEFAULT 0,
  margin DECIMAL(14,4) DEFAULT 0,
  updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  INDEX(tenant_id, period)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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

-- NEW v3.3: Invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
  invoice_number VARCHAR(64) NOT NULL,
  client_id VARCHAR(64) NOT NULL,
  client_name VARCHAR(128),
  period_start DATE,
  period_end DATE,
  period_type ENUM('daily','weekly','monthly','custom') DEFAULT 'monthly',
  currency VARCHAR(8) DEFAULT 'USD',
  total_sms BIGINT DEFAULT 0,
  total_amount DECIMAL(14,4) DEFAULT 0,
  status ENUM('draft','sent','paid','overdue','cancelled') DEFAULT 'draft',
  notes TEXT,
  breakdown JSON,
  created_at DATETIME DEFAULT NOW(),
  INDEX(tenant_id), INDEX(client_id), INDEX(period_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- NEW v3.3: Supplier health tracking
CREATE TABLE IF NOT EXISTS supplier_health (
  id VARCHAR(64) PRIMARY KEY,
  supplier_id VARCHAR(64) NOT NULL,
  supplier_name VARCHAR(128),
  latency_ms DECIMAL(10,2) DEFAULT 0,
  error_rate DECIMAL(5,2) DEFAULT 0,
  success_rate DECIMAL(5,2) DEFAULT 100,
  total_checked INT DEFAULT 0,
  total_failed INT DEFAULT 0,
  status ENUM('healthy','degraded','critical','unknown') DEFAULT 'unknown',
  auto_disabled TINYINT(1) DEFAULT 0,
  last_checked_at DATETIME,
  threshold_error_rate DECIMAL(5,2) DEFAULT 30,
  threshold_min_messages INT DEFAULT 10,
  updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  INDEX(supplier_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- NEW v3.3: Alert rules
CREATE TABLE IF NOT EXISTS alert_rules (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
  name VARCHAR(128),
  alert_type VARCHAR(64),
  threshold DECIMAL(10,2),
  window_minutes INT DEFAULT 60,
  min_messages INT DEFAULT 10,
  notify_email VARCHAR(512),
  client_id VARCHAR(64),
  client_name VARCHAR(128),
  supplier_id VARCHAR(64),
  supplier_name VARCHAR(128),
  severity ENUM('info','warning','critical') DEFAULT 'warning',
  is_active TINYINT(1) DEFAULT 1,
  last_triggered_at DATETIME,
  cooldown_minutes INT DEFAULT 60,
  created_at DATETIME DEFAULT NOW(),
  INDEX(tenant_id), INDEX(is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
SQLEOF
ok "MariaDB: net2app v3.3 database + ALL tables created (clients, suppliers, routes, sms_log, billing_summary, smpp_users, invoices, supplier_health, alert_rules)"

# ══ STEP 3: Billing Triggers ═════════════════════════════════════════
header "STEP 3: Billing Triggers (Real-Time)"
mysql -u root -p"${DB_ROOT_PASS}" ${DB_NAME} << 'TRIGEOF'
DROP TRIGGER IF EXISTS trg_sms_billing_insert;
DROP TRIGGER IF EXISTS trg_sms_billing_update;
CREATE TRIGGER trg_sms_billing_update
AFTER UPDATE ON sms_log FOR EACH ROW
BEGIN
  DECLARE v_billing_type VARCHAR(16); DECLARE v_force_dlr TINYINT(1);
  DECLARE v_do_client TINYINT(1) DEFAULT 0; DECLARE v_do_supplier TINYINT(1) DEFAULT 0;
  IF NEW.status = OLD.status THEN LEAVE begin; END IF;
  SELECT IFNULL(billing_type,'submit'), IFNULL(force_dlr,0) INTO v_billing_type, v_force_dlr FROM clients WHERE id=NEW.client_id LIMIT 1;
  CASE v_billing_type
    WHEN 'send' THEN IF NEW.status NOT IN ('blocked','pending') THEN SET v_do_client=1; END IF;
    WHEN 'submit' THEN IF NEW.status NOT IN ('failed','rejected','blocked','pending') THEN SET v_do_client=1; END IF;
    WHEN 'delivery' THEN
      IF NEW.status='delivered' THEN SET v_do_client=1; END IF;
      IF v_force_dlr=1 AND NEW.status NOT IN ('failed','rejected','blocked','pending') THEN SET v_do_client=1; END IF;
    ELSE IF NEW.status NOT IN ('failed','rejected','blocked','pending') THEN SET v_do_client=1; END IF;
  END CASE;
  IF NEW.status NOT IN ('failed','rejected','blocked','pending') THEN SET v_do_supplier=1; END IF;
  INSERT INTO billing_summary (id, tenant_id, period, total_sms, total_cost, total_revenue, margin)
  VALUES (CONCAT(NEW.tenant_id,'_',DATE_FORMAT(DATE(NEW.submit_time),'%Y%m%d')),
    NEW.tenant_id, DATE(NEW.submit_time),
    IF(v_do_client,1,0), IF(v_do_supplier,NEW.cost,0),
    IF(v_do_client,NEW.sell_rate,0), IF(v_do_client,NEW.sell_rate,0)-IF(v_do_supplier,NEW.cost,0))
  ON DUPLICATE KEY UPDATE
    total_sms=total_sms+IF(v_do_client,1,0), total_cost=total_cost+IF(v_do_supplier,NEW.cost,0),
    total_revenue=total_revenue+IF(v_do_client,NEW.sell_rate,0),
    margin=margin+IF(v_do_client,NEW.sell_rate,0)-IF(v_do_supplier,NEW.cost,0), updated_at=NOW();
  IF v_do_client=1 THEN UPDATE clients SET balance=balance-NEW.sell_rate WHERE id=NEW.client_id; END IF;
END;
TRIGEOF
ok "Billing triggers created"

# ══ STEP 4: Kannel SMS Gateway ═══════════════════════════════════════
header "STEP 4: Kannel SMS Gateway"
apt-get install -y kannel
mkdir -p /etc/kannel /var/log/kannel
chmod 755 /var/log/kannel

cat > /etc/kannel/kannel.conf << KANNELEOF
group = core
admin-port = 13000
admin-password = ${KANNEL_ADMIN_PASS}
status-password = ${KANNEL_ADMIN_PASS}
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

cat > /etc/systemd/system/kannel-bearerbox.service << 'EOF'
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

cat > /etc/systemd/system/kannel-smsbox.service << 'EOF'
[Unit]
Description=Kannel Smsbox
After=network.target kannel-bearerbox.service
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
pkill -f bearerbox 2>/dev/null || true
pkill -f smsbox   2>/dev/null || true
sleep 2
systemctl start kannel-bearerbox; sleep 4
systemctl start kannel-smsbox; sleep 2
systemctl is-active kannel-bearerbox && ok "Kannel bearerbox: RUNNING" || info "Kannel bearerbox: check logs"
systemctl is-active kannel-smsbox    && ok "Kannel smsbox:    RUNNING" || info "Kannel smsbox: check logs"

# ══ STEP 5: Node.js 20 + PM2 ════════════════════════════════════════
header "STEP 5: Node.js 20 + PM2"
which node &>/dev/null || {
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
}
which pm2 &>/dev/null || npm install -g pm2
ok "Node.js $(node -v) + PM2 ready"

# ══ STEP 6: SMPP API Server ══════════════════════════════════════════
header "STEP 6: Net2app SMPP API Server (v3.3)"
mkdir -p $API_DIR && cd $API_DIR
npm init -y 2>/dev/null | tail -1
npm install express mysql2 cors dotenv 2>&1 | tail -2

cat > $API_DIR/.env << ENVEOF
PORT=5000
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DB=${DB_NAME}
MYSQL_USER=${DB_APP_USER}
MYSQL_PASS=${DB_APP_PASS}
KANNEL_ADMIN_URL=http://127.0.0.1:13000
KANNEL_ADMIN_PASS=${KANNEL_ADMIN_PASS}
API_TOKEN=${API_TOKEN}
ENVEOF
chmod 600 $API_DIR/.env

cat > $API_DIR/server.js << 'SERVEREOF'
require('dotenv').config();
const express  = require('express');
const mysql    = require('mysql2/promise');
const { exec } = require('child_process');
const net      = require('net');
const cors     = require('cors');
const fs       = require('fs');
const app = express();
app.use(cors()); app.use(express.json()); app.use(express.urlencoded({ extended: true }));
const pool = mysql.createPool({ host: process.env.MYSQL_HOST||'localhost', port: parseInt(process.env.MYSQL_PORT)||3306, database: process.env.MYSQL_DB||'net2app', user: process.env.MYSQL_USER||'net2app', password: process.env.MYSQL_PASS||'Telco1988', connectionLimit: 20 });
const auth = (req,res,next) => { const t=(req.headers['authorization']||'').replace('Bearer ',''); const local=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.ip); if(t===process.env.API_TOKEN)return next(); if(req.path.startsWith('/api/dlr')&&local)return next(); if(req.path==='/health')return next(); res.status(401).json({error:'Unauthorized'}); };
app.use(auth);
app.get('/health',(req,res)=>res.json({ok:true,ts:new Date().toISOString(),version:'3.3'}));
app.get('/api/dlr',async(req,res)=>{ const{msgid,status}=req.query; const s=parseInt(status); const st=s===1?'delivered':(s===16?'pending':'failed'); try{ await pool.execute('UPDATE sms_log SET status=?,delivery_time=NOW() WHERE message_id=? OR dest_msg_id=?',[st,msgid,msgid]); res.json({ok:true}); }catch(e){res.status(500).json({error:e.message});} });
app.post('/api/dlr',async(req,res)=>{ const{msgid,status}=req.body; const map={DELIVRD:'delivered',UNDELIV:'failed',REJECTD:'rejected',EXPIRED:'failed',DELETED:'failed'}; const st=map[(status||'').toUpperCase()]||(parseInt(status)===1?'delivered':'failed'); try{ await pool.execute('UPDATE sms_log SET status=?,delivery_time=NOW() WHERE message_id=? OR dest_msg_id=?',[st,msgid,msgid]); res.json({ok:true}); }catch(e){res.status(500).json({error:e.message});} });
app.post('/api/smpp/test',(req,res)=>{ const{host,port}=req.body; if(!host||!port)return res.status(400).json({error:'host and port required'}); const sock=new net.Socket(); const tid=setTimeout(()=>{sock.destroy();res.json({connected:false,reason:'Timeout (5s)'});},5000); sock.connect(parseInt(port),host,()=>{clearTimeout(tid);sock.destroy();res.json({connected:true,reason:'TCP OK'});}); sock.on('error',err=>{clearTimeout(tid);res.json({connected:false,reason:err.message});}); });
app.post('/api/smpp/reload',(req,res)=>{ exec('kill -HUP $(pidof bearerbox) 2>/dev/null || pkill -HUP bearerbox 2>/dev/null',(err)=>{ res.json({ok:!err,message:err?err.message:'Kannel reloaded'}); }); });
app.post('/api/smpp/apply-config',(req,res)=>{ const{config}=req.body; if(!config)return res.status(400).json({error:'config required'}); const bak='/etc/kannel/kannel.conf.bak.'+Date.now(); try{ if(fs.existsSync('/etc/kannel/kannel.conf'))fs.copyFileSync('/etc/kannel/kannel.conf',bak); fs.writeFileSync('/etc/kannel/kannel.conf',config,'utf8'); exec('kill -HUP $(pidof bearerbox) 2>/dev/null || pkill -HUP bearerbox 2>/dev/null',(err)=>{ res.json({ok:true,backup:bak,reloaded:!err}); }); }catch(e){res.status(500).json({error:e.message});} });
app.post('/api/smpp/user/add',async(req,res)=>{ const{client_id,smpp_username,smpp_password,smpp_port}=req.body; try{ await pool.execute("INSERT INTO smpp_users (client_id,smpp_username,smpp_password,smpp_port,status) VALUES (?,?,?,?,'active') ON DUPLICATE KEY UPDATE smpp_password=?,smpp_port=?,status='active',updated_at=NOW()",[client_id,smpp_username,smpp_password,smpp_port||9096,smpp_password,smpp_port||9096]); res.json({ok:true,message:'SMPP user provisioned: '+smpp_username}); }catch(e){res.status(500).json({error:e.message});} });
app.post('/api/smpp/user/remove',async(req,res)=>{ const{client_id,smpp_username}=req.body; try{ await pool.execute("UPDATE smpp_users SET status='inactive' WHERE client_id=? AND smpp_username=?",[client_id,smpp_username]); res.json({ok:true}); }catch(e){res.status(500).json({error:e.message});} });
app.get('/api/billing/dashboard',async(req,res)=>{ const{tenant_id='default'}=req.query; try{ const[rows]=await pool.execute("SELECT COUNT(*) AS total_sms, SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END) AS delivered, SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed, IFNULL(SUM(cost),0) AS total_cost, IFNULL(SUM(sell_rate),0) AS total_revenue FROM sms_log WHERE tenant_id=? AND DATE(submit_time)=CURDATE()",[tenant_id]); res.json({ok:true,data:rows}); }catch(e){res.status(500).json({error:e.message});} });
app.get('/api/supplier/report',async(req,res)=>{ const{tenant_id='default'}=req.query; try{ const[rows]=await pool.execute("SELECT s.id,s.name,s.connection_type,s.status, COUNT(l.id) AS total_sms, SUM(CASE WHEN l.status='delivered' THEN 1 ELSE 0 END) AS delivered, SUM(CASE WHEN l.status IN('failed','rejected') THEN 1 ELSE 0 END) AS failed, IFNULL(SUM(CASE WHEN l.status NOT IN('failed','rejected','blocked','pending') THEN l.cost ELSE 0 END),0) AS total_cost FROM suppliers s LEFT JOIN sms_log l ON l.supplier_id=s.id AND l.tenant_id=? WHERE s.tenant_id=? GROUP BY s.id,s.name,s.connection_type,s.status",[tenant_id,tenant_id]); res.json({ok:true,suppliers:rows}); }catch(e){res.status(500).json({error:e.message});} });
app.get('/api/client/thresholds',async(req,res)=>{ const{tenant_id='default'}=req.query; try{ const[rows]=await pool.execute("SELECT c.id,c.name,c.email,c.daily_sms_limit,c.threshold_notify_email, COUNT(l.id) AS today_count FROM clients c LEFT JOIN sms_log l ON l.client_id=c.id AND DATE(l.submit_time)=CURDATE() WHERE c.tenant_id=? AND c.daily_sms_limit>0 GROUP BY c.id,c.name,c.email,c.daily_sms_limit,c.threshold_notify_email",[tenant_id]); res.json({ok:true,clients:rows}); }catch(e){res.status(500).json({error:e.message});} });
const PORT=process.env.PORT||5000;
app.listen(PORT,'0.0.0.0',async()=>{ console.log('Net2app API v3.3 on port '+PORT); try{await pool.execute('SELECT 1');console.log('MariaDB connected');}catch(e){console.error('MariaDB error:',e.message);} });
SERVEREOF

pm2 delete net2app-api 2>/dev/null || true
pm2 start $API_DIR/server.js --name net2app-api
pm2 save && pm2 startup 2>/dev/null || true
sleep 3
curl -s http://127.0.0.1:5000/health | grep -q 'ok' && ok 'API Server v3.3: RUNNING on :5000' || info 'API Server: check pm2 logs net2app-api'

# ══ STEP 7: Clone & Build Frontend ═══════════════════════════════════
header "STEP 7: Clone & Build Net2app Frontend"
if [ -d "$DEPLOY_DIR/.git" ]; then
  cd $DEPLOY_DIR && git fetch origin && git reset --hard origin/$BRANCH
  ok "Repository updated"
else
  git clone $GITHUB_REPO $DEPLOY_DIR && cd $DEPLOY_DIR
  ok "Repository cloned"
fi
cd $DEPLOY_DIR
npm install --production=false
npm run build
mkdir -p $WEBROOT && cp -r dist/* $WEBROOT/
ok "Frontend built and deployed to $WEBROOT"

# ══ STEP 8: Nginx ════════════════════════════════════════════════════
header "STEP 8: Nginx Web Server"
cat > /etc/nginx/sites-available/net2app << 'NGINXEOF'
server {
    listen 80; server_name _;
    root /var/www/html; index index.html;
    location / { try_files $uri $uri/ /index.html; }
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_connect_timeout 30s; proxy_read_timeout 60s;
    }
    gzip on; gzip_types text/plain application/javascript application/json text/css;
}
NGINXEOF
ln -sf /etc/nginx/sites-available/net2app /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl enable nginx && systemctl reload nginx
ok "Nginx configured and running"

# ══ STEP 9: UFW Firewall ═════════════════════════════════════════════
header "STEP 9: UFW Firewall"
ufw allow 22/tcp       comment "SSH"
ufw allow 80/tcp       comment "HTTP"
ufw allow 443/tcp      comment "HTTPS"
ufw allow 5060/udp     comment "SIP UDP"
ufw allow 5060/tcp     comment "SIP TCP"
ufw allow 10000:20000/udp comment "RTP Audio"
ufw allow 9095:9200/tcp   comment "Tenant SMPP ports"
ufw allow 4000:6000/tcp   comment "Tenant HTTP panels"
ufw allow from 127.0.0.1 to any port 13000 comment "Kannel admin"
ufw allow from 127.0.0.1 to any port 13001 comment "Kannel smsbox"
ufw allow from 127.0.0.1 to any port 13013 comment "Kannel sendsms"
ufw deny 3306          comment "MariaDB localhost only"
echo "y" | ufw enable 2>/dev/null || true
ok "UFW Firewall configured"

# ══ STEP 10: Fail2Ban ════════════════════════════════════════════════
header "STEP 10: Fail2Ban"
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime  = 3600
findtime = 600
maxretry = 5
[sshd]
enabled = true
port    = 22
maxretry = 3
bantime  = 86400
EOF
systemctl enable fail2ban && systemctl restart fail2ban
ok "Fail2Ban configured"

# ══ STEP 11: Save Credentials ════════════════════════════════════════
header "STEP 11: Save Credentials & Verify"
cat > /root/.net2app_credentials << CREDEOF
# Net2app v3.3 Deployment Credentials
DB_HOST=localhost
DB_NAME=${DB_NAME}
DB_USER=${DB_APP_USER}
DB_PASS=${DB_APP_PASS}
KANNEL_ADMIN=http://127.0.0.1:13000
KANNEL_ADMIN_PASS=${KANNEL_ADMIN_PASS}
API_URL=http://127.0.0.1:5000
API_TOKEN=${API_TOKEN}
DEPLOY_DIR=${DEPLOY_DIR}
WEBROOT=${WEBROOT}
CREDEOF
chmod 600 /root/.net2app_credentials

# ══ STEP 12: Health Check ════════════════════════════════════════════
header "STEP 12: Health Check"
systemctl is-active nginx            && ok "Nginx:       RUNNING" || echo "  [!] Nginx: STOPPED"
systemctl is-active mariadb          && ok "MariaDB:     RUNNING" || echo "  [!] MariaDB: STOPPED"
systemctl is-active kannel-bearerbox && ok "Bearerbox:   RUNNING" || echo "  [!] Bearerbox: STOPPED"
systemctl is-active kannel-smsbox    && ok "Smsbox:      RUNNING" || echo "  [!] Smsbox: STOPPED"
pm2 list 2>/dev/null | grep net2app-api | grep -q online && ok "API Server:  RUNNING" || echo "  [!] API Server: STOPPED"
systemctl is-active fail2ban         && ok "Fail2Ban:    RUNNING" || echo "  [!] Fail2Ban: STOPPED"
curl -s http://127.0.0.1:5000/health | grep -q 'ok' && ok "API /health: OK" || echo "  [!] API /health: FAIL"

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  NET2APP v3.3 DEPLOYMENT COMPLETE"
echo "════════════════════════════════════════════════════════════"
echo "  App:  http://$(hostname -I | awk '{print $1}')"
echo "  API:  http://$(hostname -I | awk '{print $1}'):5000"
echo "  Creds: cat /root/.net2app_credentials"
echo ""
echo "  NEW in v3.3:"
echo "  - /api/supplier/report     → Supplier ASR + cost breakdown"
echo "  - /api/client/thresholds   → Daily SMS limit monitoring"
echo "  - invoices table           → Auto-generated monthly invoices"
echo "  - supplier_health table    → Health monitoring"
echo "  - alert_rules table        → Threshold alerting"
echo ""
echo "  SET THESE IN BASE44 DASHBOARD → Settings → Secrets:"
echo "  SERVER_API_URL   = http://$(hostname -I | awk '{print $1}'):5000"
echo "  SERVER_API_TOKEN = ${API_TOKEN}"
echo "  KANNEL_ADMIN_URL = http://$(hostname -I | awk '{print $1}'):13000"
echo "  KANNEL_ADMIN_PASS= ${KANNEL_ADMIN_PASS}"
echo "════════════════════════════════════════════════════════════"
