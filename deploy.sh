#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
#  Net2app — Smart Debian 12 Deployment
#  Checks what is already installed, installs only what is missing,
#  updates config files in all cases.
#  Server: 192.95.36.154  User: root
# ═══════════════════════════════════════════════════════════════════

if [ "$EUID" -ne 0 ]; then exec sudo bash "$0" "$@"; fi
# Do NOT use set -e — we handle errors per-check gracefully

GREEN="\033[0;32m"; RED="\033[0;31m"; YELLOW="\033[1;33m"; BLUE="\033[0;34m"; NC="\033[0m"
ok()     { echo -e "\${GREEN}[OK]\${NC} $1"; }
fail()   { echo -e "\${RED}[FAIL]\${NC} $1"; exit 1; }
info()   { echo -e "\${YELLOW}[i]\${NC} $1"; }
header() { echo -e "\n\${BLUE}══ $1 ══\${NC}\n"; }

# ── CONFIG ───────────────────────────────────────────────────────────
DB_ROOT_PASS="Ariya2015@db"
DB_APP_USER="net2app"
DB_APP_PASS="Ariya2015@db"
DB_NAME="net2app"
KANNEL_ADMIN_PASS="Ariya2015@k"
API_TOKEN="Net2app@API2025!"
GITHUB_REPO="https://github.com/eliasewu/net2app.com.git"
DEPLOY_DIR="/opt/net2app"
WEBROOT="/var/www/html"
API_DIR="/opt/net2app-api"
BRANCH="main"
VITE_APP_ID="YOUR_BASE44_APP_ID"
VITE_APP_BASE_URL="https://api.base44.com"
VITE_FUNCTIONS_VERSION="v3"
# ─────────────────────────────────────────────────────────────────────

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  NET2APP SMART DEPLOYMENT  $(date)"
echo "════════════════════════════════════════════════════════════"

# ══ PRE-FLIGHT: Check what is already installed ═══════════════════
header "PRE-FLIGHT: Checking installed components"

HAS_MARIADB=0;   mysql  --version &>/dev/null       && HAS_MARIADB=1   && ok "MariaDB:   FOUND"   || info "MariaDB:   NOT FOUND — will install"
HAS_KANNEL=0;    which  bearerbox &>/dev/null        && HAS_KANNEL=1    && ok "Kannel:    FOUND"   || info "Kannel:    NOT FOUND — will install"
HAS_SMSBOX=0;    which  smsbox    &>/dev/null        && HAS_SMSBOX=1    && ok "Smsbox:    FOUND"   || info "Smsbox:    NOT FOUND — will install"
HAS_ASTERISK=0;  which  asterisk  &>/dev/null        && HAS_ASTERISK=1  && ok "Asterisk:  FOUND (not required, skipping)" || info "Asterisk:  NOT FOUND (optional, skipping)"
HAS_NGINX=0;     nginx  -v        &>/dev/null 2>&1   && HAS_NGINX=1     && ok "Nginx:     FOUND"   || info "Nginx:     NOT FOUND — will install"
HAS_NODE=0;      node   --version  &>/dev/null       && HAS_NODE=1      && ok "Node.js:   FOUND ($(node -v))" || info "Node.js:   NOT FOUND — will install"
HAS_PM2=0;       pm2   --version   &>/dev/null 2>&1  && HAS_PM2=1       && ok "PM2:       FOUND"   || info "PM2:       NOT FOUND — will install"
HAS_UFW=0;       ufw    status     &>/dev/null       && HAS_UFW=1       && ok "UFW:       FOUND"   || info "UFW:       NOT FOUND — will install"
HAS_FAIL2BAN=0;  fail2ban-client status &>/dev/null  && HAS_FAIL2BAN=1  && ok "Fail2Ban:  FOUND"   || info "Fail2Ban:  NOT FOUND — will install"

echo ""
info "Pre-flight done. Proceeding — installing missing, updating configs for all."

# ══ STEP 1: System Update & Base Packages ════════════════════════
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

# ══ STEP 2: MariaDB Database Server ══════════════════════════════
header "STEP 2: MariaDB Database Server"
if [ "$HAS_MARIADB" -eq 0 ]; then
  apt-get install -y mariadb-server mariadb-client
  ok "MariaDB installed"
else
  info "MariaDB already installed — ensuring service is running"
fi
systemctl enable mariadb && systemctl start mariadb
sleep 2

mysql -u root << EOF
ALTER USER "root"@"localhost" IDENTIFIED BY "Ariya2015@db";
CREATE DATABASE IF NOT EXISTS \`net2app\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS "net2app"@"localhost" IDENTIFIED BY "Ariya2015@db";
GRANT ALL PRIVILEGES ON \`net2app\`.* TO "net2app"@"localhost";
FLUSH PRIVILEGES;
EOF

mysql -u root -p"Ariya2015@db" net2app << 'SQLEOF'
CREATE TABLE IF NOT EXISTS clients (
  id VARCHAR(64) PRIMARY KEY, tenant_id VARCHAR(64) NOT NULL DEFAULT "default",
  name VARCHAR(128), email VARCHAR(128),
  smpp_ip VARCHAR(64), smpp_port INT DEFAULT 9096,
  smpp_username VARCHAR(64), smpp_password VARCHAR(128),
  connection_type ENUM("SMPP","HTTP") DEFAULT "SMPP",
  billing_type ENUM("send","submit","delivery") DEFAULT "submit",
  force_dlr TINYINT(1) DEFAULT 0, force_dlr_timeout INT DEFAULT 30,
  status ENUM("active","inactive","blocked") DEFAULT "active",
  balance DECIMAL(12,4) DEFAULT 0, currency VARCHAR(8) DEFAULT "USD",
  tps_limit INT DEFAULT 100, credit_limit DECIMAL(12,4) DEFAULT 0,
  created_at DATETIME DEFAULT NOW(), INDEX(tenant_id), INDEX(status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS suppliers (
  id VARCHAR(64) PRIMARY KEY, tenant_id VARCHAR(64) NOT NULL DEFAULT "default",
  name VARCHAR(128), category ENUM("sms","voice_otp","whatsapp","telegram","device","android") DEFAULT "sms",
  connection_type ENUM("HTTP","SMPP","SIP","SDK","DEVICE","ANDROID") DEFAULT "SMPP",
  smpp_ip VARCHAR(64), smpp_port INT DEFAULT 2775,
  smpp_username VARCHAR(64), smpp_password VARCHAR(128),
  http_url TEXT, http_method ENUM("GET","POST") DEFAULT "POST", http_params TEXT,
  api_key VARCHAR(256), api_secret VARCHAR(256), dlr_url TEXT,
  status ENUM("active","inactive","blocked") DEFAULT "active",
  priority INT DEFAULT 1, tps_limit INT DEFAULT 100,
  bind_status VARCHAR(32) DEFAULT "unknown", last_bind_at DATETIME,
  created_at DATETIME DEFAULT NOW(), INDEX(tenant_id), INDEX(category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS routes (
  id VARCHAR(64) PRIMARY KEY, tenant_id VARCHAR(64) NOT NULL DEFAULT "default",
  name VARCHAR(128), client_id VARCHAR(64), client_name VARCHAR(128),
  supplier_id VARCHAR(64), supplier_name VARCHAR(128),
  mcc VARCHAR(8), mnc VARCHAR(8), country VARCHAR(64), network VARCHAR(128), prefix VARCHAR(32),
  routing_mode ENUM("LCR","ASR","Priority","Round Robin") DEFAULT "Priority",
  status ENUM("active","inactive","blocked") DEFAULT "active",
  fail_count INT DEFAULT 0, auto_block_threshold INT DEFAULT 10, is_auto_blocked TINYINT(1) DEFAULT 0,
  INDEX(tenant_id), INDEX(mcc, mnc), INDEX(supplier_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sms_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY, tenant_id VARCHAR(64) NOT NULL DEFAULT "default",
  message_id VARCHAR(64), client_id VARCHAR(64), client_name VARCHAR(128),
  supplier_id VARCHAR(64), supplier_name VARCHAR(128),
  sender_id VARCHAR(32), destination VARCHAR(32),
  mcc VARCHAR(8), mnc VARCHAR(8), country VARCHAR(64), network VARCHAR(128),
  content TEXT, status ENUM("pending","sent","delivered","failed","rejected","blocked") DEFAULT "pending",
  fail_reason VARCHAR(256), dest_msg_id VARCHAR(64),
  parts TINYINT DEFAULT 1, cost DECIMAL(12,6) DEFAULT 0, sell_rate DECIMAL(12,6) DEFAULT 0,
  submit_time DATETIME DEFAULT NOW(), delivery_time DATETIME,
  INDEX(tenant_id), INDEX(destination), INDEX(client_id), INDEX(status), INDEX(submit_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS billing_summary (
  id VARCHAR(128) PRIMARY KEY, tenant_id VARCHAR(64) NOT NULL,
  period DATE, total_sms BIGINT DEFAULT 0,
  total_cost DECIMAL(14,4) DEFAULT 0, total_revenue DECIMAL(14,4) DEFAULT 0,
  margin DECIMAL(14,4) DEFAULT 0, updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  INDEX(tenant_id, period)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS smpp_users (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  client_id VARCHAR(64) NOT NULL, smpp_username VARCHAR(64) NOT NULL,
  smpp_password VARCHAR(128), smpp_port INT DEFAULT 9096,
  status ENUM("active","inactive") DEFAULT "active",
  last_bind DATETIME, bind_count INT DEFAULT 0,
  created_at DATETIME DEFAULT NOW(), updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  UNIQUE KEY uk_user (smpp_username), INDEX idx_client (client_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
SQLEOF
ok "MariaDB: net2app database + all tables created"

# ══ STEP 3: Billing Triggers ══════════════════════════════════════
header "STEP 3: Billing Triggers (Real-Time)"
mysql -u root -p"Ariya2015@db" net2app << 'TRIGEOF'
DROP TRIGGER IF EXISTS trg_sms_billing_insert;
DROP TRIGGER IF EXISTS trg_sms_billing_update;
CREATE TRIGGER trg_sms_billing_update
AFTER UPDATE ON sms_log FOR EACH ROW
BEGIN
  DECLARE v_billing_type VARCHAR(16); DECLARE v_force_dlr TINYINT(1);
  DECLARE v_do_client TINYINT(1) DEFAULT 0; DECLARE v_do_supplier TINYINT(1) DEFAULT 0;
  IF NEW.status = OLD.status THEN LEAVE begin; END IF;
  SELECT IFNULL(billing_type,"submit"), IFNULL(force_dlr,0) INTO v_billing_type, v_force_dlr FROM clients WHERE id=NEW.client_id LIMIT 1;
  CASE v_billing_type
    WHEN "send" THEN IF NEW.status NOT IN ("blocked","pending") THEN SET v_do_client=1; END IF;
    WHEN "submit" THEN IF NEW.status NOT IN ("failed","rejected","blocked","pending") THEN SET v_do_client=1; END IF;
    WHEN "delivery" THEN
      IF NEW.status="delivered" THEN SET v_do_client=1; END IF;
      IF v_force_dlr=1 AND NEW.status NOT IN ("failed","rejected","blocked","pending") THEN SET v_do_client=1; END IF;
    ELSE IF NEW.status NOT IN ("failed","rejected","blocked","pending") THEN SET v_do_client=1; END IF;
  END CASE;
  IF NEW.status NOT IN ("failed","rejected","blocked","pending") THEN SET v_do_supplier=1; END IF;
  INSERT INTO billing_summary (id, tenant_id, period, total_sms, total_cost, total_revenue, margin)
  VALUES (CONCAT(NEW.tenant_id,"_",DATE_FORMAT(DATE(NEW.submit_time),"%Y%m%d")),
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

# ══ STEP 4: Kannel SMS Gateway ════════════════════════════════════
header "STEP 4: Kannel SMS Gateway (bearerbox + smsbox)"
if [ "$HAS_KANNEL" -eq 0 ] || [ "$HAS_SMSBOX" -eq 0 ]; then
  apt-get install -y kannel
  ok "Kannel installed"
else
  info "Kannel already installed — updating config only"
fi
mkdir -p /etc/kannel /var/log/kannel
chmod 755 /var/log/kannel

cat > /etc/kannel/kannel.conf << KANNELEOF
group = core
admin-port = 13000
admin-password = Ariya2015@k
status-password = Ariya2015@k
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

# ══ STEP 5: Node.js 20 + PM2 ══════════════════════════════════════
header "STEP 5: Node.js 20 + PM2"
if [ "$HAS_NODE" -eq 0 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
  ok "Node.js $(node -v) installed"
else
  ok "Node.js already installed: $(node -v)"
fi
if [ "$HAS_PM2" -eq 0 ]; then
  npm install -g pm2
  ok "PM2 installed"
else
  ok "PM2 already installed"
fi

# ══ STEP 6: Net2app SMPP API Server ══════════════════════════════
header "STEP 6: Net2app SMPP API Server"
mkdir -p $API_DIR && cd $API_DIR
npm init -y 2>/dev/null | tail -1
npm install express mysql2 cors dotenv 2>&1 | tail -2

cat > $API_DIR/.env << ENVEOF
PORT=5000
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DB=net2app
MYSQL_USER=net2app
MYSQL_PASS=Ariya2015@db
KANNEL_ADMIN_URL=http://127.0.0.1:13000
KANNEL_ADMIN_PASS=Ariya2015@k
API_TOKEN=Net2app@API2025!
ENVEOF
chmod 600 $API_DIR/.env

cat > $API_DIR/gen-kannel-conf.sh << 'GENKEOF'
#!/bin/bash
# Auto-generate /etc/kannel/kannel.conf from MariaDB clients + suppliers
source /opt/net2app-api/.env 2>/dev/null || true
DB_USER="net2app"
DB_PASS="Ariya2015@db"
DB_NAME="net2app"
KANNEL_PASS="Ariya2015@k"
CONF=/etc/kannel/kannel.conf
BAK=/etc/kannel/kannel.conf.bak.$(date +%s)
[ -f "$CONF" ] && cp "$CONF" "$BAK"
cat > "$CONF" << COREEOF
group = core
admin-port = 13000
admin-password = Ariya2015@k
status-password = Ariya2015@k
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
echo "# === SMSC Suppliers auto-gen $(date) ===" >> "$CONF"
mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -N -B -e "SELECT id,name,smpp_ip,smpp_port,smpp_username,smpp_password,tps_limit FROM suppliers WHERE connection_type='SMPP' AND status='active'" 2>/dev/null | while IFS=$'\t' read -r id name ip port user pass tps; do
  tps=${tps:-100}
  printf "\ngroup = smsc\nsmsc = smpp\nsmsc-id = \"%s\"\nhost = %s\nport = %s\nsmsc-username = \"%s\"\nsmsc-password = \"%s\"\ntransceiver-mode = true\nreconnect-delay = 10\nmax-pending-submits = %s\n" "$name" "$ip" "$port" "$user" "$pass" "$tps" >> "$CONF"
done
echo "# === SMPP Clients auto-gen $(date) ===" >> "$CONF"
mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -N -B -e "SELECT smpp_username,smpp_password,smpp_port,tps_limit FROM clients WHERE connection_type='SMPP' AND status='active' AND smpp_username IS NOT NULL AND smpp_username<>''" 2>/dev/null | while IFS=$'\t' read -r user pass port tps; do
  port=${port:-9096}; tps=${tps:-100}
  printf "\ngroup = smpp-server\nsystem-id = \"%s\"\npassword = \"%s\"\nport = %s\nmax-sms-per-second = %s\n" "$user" "$pass" "$port" "$tps" >> "$CONF"
done
kill -HUP $(pidof bearerbox) 2>/dev/null || pkill -HUP bearerbox 2>/dev/null || true
echo "[OK] kannel.conf regenerated from DB and Kannel reloaded"
GENKEOF
chmod +x $API_DIR/gen-kannel-conf.sh
ok "gen-kannel-conf.sh written to $API_DIR"

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
const pool = mysql.createPool({ host: process.env.MYSQL_HOST||"localhost", port: parseInt(process.env.MYSQL_PORT)||3306, database: process.env.MYSQL_DB||"net2app", user: process.env.MYSQL_USER||"net2app", password: process.env.MYSQL_PASS||"Ariya2015@db", connectionLimit: 20 });
const auth = (req,res,next) => { const t=(req.headers["authorization"]||"").replace("Bearer ",""); const local=["127.0.0.1","::1","::ffff:127.0.0.1"].includes(req.ip); if(t===process.env.API_TOKEN)return next(); if(req.path.startsWith("/api/dlr")&&local)return next(); if(req.path==="/health")return next(); res.status(401).json({error:"Unauthorized"}); };
app.use(auth);
app.get("/health",(req,res)=>res.json({ok:true,ts:new Date().toISOString()}));
app.get("/api/dlr",async(req,res)=>{ const{msgid,status}=req.query; const s=parseInt(status); const st=s===1?"delivered":(s===16?"pending":"failed"); try{ await pool.execute("UPDATE sms_log SET status=?,delivery_time=NOW() WHERE message_id=? OR dest_msg_id=?",[st,msgid,msgid]); res.json({ok:true}); }catch(e){res.status(500).json({error:e.message});} });
app.post("/api/dlr",async(req,res)=>{ const{msgid,status}=req.body; const map={DELIVRD:"delivered",UNDELIV:"failed",REJECTD:"rejected",EXPIRED:"failed",DELETED:"failed"}; const st=map[(status||"").toUpperCase()]||(parseInt(status)===1?"delivered":"failed"); try{ await pool.execute("UPDATE sms_log SET status=?,delivery_time=NOW() WHERE message_id=? OR dest_msg_id=?",[st,msgid,msgid]); res.json({ok:true}); }catch(e){res.status(500).json({error:e.message});} });
app.post("/api/smpp/test",(req,res)=>{ const{host,port}=req.body; if(!host||!port)return res.status(400).json({error:"host and port required"}); const sock=new net.Socket(); const tid=setTimeout(()=>{sock.destroy();res.json({connected:false,reason:"Timeout (5s)"});},5000); sock.connect(parseInt(port),host,()=>{clearTimeout(tid);sock.destroy();res.json({connected:true,reason:"TCP OK"});}); sock.on("error",err=>{clearTimeout(tid);res.json({connected:false,reason:err.message});}); });
app.post("/api/smpp/reload",(req,res)=>{ exec("kill -HUP $(pidof bearerbox) 2>/dev/null || pkill -HUP bearerbox 2>/dev/null",(err)=>{ res.json({ok:!err,message:err?err.message:"Kannel reloaded"}); }); });
app.post("/api/kannel/sync",(req,res)=>{ exec("/opt/net2app-api/gen-kannel-conf.sh",(err,stdout,stderr)=>{ res.json({ok:!err,output:(stdout||"")+(stderr||""),error:err?err.message:null}); }); });
app.post("/api/smpp/apply-config",(req,res)=>{ const{config}=req.body; if(!config)return res.status(400).json({error:"config required"}); const bak="/etc/kannel/kannel.conf.bak."+Date.now(); try{ if(fs.existsSync("/etc/kannel/kannel.conf"))fs.copyFileSync("/etc/kannel/kannel.conf",bak); fs.writeFileSync("/etc/kannel/kannel.conf",config,"utf8"); exec("kill -HUP $(pidof bearerbox) 2>/dev/null || pkill -HUP bearerbox 2>/dev/null",(err)=>{ res.json({ok:true,backup:bak,reloaded:!err}); }); }catch(e){res.status(500).json({error:e.message});} });
app.post("/api/smpp/user/add",async(req,res)=>{ const{client_id,smpp_username,smpp_password,smpp_port}=req.body; try{ await pool.execute("INSERT INTO smpp_users (client_id,smpp_username,smpp_password,smpp_port,status) VALUES (?,?,?,?,'active') ON DUPLICATE KEY UPDATE smpp_password=?,smpp_port=?,status='active',updated_at=NOW()",[client_id,smpp_username,smpp_password,smpp_port||9096,smpp_password,smpp_port||9096]); res.json({ok:true,message:"SMPP user provisioned: "+smpp_username}); }catch(e){res.status(500).json({error:e.message});} });
app.post("/api/smpp/user/remove",async(req,res)=>{ const{client_id,smpp_username}=req.body; try{ await pool.execute("UPDATE smpp_users SET status='inactive' WHERE client_id=? AND smpp_username=?",[client_id,smpp_username]); res.json({ok:true}); }catch(e){res.status(500).json({error:e.message});} });
app.get("/api/billing/dashboard",async(req,res)=>{ const{tenant_id="default"}=req.query; try{ const[rows]=await pool.execute("SELECT COUNT(*) AS total_sms, SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END) AS delivered, SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed, IFNULL(SUM(cost),0) AS total_cost, IFNULL(SUM(sell_rate),0) AS total_revenue FROM sms_log WHERE tenant_id=? AND DATE(submit_time)=CURDATE()",[tenant_id]); res.json({ok:true,data:rows}); }catch(e){res.status(500).json({error:e.message});} });
const PORT=process.env.PORT||5000;
app.listen(PORT,"0.0.0.0",async()=>{ console.log("Net2app API on port "+PORT); try{await pool.execute("SELECT 1");console.log("MariaDB connected");}catch(e){console.error("MariaDB error:",e.message);} });
SERVEREOF

pm2 delete net2app-api 2>/dev/null || true
pm2 start $API_DIR/server.js --name net2app-api
pm2 save && pm2 startup 2>/dev/null || true
sleep 3
curl -s http://127.0.0.1:5000/health | grep -q "ok" && ok "API Server: RUNNING on :5000" || info "API Server: check pm2 logs net2app-api"

# ══ STEP 7: Clone & Build Frontend ════════════════════════════════
header "STEP 7: Clone & Build Net2app Frontend (with Base44 env)"
if [ -d "$DEPLOY_DIR/.git" ]; then
  cd $DEPLOY_DIR && git fetch origin && git reset --hard origin/$BRANCH
  ok "Repository updated"
else
  git clone $GITHUB_REPO $DEPLOY_DIR && cd $DEPLOY_DIR
  ok "Repository cloned"
fi
cd $DEPLOY_DIR

cat > $DEPLOY_DIR/.env << VITEEOF
VITE_BASE44_APP_ID=${VITE_APP_ID}
VITE_BASE44_APP_BASE_URL=${VITE_APP_BASE_URL}
VITE_BASE44_FUNCTIONS_VERSION=${VITE_FUNCTIONS_VERSION}
VITEEOF
ok "Base44 .env written → $DEPLOY_DIR/.env"

npm install --production=false
npm run build
mkdir -p $WEBROOT
rm -rf $WEBROOT/*
cp -r $DEPLOY_DIR/dist/* $WEBROOT/
ok "Frontend built and deployed to $WEBROOT"

# ══ STEP 8: Nginx — SPA + API proxy ══════════════════════════════
header "STEP 8: Nginx — SPA + API proxy"
if [ "$HAS_NGINX" -eq 0 ]; then
  apt-get install -y nginx
  ok "Nginx installed"
else
  info "Nginx already installed — updating config"
fi
cat > /etc/nginx/sites-available/net2app << 'NGINXEOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    root /var/www/html;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_connect_timeout 30s;
        proxy_read_timeout 60s;
        add_header Access-Control-Allow-Origin * always;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Authorization, Content-Type" always;
        if ($request_method = OPTIONS) { return 204; }
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|ico|woff2?)$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_types text/plain application/javascript application/json text/css application/xml;
    gzip_min_length 1024;
}
NGINXEOF
ln -sf /etc/nginx/sites-available/net2app /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl enable nginx && systemctl reload nginx
ok "Nginx configured — SPA + /api/ proxy"

# ══ STEP 9: UFW Firewall ══════════════════════════════════════════
header "STEP 9: UFW Firewall"
[ "$HAS_UFW" -eq 0 ] && apt-get install -y ufw && ok "UFW installed" || info "UFW already present"
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

# ══ STEP 10: Fail2Ban ═════════════════════════════════════════════
header "STEP 10: Fail2Ban"
[ "$HAS_FAIL2BAN" -eq 0 ] && apt-get install -y fail2ban && ok "Fail2Ban installed" || info "Fail2Ban already present"
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

# ══ STEP 11: Initial Kannel Config Sync from DB ═══════════════════
header "STEP 11: Initial Kannel Config Sync from DB"
bash $API_DIR/gen-kannel-conf.sh && ok "kannel.conf synced from DB" || info "Sync skipped (no SMPP clients/suppliers in DB yet — run after adding them)"

# ══ STEP 12: Save Credentials ════════════════════════════════════
header "STEP 12: Save Credentials"
cat > /root/.net2app_credentials << CREDEOF
# ═══════════════════════════════════════════════════════════════
#  Net2app Server Credentials
# ═══════════════════════════════════════════════════════════════
#  SSH
#  Host:     192.95.36.154
#  User:     root
#  Password: Telco1988
#
#  MariaDB
#  Root password:  Ariya2015@db
#  App DB user:    net2app
#  App DB pass:    Ariya2015@db
#  Database name:  net2app
#
#  Kannel
#  Admin/Status password: Ariya2015@k
#  Admin URL:  http://127.0.0.1:13000
#
#  Net2app API
#  URL:   http://127.0.0.1:5000
#  Token: Net2app@API2025!
#
#  Kannel Config Sync
#  Run: bash /opt/net2app-api/gen-kannel-conf.sh
# ═══════════════════════════════════════════════════════════════
DB_HOST=localhost
DB_NAME=net2app
DB_USER=net2app
DB_PASS=Ariya2015@db
KANNEL_ADMIN=http://127.0.0.1:13000
KANNEL_ADMIN_PASS=Ariya2015@k
API_URL=http://127.0.0.1:5000
API_TOKEN=Net2app@API2025!
CREDEOF
chmod 600 /root/.net2app_credentials

# ══ STEP 13: Health Check & Full Summary ═════════════════════════
header "STEP 13: Health Check & Full Summary"

systemctl is-active nginx            && ok "Nginx:       RUNNING" || echo "  [!] Nginx: STOPPED"
systemctl is-active mariadb          && ok "MariaDB:     RUNNING" || echo "  [!] MariaDB: STOPPED"
systemctl is-active kannel-bearerbox && ok "Bearerbox:   RUNNING" || echo "  [!] Bearerbox: STOPPED"
systemctl is-active kannel-smsbox    && ok "Smsbox:      RUNNING" || echo "  [!] Smsbox: STOPPED"
pm2 list 2>/dev/null | grep net2app-api | grep -q online && ok "API Server:  RUNNING" || echo "  [!] API Server: STOPPED"
systemctl is-active fail2ban         && ok "Fail2Ban:    RUNNING" || echo "  [!] Fail2Ban: STOPPED"
curl -s http://127.0.0.1:5000/health | grep -q "ok" && ok "API /health: OK" || echo "  [!] API /health: FAIL"

DETECTED_APP_ID=$(grep -r "appId" /var/www/html/assets/*.js 2>/dev/null | grep -oP '(?<=appId:")[^"]+' | head -1 || true)
[ -z "$DETECTED_APP_ID" ] && DETECTED_APP_ID=$(grep -r "VITE_BASE44_APP_ID" /opt/net2app/.env 2>/dev/null | cut -d= -f2 | tr -d '"' || echo "NOT SET — set VITE_APP_ID in script and rebuild")

SERVER_IP=$(hostname -I | awk '{print $1}')

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║          NET2APP — DEPLOYMENT COMPLETE SUMMARY               ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  URLS                                                        ║"
echo "║  App:   http://$SERVER_IP"
echo "║  API:   http://$SERVER_IP:5000"
echo "║  Kannel Admin: http://127.0.0.1:13000 (localhost only)       ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  SSH ACCESS                                                  ║"
echo "║  Host:     192.95.36.154"
echo "║  User:     root"
echo "║  Password: Telco1988"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  DATABASE (MariaDB)                                          ║"
echo "║  Root pass:  Ariya2015@db"
echo "║  App user:   net2app"
echo "║  App pass:   Ariya2015@db"
echo "║  DB name:    net2app"
echo "║  Port:       3306 (localhost only)"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  KANNEL SMS GATEWAY                                          ║"
echo "║  Admin/Status pass: Ariya2015@k"
echo "║  Admin port:  13000"
echo "║  Smsbox port: 13001"
echo "║  SendSMS port:13013"
echo "║  Config sync: bash /opt/net2app-api/gen-kannel-conf.sh       ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  NET2APP API                                                 ║"
echo "║  Port:  5000"
echo "║  Token: Net2app@API2025!"
echo "║  Endpoints:"
echo "║    GET  /health              — liveness check                ║"
echo "║    POST /api/kannel/sync     — sync kannel.conf from DB      ║"
echo "║    POST /api/smpp/reload     — HUP bearerbox                 ║"
echo "║    POST /api/smpp/test       — TCP connectivity test         ║"
echo "║    GET  /api/dlr             — DLR callback (Kannel→API)     ║"
echo "║    GET  /api/billing/dashboard — today billing summary       ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  BASE44 FRONTEND CONFIG                                      ║"
echo "║  VITE_BASE44_APP_ID:           $DETECTED_APP_ID"
echo "║  VITE_BASE44_APP_BASE_URL:     https://api.base44.com"
echo "║  VITE_BASE44_FUNCTIONS_VERSION:v3"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  ► SET THESE IN BASE44 Dashboard → Settings → Secrets:       ║"
echo "║  SERVER_API_URL    = http://$SERVER_IP:5000"
echo "║  SERVER_API_TOKEN  = Net2app@API2025!"
echo "║  KANNEL_ADMIN_URL  = http://$SERVER_IP:13000"
echo "║  KANNEL_ADMIN_PASS = Ariya2015@k"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  ► AFTER ADDING CLIENTS/SUPPLIERS IN UI:                     ║"
echo "║    bash /opt/net2app-api/gen-kannel-conf.sh                  ║"
echo "║  ► Full credentials saved to:                                ║"
echo "║    cat /root/.net2app_credentials                            ║"
echo "╚══════════════════════════════════════════════════════════════╝"
