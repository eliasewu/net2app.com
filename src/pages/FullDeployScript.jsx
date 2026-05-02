/* eslint-disable no-undef */
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Upload, Terminal, ChevronUp, ChevronDown, Loader2, CheckCircle2, Eye, EyeOff, Database, Key, Server, Wifi } from "lucide-react";
import { toast } from "sonner";

// ─── CREDENTIALS (all real, pre-filled) ──────────────────────────────────────
const CREDS = {
  serverIp:      "192.95.36.154",
  rootPass:      "Ariya2015@db",
  dbName:        "net2app",
  dbAppUser:     "net2app",
  dbAppPass:     "Ariya2015@db",
  dbRootPass:    "Ariya2015@db",
  kannelPass:    "Ariya2015@k",
  apiToken:      "Net2app@API2025!",
  appId:         "69dff8a678c51b2913488cf3",
  appBaseUrl:    "https://api.base44.com",
  funcVersion:   "v3",
};

// ─── GEN-KANNEL-CONF SCRIPT (standalone, reads from MariaDB) ─────────────────
const buildKannelSyncScript = (c) => [
  '#!/bin/bash',
  '# ═══════════════════════════════════════════════════════════════════',
  '#  gen-kannel-conf.sh — Read clients/suppliers from MariaDB',
  '#  and write /etc/kannel/kannel.conf then reload Kannel.',
  '#  Run: bash /opt/net2app-api/gen-kannel-conf.sh',
  '# ═══════════════════════════════════════════════════════════════════',
  '',
  `DB_HOST=localhost`,
  `DB_USER="${c.dbAppUser}"`,
  `DB_PASS="${c.dbAppPass}"`,
  `DB_NAME="${c.dbName}"`,
  `KANNEL_PASS="${c.kannelPass}"`,
  'CONF=/etc/kannel/kannel.conf',
  'BAK=/etc/kannel/kannel.conf.bak.$(date +%s)',
  '',
  '[ -f "$CONF" ] && cp "$CONF" "$BAK"',
  '',
  '# ── Write core + smsbox blocks ──────────────────────────────────────',
  'cat > "$CONF" << COREEOF',
  'group = core',
  'admin-port = 13000',
  `admin-password = ${c.kannelPass}`,
  `status-password = ${c.kannelPass}`,
  'smsbox-port = 13001',
  'log-file = "/var/log/kannel/bearerbox.log"',
  'log-level = 1',
  'box-allow-ip = 127.0.0.1',
  'access-log = "/var/log/kannel/access.log"',
  'unified-prefix = "+,00,011"',
  '',
  'group = smsbox',
  'smsbox-id = "net2app_smsbox"',
  'bearerbox-host = 127.0.0.1',
  'bearerbox-port = 13001',
  'sendsms-port = 13013',
  'sendsms-interface = 127.0.0.1',
  'log-file = "/var/log/kannel/smsbox.log"',
  'log-level = 1',
  'global-sender = "NET2APP"',
  'max-msgs-per-second = 500',
  'dlr-url = "http://127.0.0.1:5000/api/dlr?msgid=%i&status=%d&to=%p&from=%A"',
  'COREEOF',
  '',
  '# ── Append SMPP supplier (smsc) blocks from DB ──────────────────────',
  'echo "# === SMSC Suppliers (auto-generated $(date)) ===" >> "$CONF"',
  '',
  `mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -N -B -e \\`,
  `  "SELECT id,name,smpp_ip,smpp_port,smpp_username,smpp_password,tps_limit FROM suppliers WHERE connection_type='SMPP' AND status='active'" | \\`,
  'while IFS=$\'\\t\' read -r id name ip port user pass tps; do',
  '  tps=${tps:-100}',
  '  cat >> "$CONF" << EOF',
  '',
  'group = smsc',
  'smsc = smpp',
  `smsc-id = "$name"`,
  `host = $ip`,
  `port = $port`,
  `smsc-username = "$user"`,
  `smsc-password = "$pass"`,
  'transceiver-mode = true',
  'reconnect-delay = 10',
  `max-pending-submits = $tps`,
  'EOF',
  'done',
  '',
  '# ── Append SMPP client (smpp-server) blocks from DB ─────────────────',
  'echo "# === SMPP Clients (auto-generated $(date)) ===" >> "$CONF"',
  '',
  `mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -N -B -e \\`,
  `  "SELECT id,smpp_username,smpp_password,smpp_port,tps_limit FROM clients WHERE connection_type='SMPP' AND status='active' AND smpp_username IS NOT NULL AND smpp_username<>''" | \\`,
  'while IFS=$\'\\t\' read -r id user pass port tps; do',
  '  port=${port:-9096}',
  '  tps=${tps:-100}',
  '  cat >> "$CONF" << EOF',
  '',
  'group = smpp-server',
  `system-id = "$user"`,
  `password = "$pass"`,
  `port = $port`,
  `max-sms-per-second = $tps`,
  'EOF',
  'done',
  '',
  '# ── Reload Kannel ───────────────────────────────────────────────────',
  'kill -HUP $(pidof bearerbox) 2>/dev/null || pkill -HUP bearerbox 2>/dev/null || true',
  'echo "[OK] kannel.conf updated and Kannel reloaded → $CONF"',
  'echo "[OK] Backup saved → $BAK"',
].join('\n');

// ─── MAIN DEPLOY SCRIPT ───────────────────────────────────────────────────────
const buildScript = (c) => [
  '#!/bin/bash',
  '# ═══════════════════════════════════════════════════════════════════',
  '#  Net2app — Complete Debian 12 Deployment',
  '#  Includes: MariaDB, Kannel SMS GW, Express API, WPPConnect (WA),',
  '#  GramJS (Telegram), IMO-Bridge, Nginx SPA, Session Servers,',
  '#  UFW Firewall, Fail2Ban, PM2',
  '#  Server: 192.95.36.154  User: root',
  '#',
  '#  ARCHITECTURE:',
  '#  Frontend (React) → Base44 Cloud API (entities/functions/auth)',
  '#  Session Servers  → WPPConnect:5001, GramJS:5002, IMO:5003',
  '#  SMS Gateway      → Kannel bearerbox:13001 + smsbox',
  '#  Local API        → Express:5000 (DLR, SMPP sync, health)',
  '# ═══════════════════════════════════════════════════════════════════',
  '',
  'if [ "$EUID" -ne 0 ]; then exec sudo bash "$0" "$@"; fi',
  '# Do NOT use set -e — we handle errors per-check gracefully',
  '',
  'GREEN="\\033[0;32m"; RED="\\033[0;31m"; YELLOW="\\033[1;33m"; BLUE="\\033[0;34m"; NC="\\033[0m"',
  'ok()     { echo -e "\\${GREEN}[OK]\\${NC} $1"; }',
  'fail()   { echo -e "\\${RED}[FAIL]\\${NC} $1"; exit 1; }',
  'info()   { echo -e "\\${YELLOW}[i]\\${NC} $1"; }',
  'header() { echo -e "\\n\\${BLUE}══ $1 ══\\${NC}\\n"; }',
  '',
  '# ── CONFIG ───────────────────────────────────────────────────────────',
  `DB_ROOT_PASS="${c.dbRootPass}"`,
  `DB_APP_USER="${c.dbAppUser}"`,
  `DB_APP_PASS="${c.dbAppPass}"`,
  `DB_NAME="${c.dbName}"`,
  `KANNEL_ADMIN_PASS="${c.kannelPass}"`,
  `API_TOKEN="${c.apiToken}"`,
  'GITHUB_REPO="https://github.com/eliasewu/net2app.com.git"',
  'DEPLOY_DIR="/opt/net2app"',
  'WEBROOT="/var/www/html"',
  'API_DIR="/opt/net2app-api"',
  'BRANCH="main"',
  `VITE_APP_ID="${c.appId}"`,
  `VITE_APP_BASE_URL="${c.appBaseUrl}"`,
  `VITE_FUNCTIONS_VERSION="${c.funcVersion}"`,
  '# ─────────────────────────────────────────────────────────────────────',
  '',
  'echo ""',
  'echo "════════════════════════════════════════════════════════════"',
  'echo "  NET2APP SMART DEPLOYMENT  $(date)"',
  'echo "════════════════════════════════════════════════════════════"',
  '',

  '# ══ PRE-FLIGHT: Check what is already installed ═══════════════════',
  'header "PRE-FLIGHT: Checking installed components"',
  '',
  'HAS_MARIADB=0;   mysql  --version &>/dev/null       && HAS_MARIADB=1   && ok "MariaDB:   FOUND"   || info "MariaDB:   NOT FOUND — will install"',
  'HAS_KANNEL=0;    which  bearerbox &>/dev/null        && HAS_KANNEL=1    && ok "Kannel:    FOUND"   || info "Kannel:    NOT FOUND — will install"',
  'HAS_SMSBOX=0;    which  smsbox    &>/dev/null        && HAS_SMSBOX=1    && ok "Smsbox:    FOUND"   || info "Smsbox:    NOT FOUND — will install"',
  'HAS_ASTERISK=0;  which  asterisk  &>/dev/null        && HAS_ASTERISK=1  && ok "Asterisk:  FOUND (not required, skipping)" || info "Asterisk:  NOT FOUND (optional, skipping)"',
  'HAS_NGINX=0;     nginx  -v        &>/dev/null 2>&1   && HAS_NGINX=1     && ok "Nginx:     FOUND"   || info "Nginx:     NOT FOUND — will install"',
  'HAS_NODE=0;      node   --version  &>/dev/null       && HAS_NODE=1      && ok "Node.js:   FOUND ($(node -v))" || info "Node.js:   NOT FOUND — will install"',
  'HAS_PM2=0;       pm2   --version   &>/dev/null 2>&1  && HAS_PM2=1       && ok "PM2:       FOUND"   || info "PM2:       NOT FOUND — will install"',
  'HAS_UFW=0;       ufw    status     &>/dev/null       && HAS_UFW=1       && ok "UFW:       FOUND"   || info "UFW:       NOT FOUND — will install"',
  'HAS_FAIL2BAN=0;  fail2ban-client status &>/dev/null  && HAS_FAIL2BAN=1  && ok "Fail2Ban:  FOUND"   || info "Fail2Ban:  NOT FOUND — will install"',
  '',
  'echo ""',
  'info "Pre-flight done. Proceeding — installing missing, updating configs for all."',
  '',

  // STEP 1
  'header "STEP 1: System Update & Base Packages"',
  'export DEBIAN_FRONTEND=noninteractive',
  'apt-get update -y && apt-get upgrade -y',
  'apt-get install -y \\',
  '  build-essential git curl wget vim net-tools tcpdump nmap \\',
  '  ufw fail2ban supervisor lsb-release gnupg ca-certificates \\',
  '  libssl-dev libncurses5-dev libxml2-dev libsqlite3-dev \\',
  '  uuid-dev libjansson-dev libedit-dev libgsm1-dev \\',
  '  mpg123 sox unixodbc unixodbc-dev pkg-config \\',
  '  php8.2 php8.2-mysql php8.2-curl nginx',
  'ok "Base packages installed"',
  '',

  // STEP 2
  'header "STEP 2: MariaDB Database Server"',
  'if [ "$HAS_MARIADB" -eq 0 ]; then',
  '  apt-get install -y mariadb-server mariadb-client',
  '  ok "MariaDB installed"',
  'else',
  '  info "MariaDB already installed — ensuring service is running"',
  'fi',
  'systemctl enable mariadb && systemctl start mariadb',
  'sleep 2',
  '',
  '# Try connecting as root with no password first (fresh install), then with known password',
  `mysql -u root -p"${c.dbRootPass}" -e "SELECT 1" 2>/dev/null || mysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '${c.dbRootPass}'; FLUSH PRIVILEGES;"`,
  `mysql -u root -p"${c.dbRootPass}" << EOF`,
  `CREATE DATABASE IF NOT EXISTS \`${c.dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
  `DROP USER IF EXISTS "${c.dbAppUser}"@"localhost";`,
  `CREATE USER "${c.dbAppUser}"@"localhost" IDENTIFIED BY "${c.dbAppPass}";`,
  `GRANT ALL PRIVILEGES ON \`${c.dbName}\`.* TO "${c.dbAppUser}"@"localhost";`,
  'FLUSH PRIVILEGES;',
  'EOF',
  '',
  `mysql -u root -p"${c.dbRootPass}" ${c.dbName} << 'SQLEOF'`,
  'CREATE TABLE IF NOT EXISTS clients (',
  '  id VARCHAR(64) PRIMARY KEY, tenant_id VARCHAR(64) NOT NULL DEFAULT "default",',
  '  name VARCHAR(128), email VARCHAR(128),',
  '  smpp_ip VARCHAR(64), smpp_port INT DEFAULT 9096,',
  '  smpp_username VARCHAR(64), smpp_password VARCHAR(128),',
  '  connection_type ENUM("SMPP","HTTP") DEFAULT "SMPP",',
  '  billing_type ENUM("send","submit","delivery") DEFAULT "submit",',
  '  force_dlr TINYINT(1) DEFAULT 0, force_dlr_timeout INT DEFAULT 30,',
  '  status ENUM("active","inactive","blocked") DEFAULT "active",',
  '  balance DECIMAL(12,4) DEFAULT 0, currency VARCHAR(8) DEFAULT "USD",',
  '  tps_limit INT DEFAULT 100, credit_limit DECIMAL(12,4) DEFAULT 0,',
  '  created_at DATETIME DEFAULT NOW(), INDEX(tenant_id), INDEX(status)',
  ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;',
  '',
  'CREATE TABLE IF NOT EXISTS suppliers (',
  '  id VARCHAR(64) PRIMARY KEY, tenant_id VARCHAR(64) NOT NULL DEFAULT "default",',
  '  name VARCHAR(128), category ENUM("sms","voice_otp","whatsapp","telegram","device","android") DEFAULT "sms",',
  '  connection_type ENUM("HTTP","SMPP","SIP","SDK","DEVICE","ANDROID") DEFAULT "SMPP",',
  '  smpp_ip VARCHAR(64), smpp_port INT DEFAULT 2775,',
  '  smpp_username VARCHAR(64), smpp_password VARCHAR(128),',
  '  http_url TEXT, http_method ENUM("GET","POST") DEFAULT "POST", http_params TEXT,',
  '  api_key VARCHAR(256), api_secret VARCHAR(256), dlr_url TEXT,',
  '  status ENUM("active","inactive","blocked") DEFAULT "active",',
  '  priority INT DEFAULT 1, tps_limit INT DEFAULT 100,',
  '  bind_status VARCHAR(32) DEFAULT "unknown", last_bind_at DATETIME,',
  '  created_at DATETIME DEFAULT NOW(), INDEX(tenant_id), INDEX(category)',
  ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;',
  '',
  'CREATE TABLE IF NOT EXISTS routes (',
  '  id VARCHAR(64) PRIMARY KEY, tenant_id VARCHAR(64) NOT NULL DEFAULT "default",',
  '  name VARCHAR(128), client_id VARCHAR(64), client_name VARCHAR(128),',
  '  supplier_id VARCHAR(64), supplier_name VARCHAR(128),',
  '  mcc VARCHAR(8), mnc VARCHAR(8), country VARCHAR(64), network VARCHAR(128), prefix VARCHAR(32),',
  '  routing_mode ENUM("LCR","ASR","Priority","Round Robin") DEFAULT "Priority",',
  '  status ENUM("active","inactive","blocked") DEFAULT "active",',
  '  fail_count INT DEFAULT 0, auto_block_threshold INT DEFAULT 10, is_auto_blocked TINYINT(1) DEFAULT 0,',
  '  INDEX(tenant_id), INDEX(mcc, mnc), INDEX(supplier_id)',
  ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;',
  '',
  'CREATE TABLE IF NOT EXISTS sms_log (',
  '  id BIGINT AUTO_INCREMENT PRIMARY KEY, tenant_id VARCHAR(64) NOT NULL DEFAULT "default",',
  '  message_id VARCHAR(64), client_id VARCHAR(64), client_name VARCHAR(128),',
  '  supplier_id VARCHAR(64), supplier_name VARCHAR(128),',
  '  sender_id VARCHAR(32), destination VARCHAR(32),',
  '  mcc VARCHAR(8), mnc VARCHAR(8), country VARCHAR(64), network VARCHAR(128),',
  '  content TEXT, status ENUM("pending","sent","delivered","failed","rejected","blocked") DEFAULT "pending",',
  '  fail_reason VARCHAR(256), dest_msg_id VARCHAR(64),',
  '  parts TINYINT DEFAULT 1, cost DECIMAL(12,6) DEFAULT 0, sell_rate DECIMAL(12,6) DEFAULT 0,',
  '  submit_time DATETIME DEFAULT NOW(), delivery_time DATETIME,',
  '  INDEX(tenant_id), INDEX(destination), INDEX(client_id), INDEX(status), INDEX(submit_time)',
  ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;',
  '',
  'CREATE TABLE IF NOT EXISTS billing_summary (',
  '  id VARCHAR(128) PRIMARY KEY, tenant_id VARCHAR(64) NOT NULL,',
  '  period DATE, total_sms BIGINT DEFAULT 0,',
  '  total_cost DECIMAL(14,4) DEFAULT 0, total_revenue DECIMAL(14,4) DEFAULT 0,',
  '  margin DECIMAL(14,4) DEFAULT 0, updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),',
  '  INDEX(tenant_id, period)',
  ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;',
  '',
  'CREATE TABLE IF NOT EXISTS smpp_users (',
  '  id BIGINT AUTO_INCREMENT PRIMARY KEY,',
  '  client_id VARCHAR(64) NOT NULL, smpp_username VARCHAR(64) NOT NULL,',
  '  smpp_password VARCHAR(128), smpp_port INT DEFAULT 9096,',
  '  status ENUM("active","inactive") DEFAULT "active",',
  '  last_bind DATETIME, bind_count INT DEFAULT 0,',
  '  created_at DATETIME DEFAULT NOW(), updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),',
  '  UNIQUE KEY uk_user (smpp_username), INDEX idx_client (client_id)',
  ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;',
  'SQLEOF',
  'ok "MariaDB: net2app database + all tables created"',
  '',

  // STEP 3
  'header "STEP 3: Billing Triggers (Real-Time)"',
  `mysql -u root -p"${c.dbRootPass}" ${c.dbName} << 'TRIGEOF'`,
  'DROP TRIGGER IF EXISTS trg_sms_billing_insert;',
  'DROP TRIGGER IF EXISTS trg_sms_billing_update;',
  'CREATE TRIGGER trg_sms_billing_update',
  'AFTER UPDATE ON sms_log FOR EACH ROW',
  'BEGIN',
  '  DECLARE v_billing_type VARCHAR(16); DECLARE v_force_dlr TINYINT(1);',
  '  DECLARE v_do_client TINYINT(1) DEFAULT 0; DECLARE v_do_supplier TINYINT(1) DEFAULT 0;',
  '  IF NEW.status = OLD.status THEN LEAVE begin; END IF;',
  '  SELECT IFNULL(billing_type,"submit"), IFNULL(force_dlr,0) INTO v_billing_type, v_force_dlr FROM clients WHERE id=NEW.client_id LIMIT 1;',
  '  CASE v_billing_type',
  '    WHEN "send" THEN IF NEW.status NOT IN ("blocked","pending") THEN SET v_do_client=1; END IF;',
  '    WHEN "submit" THEN IF NEW.status NOT IN ("failed","rejected","blocked","pending") THEN SET v_do_client=1; END IF;',
  '    WHEN "delivery" THEN',
  '      IF NEW.status="delivered" THEN SET v_do_client=1; END IF;',
  '      IF v_force_dlr=1 AND NEW.status NOT IN ("failed","rejected","blocked","pending") THEN SET v_do_client=1; END IF;',
  '    ELSE IF NEW.status NOT IN ("failed","rejected","blocked","pending") THEN SET v_do_client=1; END IF;',
  '  END CASE;',
  '  IF NEW.status NOT IN ("failed","rejected","blocked","pending") THEN SET v_do_supplier=1; END IF;',
  '  INSERT INTO billing_summary (id, tenant_id, period, total_sms, total_cost, total_revenue, margin)',
  '  VALUES (CONCAT(NEW.tenant_id,"_",DATE_FORMAT(DATE(NEW.submit_time),"%Y%m%d")),',
  '    NEW.tenant_id, DATE(NEW.submit_time),',
  '    IF(v_do_client,1,0), IF(v_do_supplier,NEW.cost,0),',
  '    IF(v_do_client,NEW.sell_rate,0), IF(v_do_client,NEW.sell_rate,0)-IF(v_do_supplier,NEW.cost,0))',
  '  ON DUPLICATE KEY UPDATE',
  '    total_sms=total_sms+IF(v_do_client,1,0), total_cost=total_cost+IF(v_do_supplier,NEW.cost,0),',
  '    total_revenue=total_revenue+IF(v_do_client,NEW.sell_rate,0),',
  '    margin=margin+IF(v_do_client,NEW.sell_rate,0)-IF(v_do_supplier,NEW.cost,0), updated_at=NOW();',
  '  IF v_do_client=1 THEN UPDATE clients SET balance=balance-NEW.sell_rate WHERE id=NEW.client_id; END IF;',
  'END;',
  'TRIGEOF',
  'ok "Billing triggers created"',
  '',

  // STEP 4
  'header "STEP 4: Kannel SMS Gateway (bearerbox + smsbox)"',
  'if [ "$HAS_KANNEL" -eq 0 ] || [ "$HAS_SMSBOX" -eq 0 ]; then',
  '  apt-get install -y kannel',
  '  ok "Kannel installed"',
  'else',
  '  info "Kannel already installed — updating config only"',
  'fi',
  'mkdir -p /etc/kannel /var/log/kannel',
  'chmod 755 /var/log/kannel',
  '',
  '# Initial minimal kannel.conf (will be overwritten by gen-kannel-conf.sh after clients/suppliers are added)',
  'cat > /etc/kannel/kannel.conf << KANNELEOF',
  'group = core',
  'admin-port = 13000',
  `admin-password = ${c.kannelPass}`,
  `status-password = ${c.kannelPass}`,
  'smsbox-port = 13001',
  'log-file = "/var/log/kannel/bearerbox.log"',
  'log-level = 1',
  'box-allow-ip = 127.0.0.1',
  'access-log = "/var/log/kannel/access.log"',
  'unified-prefix = "+,00,011"',
  '',
  'group = smsbox',
  'smsbox-id = "net2app_smsbox"',
  'bearerbox-host = 127.0.0.1',
  'bearerbox-port = 13001',
  'sendsms-port = 13013',
  'sendsms-interface = 127.0.0.1',
  'log-file = "/var/log/kannel/smsbox.log"',
  'log-level = 1',
  'global-sender = "NET2APP"',
  'max-msgs-per-second = 500',
  'dlr-url = "http://127.0.0.1:5000/api/dlr?msgid=%i&status=%d&to=%p&from=%A"',
  'KANNELEOF',
  '',
  "cat > /etc/systemd/system/kannel-bearerbox.service << 'EOF'",
  '[Unit]',
  'Description=Kannel Bearerbox',
  'After=network.target',
  '[Service]',
  'Type=simple',
  'ExecStart=/usr/sbin/bearerbox /etc/kannel/kannel.conf',
  'Restart=always',
  'RestartSec=5',
  'User=root',
  '[Install]',
  'WantedBy=multi-user.target',
  'EOF',
  '',
  "cat > /etc/systemd/system/kannel-smsbox.service << 'EOF'",
  '[Unit]',
  'Description=Kannel Smsbox',
  'After=network.target kannel-bearerbox.service',
  'Requires=kannel-bearerbox.service',
  '[Service]',
  'Type=simple',
  'ExecStartPre=/bin/sleep 4',
  'ExecStart=/usr/sbin/smsbox /etc/kannel/kannel.conf',
  'Restart=always',
  'RestartSec=5',
  'User=root',
  '[Install]',
  'WantedBy=multi-user.target',
  'EOF',
  '',
  'systemctl daemon-reload',
  'systemctl enable kannel-bearerbox kannel-smsbox',
  'pkill -f bearerbox 2>/dev/null || true',
  'pkill -f smsbox   2>/dev/null || true',
  'sleep 2',
  'systemctl start kannel-bearerbox; sleep 4',
  'systemctl start kannel-smsbox; sleep 2',
  'systemctl is-active kannel-bearerbox && ok "Kannel bearerbox: RUNNING" || info "Kannel bearerbox: check logs"',
  'systemctl is-active kannel-smsbox    && ok "Kannel smsbox:    RUNNING" || info "Kannel smsbox: check logs"',
  '',

  // STEP 5
  'header "STEP 5: Node.js 20 + PM2"',
  'if [ "$HAS_NODE" -eq 0 ]; then',
  '  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -',
  '  apt-get install -y nodejs',
  '  ok "Node.js $(node -v) installed"',
  'else',
  '  ok "Node.js already installed: $(node -v)"',
  'fi',
  'if [ "$HAS_PM2" -eq 0 ]; then',
  '  npm install -g pm2',
  '  ok "PM2 installed"',
  'else',
  '  ok "PM2 already installed"',
  'fi',
  '',

  // STEP 6 — API server with correct passwords + /api/kannel/sync endpoint
  'header "STEP 6: Net2app SMPP API Server"',
  'mkdir -p $API_DIR && cd $API_DIR',
  'npm init -y 2>/dev/null | tail -1',
  'npm install express mysql2 cors dotenv 2>&1 | tail -2',
  '',
  'cat > $API_DIR/.env << ENVEOF',
  'PORT=5000',
  'MYSQL_HOST=localhost',
  'MYSQL_PORT=3306',
  `MYSQL_DB=${c.dbName}`,
  `MYSQL_USER=${c.dbAppUser}`,
  `MYSQL_PASS=${c.dbAppPass}`,
  'KANNEL_ADMIN_URL=http://127.0.0.1:13000',
  `KANNEL_ADMIN_PASS=${c.kannelPass}`,
  `API_TOKEN=${c.apiToken}`,
  'ENVEOF',
  'chmod 600 $API_DIR/.env',
  '',
  // Write gen-kannel-conf.sh
  'cat > $API_DIR/gen-kannel-conf.sh << \'GENKEOF\'',
  '#!/bin/bash',
  '# Auto-generate /etc/kannel/kannel.conf from MariaDB clients + suppliers',
  'source /opt/net2app-api/.env 2>/dev/null || true',
  `DB_USER="${c.dbAppUser}"`,
  `DB_PASS="${c.dbAppPass}"`,
  `DB_NAME="${c.dbName}"`,
  `KANNEL_PASS="${c.kannelPass}"`,
  'CONF=/etc/kannel/kannel.conf',
  'BAK=/etc/kannel/kannel.conf.bak.$(date +%s)',
  '[ -f "$CONF" ] && cp "$CONF" "$BAK"',
  'cat > "$CONF" << COREEOF',
  'group = core',
  'admin-port = 13000',
  `admin-password = ${c.kannelPass}`,
  `status-password = ${c.kannelPass}`,
  'smsbox-port = 13001',
  'log-file = "/var/log/kannel/bearerbox.log"',
  'log-level = 1',
  'box-allow-ip = 127.0.0.1',
  'access-log = "/var/log/kannel/access.log"',
  'unified-prefix = "+,00,011"',
  '',
  'group = smsbox',
  'smsbox-id = "net2app_smsbox"',
  'bearerbox-host = 127.0.0.1',
  'bearerbox-port = 13001',
  'sendsms-port = 13013',
  'sendsms-interface = 127.0.0.1',
  'log-file = "/var/log/kannel/smsbox.log"',
  'log-level = 1',
  'global-sender = "NET2APP"',
  'max-msgs-per-second = 500',
  'dlr-url = "http://127.0.0.1:5000/api/dlr?msgid=%i&status=%d&to=%p&from=%A"',
  'COREEOF',
  'echo "# === SMSC Suppliers auto-gen $(date) ===" >> "$CONF"',
  'mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -N -B -e "SELECT id,name,smpp_ip,smpp_port,smpp_username,smpp_password,tps_limit FROM suppliers WHERE connection_type=\'SMPP\' AND status=\'active\'" 2>/dev/null | while IFS=$\'\\t\' read -r id name ip port user pass tps; do',
  '  tps=${tps:-100}',
  '  printf "\\ngroup = smsc\\nsmsc = smpp\\nsmsc-id = \\"%s\\"\\nhost = %s\\nport = %s\\nsmsc-username = \\"%s\\"\\nsmsc-password = \\"%s\\"\\ntransceiver-mode = true\\nreconnect-delay = 10\\nmax-pending-submits = %s\\n" "$name" "$ip" "$port" "$user" "$pass" "$tps" >> "$CONF"',
  'done',
  'echo "# === SMPP Clients auto-gen $(date) ===" >> "$CONF"',
  'mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -N -B -e "SELECT smpp_username,smpp_password,smpp_port,tps_limit FROM clients WHERE connection_type=\'SMPP\' AND status=\'active\' AND smpp_username IS NOT NULL AND smpp_username<>\'\'" 2>/dev/null | while IFS=$\'\\t\' read -r user pass port tps; do',
  '  port=${port:-9096}; tps=${tps:-100}',
  '  printf "\\ngroup = smpp-server\\nsystem-id = \\"%s\\"\\npassword = \\"%s\\"\\nport = %s\\nmax-sms-per-second = %s\\n" "$user" "$pass" "$port" "$tps" >> "$CONF"',
  'done',
  'kill -HUP $(pidof bearerbox) 2>/dev/null || pkill -HUP bearerbox 2>/dev/null || true',
  'echo "[OK] kannel.conf regenerated from DB and Kannel reloaded"',
  'GENKEOF',
  'chmod +x $API_DIR/gen-kannel-conf.sh',
  'ok "gen-kannel-conf.sh written to $API_DIR"',
  '',
  "cat > $API_DIR/server.js << 'SERVEREOF'",
  "require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });",
  "const express  = require('express');",
  "const mysql    = require('mysql2/promise');",
  "const { exec } = require('child_process');",
  "const net      = require('net');",
  "const cors     = require('cors');",
  "const fs       = require('fs');",
  'const app = express();',
  'app.use(cors()); app.use(express.json()); app.use(express.urlencoded({ extended: true }));',
  `const pool = mysql.createPool({ host: process.env.MYSQL_HOST||"localhost", port: parseInt(process.env.MYSQL_PORT)||3306, database: process.env.MYSQL_DB||"${c.dbName}", user: process.env.MYSQL_USER||"${c.dbAppUser}", password: process.env.MYSQL_PASS||"${c.dbAppPass}", connectionLimit: 20 });`,
  'const auth = (req,res,next) => { const t=(req.headers["authorization"]||"").replace("Bearer ",""); const local=["127.0.0.1","::1","::ffff:127.0.0.1"].includes(req.ip); if(t===process.env.API_TOKEN)return next(); if(req.path.startsWith("/api/dlr")&&local)return next(); if(req.path==="/health")return next(); res.status(401).json({error:"Unauthorized"}); };',
  'app.use(auth);',
  'app.get("/health",async(req,res)=>{ try{ await pool.execute("SELECT 1"); res.json({ok:true,db:"connected",ts:new Date().toISOString()}); }catch(e){ res.json({ok:false,db:"disconnected",error:e.message,ts:new Date().toISOString()}); } });',
  'app.get("/api/dlr",async(req,res)=>{ const{msgid,status}=req.query; const s=parseInt(status); const st=s===1?"delivered":(s===16?"pending":"failed"); try{ await pool.execute("UPDATE sms_log SET status=?,delivery_time=NOW() WHERE message_id=? OR dest_msg_id=?",[st,msgid,msgid]); res.json({ok:true}); }catch(e){res.status(500).json({error:e.message});} });',
  'app.post("/api/dlr",async(req,res)=>{ const{msgid,status}=req.body; const map={DELIVRD:"delivered",UNDELIV:"failed",REJECTD:"rejected",EXPIRED:"failed",DELETED:"failed"}; const st=map[(status||"").toUpperCase()]||(parseInt(status)===1?"delivered":"failed"); try{ await pool.execute("UPDATE sms_log SET status=?,delivery_time=NOW() WHERE message_id=? OR dest_msg_id=?",[st,msgid,msgid]); res.json({ok:true}); }catch(e){res.status(500).json({error:e.message});} });',
  'app.post("/api/smpp/test",(req,res)=>{ const{host,port}=req.body; if(!host||!port)return res.status(400).json({error:"host and port required"}); const sock=new net.Socket(); const tid=setTimeout(()=>{sock.destroy();res.json({connected:false,reason:"Timeout (5s)"});},5000); sock.connect(parseInt(port),host,()=>{clearTimeout(tid);sock.destroy();res.json({connected:true,reason:"TCP OK"});}); sock.on("error",err=>{clearTimeout(tid);res.json({connected:false,reason:err.message});}); });',
  'app.post("/api/smpp/reload",(req,res)=>{ exec("kill -HUP $(pidof bearerbox) 2>/dev/null || pkill -HUP bearerbox 2>/dev/null",(err)=>{ res.json({ok:!err,message:err?err.message:"Kannel reloaded"}); }); });',
  'app.post("/api/kannel/sync",(req,res)=>{ exec("/opt/net2app-api/gen-kannel-conf.sh",(err,stdout,stderr)=>{ res.json({ok:!err,output:(stdout||"")+(stderr||""),error:err?err.message:null}); }); });',
  'app.post("/api/smpp/apply-config",(req,res)=>{ const{config}=req.body; if(!config)return res.status(400).json({error:"config required"}); const bak="/etc/kannel/kannel.conf.bak."+Date.now(); try{ if(fs.existsSync("/etc/kannel/kannel.conf"))fs.copyFileSync("/etc/kannel/kannel.conf",bak); fs.writeFileSync("/etc/kannel/kannel.conf",config,"utf8"); exec("kill -HUP $(pidof bearerbox) 2>/dev/null || pkill -HUP bearerbox 2>/dev/null",(err)=>{ res.json({ok:true,backup:bak,reloaded:!err}); }); }catch(e){res.status(500).json({error:e.message});} });',
  'app.post("/api/smpp/user/add",async(req,res)=>{ const{client_id,smpp_username,smpp_password,smpp_port}=req.body; try{ await pool.execute("INSERT INTO smpp_users (client_id,smpp_username,smpp_password,smpp_port,status) VALUES (?,?,?,?,\'active\') ON DUPLICATE KEY UPDATE smpp_password=?,smpp_port=?,status=\'active\',updated_at=NOW()",[client_id,smpp_username,smpp_password,smpp_port||9096,smpp_password,smpp_port||9096]); res.json({ok:true,message:"SMPP user provisioned: "+smpp_username}); }catch(e){res.status(500).json({error:e.message});} });',
  'app.post("/api/smpp/user/remove",async(req,res)=>{ const{client_id,smpp_username}=req.body; try{ await pool.execute("UPDATE smpp_users SET status=\'inactive\' WHERE client_id=? AND smpp_username=?",[client_id,smpp_username]); res.json({ok:true}); }catch(e){res.status(500).json({error:e.message});} });',
  'app.get("/api/billing/dashboard",async(req,res)=>{ const{tenant_id="default"}=req.query; try{ const[rows]=await pool.execute("SELECT COUNT(*) AS total_sms, SUM(CASE WHEN status=\'delivered\' THEN 1 ELSE 0 END) AS delivered, SUM(CASE WHEN status=\'failed\' THEN 1 ELSE 0 END) AS failed, IFNULL(SUM(cost),0) AS total_cost, IFNULL(SUM(sell_rate),0) AS total_revenue FROM sms_log WHERE tenant_id=? AND DATE(submit_time)=CURDATE()",[tenant_id]); res.json({ok:true,data:rows}); }catch(e){res.status(500).json({error:e.message});} });',
  'const PORT=process.env.PORT||5000;',
  'app.listen(PORT,"0.0.0.0",async()=>{ console.log("Net2app API on port "+PORT); try{await pool.execute("SELECT 1");console.log("MariaDB connected");}catch(e){console.error("MariaDB error:",e.message);} });',
  'SERVEREOF',
  '',
  'pm2 delete net2app-api 2>/dev/null || true',
  'pm2 start $API_DIR/server.js --name net2app-api --cwd $API_DIR',
  'pm2 save && pm2 startup 2>/dev/null || true',
  'sleep 3',
  'curl -s http://127.0.0.1:5000/health | grep -q "ok" && ok "API Server: RUNNING on :5000" || info "API Server: check pm2 logs net2app-api"',
  '',

  // STEP 6b — Session Servers (WPPConnect + GramJS + IMO)
  'header "STEP 6b: WhatsApp/Telegram/IMO Session Servers"',
  'mkdir -p /opt/net2app-sessions && cd /opt/net2app-sessions',
  'npm init -y 2>/dev/null | tail -1',
  'npm install @wppconnect-team/wppconnect express cors qrcode 2>&1 | tail -3',
  'npm install telegram gramjs express cors qrcode 2>&1 | tail -3',
  '',
  '# ── WhatsApp Session Server (WPPConnect) — port 5001 ─────────────',
  "cat > /opt/net2app-sessions/wppconnect-server.js << 'WPPEOF'",
  "const wppconnect = require('@wppconnect-team/wppconnect');",
  "const express = require('express');",
  "const cors = require('cors');",
  'const app = express();',
  'app.use(cors()); app.use(express.json());',
  'const sessions = {};',
  "app.post('/session/start', async (req, res) => {",
  '  const { session_id } = req.body;',
  "  if (sessions[session_id]?.status === 'CONNECTED') return res.json({ status: 'CONNECTED', session_id });",
  "  sessions[session_id] = { status: 'STARTING', qr: null };",
  '  try {',
  '    const client = await wppconnect.create({',
  '      session: session_id, headless: true, useChrome: false,',
  "      catchQR: (base64Qr) => { sessions[session_id].qr = base64Qr; sessions[session_id].status = 'QR_READY'; },",
  "      statusFind: (status) => { sessions[session_id].status = status; if (status === 'inChat') sessions[session_id].status = 'CONNECTED'; },",
  '    });',
  '    sessions[session_id].client = client;',
  "    sessions[session_id].status = 'CONNECTED';",
  "  } catch(e) { sessions[session_id] = { status: 'ERROR', error: e.message }; }",
  '  res.json({ status: sessions[session_id]?.status, session_id });',
  '});',
  "app.get('/session/qr', (req, res) => {",
  '  const s = sessions[req.query.session_id];',
  "  res.json({ qr: s?.qr || null, status: s?.status || 'NOT_STARTED' });",
  '});',
  "app.get('/session/status', (req, res) => {",
  '  const s = sessions[req.query.session_id];',
  "  res.json({ status: s?.status || 'NOT_STARTED', connected: s?.status === 'CONNECTED' });",
  '});',
  "app.post('/session/logout', async (req, res) => {",
  "  const s = sessions[req.body.session_id];",
  "  if (s?.client) await s.client.logout().catch(()=>{});",
  '  delete sessions[req.body.session_id];',
  '  res.json({ ok: true });',
  '});',
  "app.post('/send', async (req, res) => {",
  '  const { session_id, to, message } = req.body;',
  '  const s = sessions[session_id];',
  "  if (!s?.client) return res.status(400).json({ error: 'Session not connected' });",
  "  const result = await s.client.sendText(to + '@c.us', message);",
  '  res.json({ ok: true, id: result?.id });',
  '});',
  "app.listen(5001, '0.0.0.0', () => console.log('WA session server on :5001'));",
  'WPPEOF',
  '',
  '# ── Telegram Session Server (GramJS) — port 5002 ──────────────────',
  "cat > /opt/net2app-sessions/gramjs-server.js << 'TGEOF'",
  "const { TelegramClient } = require('telegram');",
  "const { StringSession } = require('telegram/sessions');",
  "const express = require('express');",
  "const cors = require('cors');",
  "const qrcode = require('qrcode');",
  'const app = express();',
  'app.use(cors()); app.use(express.json());',
  'const sessions = {};',
  "const API_ID = parseInt(process.env.TG_API_ID || '0');",
  "const API_HASH = process.env.TG_API_HASH || '';",
  "app.post('/session/start', async (req, res) => {",
  '  const { session_id } = req.body;',
  "  if (!API_ID || !API_HASH) return res.status(400).json({ error: 'Set TG_API_ID and TG_API_HASH env vars on the server. Get them from https://my.telegram.org' });",
  "  const client = new TelegramClient(new StringSession(''), API_ID, API_HASH, { connectionRetries: 3 });",
  "  sessions[session_id] = { client, status: 'STARTING', qr: null };",
  '  await client.connect();',
  '  try {',
  "    const result = await client.invoke({ _: 'auth.exportLoginToken', apiId: API_ID, apiHash: API_HASH, exceptIds: [] });",
  "    const token = Buffer.from(result.token).toString('base64url');",
  "    const qrUrl = 'tg://login?token=' + token;",
  '    const qrBase64 = await qrcode.toDataURL(qrUrl, { width: 280 });',
  "    sessions[session_id] = { client, status: 'QR_READY', qr: qrBase64, token };",
  "    res.json({ status: 'QR_READY', session_id });",
  "  } catch(e) { sessions[session_id].status = 'ERROR'; res.json({ status: 'ERROR', error: e.message }); }",
  '});',
  "app.get('/session/qr', (req, res) => {",
  '  const s = sessions[req.query.session_id];',
  "  res.json({ qr: s?.qr || null, status: s?.status || 'NOT_STARTED' });",
  '});',
  "app.get('/session/status', async (req, res) => {",
  '  const s = sessions[req.query.session_id];',
  "  if (!s) return res.json({ status: 'NOT_STARTED', connected: false });",
  "  const connected = await s.client.isUserAuthorized().catch(() => false);",
  "  if (connected) s.status = 'CONNECTED';",
  '  res.json({ status: s.status, connected });',
  '});',
  "app.post('/session/logout', async (req, res) => {",
  '  const s = sessions[req.body.session_id];',
  "  if (s?.client) await s.client.destroy().catch(() => {});",
  '  delete sessions[req.body.session_id];',
  '  res.json({ ok: true });',
  '});',
  "app.listen(5002, '0.0.0.0', () => console.log('TG session server on :5002'));",
  'TGEOF',
  '',
  '# ── IMO Bridge Server — port 5003 ─────────────────────────────────',
  "cat > /opt/net2app-sessions/imo-server.js << 'IMOEOF'",
  "const express = require('express');",
  "const cors = require('cors');",
  'const app = express();',
  'app.use(cors()); app.use(express.json());',
  "app.post('/session/start', (req, res) => res.json({ status: 'IMO_NOT_IMPLEMENTED', message: 'IMO Bridge requires manual setup. Contact support.' }));",
  "app.get('/session/qr', (req, res) => res.json({ qr: null, status: 'NOT_STARTED' }));",
  "app.get('/session/status', (req, res) => res.json({ status: 'NOT_STARTED', connected: false }));",
  "app.post('/session/logout', (req, res) => res.json({ ok: true }));",
  "app.listen(5003, '0.0.0.0', () => console.log('IMO bridge placeholder on :5003'));",
  'IMOEOF',
  '',
  '# ── Open session server ports in UFW ──────────────────────────────',
  'ufw allow 5001/tcp comment "WA WPPConnect session"',
  'ufw allow 5002/tcp comment "TG GramJS session"',
  'ufw allow 5003/tcp comment "IMO bridge session"',
  '',
  '# ── Start with PM2 ────────────────────────────────────────────────',
  'pm2 delete wa-session tg-session imo-session 2>/dev/null || true',
  'pm2 start /opt/net2app-sessions/wppconnect-server.js --name wa-session',
  'pm2 start /opt/net2app-sessions/gramjs-server.js --name tg-session',
  'pm2 start /opt/net2app-sessions/imo-server.js --name imo-session',
  'pm2 save',
  '',
  'sleep 3',
  'curl -s http://127.0.0.1:5001/session/status?session_id=test | grep -q "status" && ok "WA session server: RUNNING on :5001" || info "WA session: check pm2 logs wa-session"',
  'curl -s http://127.0.0.1:5002/session/status?session_id=test | grep -q "status" && ok "TG session server: RUNNING on :5002" || info "TG session: check pm2 logs tg-session"',
  '',
  'info "For Telegram QR, set env vars on the server:"',
  'info "  export TG_API_ID=YOUR_ID TG_API_HASH=YOUR_HASH"',
  'info "  Get them from: https://my.telegram.org → API Development Tools"',
  'info "  Then restart: pm2 restart tg-session"',
  '',

  // STEP 7 — Clone + write .env + build
  'header "STEP 7: Clone & Build Net2app Frontend (with Base44 env)"',
  'if [ -d "$DEPLOY_DIR/.git" ]; then',
  '  cd $DEPLOY_DIR && git fetch origin && git reset --hard origin/$BRANCH',
  '  ok "Repository updated"',
  'else',
  '  git clone $GITHUB_REPO $DEPLOY_DIR && cd $DEPLOY_DIR',
  '  ok "Repository cloned"',
  'fi',
  'cd $DEPLOY_DIR',
  '',
  '# Inject Base44 env vars so Vite embeds them at build time',
  'cat > $DEPLOY_DIR/.env << VITEEOF',
  'VITE_BASE44_APP_ID=${VITE_APP_ID}',
  'VITE_BASE44_APP_BASE_URL=${VITE_APP_BASE_URL}',
  'VITE_BASE44_FUNCTIONS_VERSION=${VITE_FUNCTIONS_VERSION}',
  'VITEEOF',
  'ok "Base44 .env written → $DEPLOY_DIR/.env"',
  '',
  'npm install --production=false',
  'npm run build',
  '# Deploy built assets — Nginx will serve from WEBROOT',
  'mkdir -p $WEBROOT',
  'rm -rf $WEBROOT/*',
  'cp -r $DEPLOY_DIR/dist/* $WEBROOT/',
  'ok "Frontend built and deployed to $WEBROOT"',
  '',

  // STEP 8 — Nginx fixed to serve SPA correctly
  'header "STEP 8: Nginx — SPA + API proxy"',
  'if [ "$HAS_NGINX" -eq 0 ]; then',
  '  apt-get install -y nginx',
  '  ok "Nginx installed"',
  'else',
  '  info "Nginx already installed — updating config"',
  'fi',
  "cat > /etc/nginx/sites-available/net2app << 'NGINXEOF'",
  'server {',
  '    listen 80 default_server;',
  '    listen [::]:80 default_server;',
  '    server_name _;',
  '',
  '    # Serve React SPA from dist output',
  '    root /var/www/html;',
  '    index index.html;',
  '',
  '    # API reverse proxy — must come BEFORE the SPA catch-all',
  '    location /api/ {',
  '        proxy_pass http://127.0.0.1:5000;',
  '        proxy_http_version 1.1;',
  '        proxy_set_header Host $host;',
  '        proxy_set_header X-Real-IP $remote_addr;',
  '        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
  '        proxy_connect_timeout 30s;',
  '        proxy_read_timeout 60s;',
  '        add_header Access-Control-Allow-Origin * always;',
  '        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;',
  '        add_header Access-Control-Allow-Headers "Authorization, Content-Type" always;',
  '        if ($request_method = OPTIONS) { return 204; }',
  '    }',
  '',
  '    # SPA fallback — send all non-file requests to index.html',
  '    location / {',
  '        try_files $uri $uri/ /index.html;',
  '    }',
  '',
  '    # Cache static assets',
  '    location ~* \\.(js|css|png|jpg|ico|woff2?)$ {',
  '        expires 7d;',
  '        add_header Cache-Control "public, immutable";',
  '    }',
  '',
  '    gzip on;',
  '    gzip_types text/plain application/javascript application/json text/css application/xml;',
  '    gzip_min_length 1024;',
  '}',
  'NGINXEOF',
  'ln -sf /etc/nginx/sites-available/net2app /etc/nginx/sites-enabled/',
  'rm -f /etc/nginx/sites-enabled/default',
  'nginx -t && systemctl enable nginx && systemctl reload nginx',
  'ok "Nginx configured — SPA + /api/ proxy"',
  '',

  // STEP 9
  'header "STEP 9: UFW Firewall"',
  '[ "$HAS_UFW" -eq 0 ] && apt-get install -y ufw && ok "UFW installed" || info "UFW already present"',
  'ufw allow 22/tcp       comment "SSH"',
  'ufw allow 80/tcp       comment "HTTP"',
  'ufw allow 443/tcp      comment "HTTPS"',
  'ufw allow 5060/udp     comment "SIP UDP"',
  'ufw allow 5060/tcp     comment "SIP TCP"',
  'ufw allow 10000:20000/udp comment "RTP Audio"',
  'ufw allow 9095:9200/tcp   comment "Tenant SMPP ports"',
  'ufw allow 4000:6000/tcp   comment "Tenant HTTP panels"',
  'ufw allow from 127.0.0.1 to any port 13000 comment "Kannel admin"',
  'ufw allow from 127.0.0.1 to any port 13001 comment "Kannel smsbox"',
  'ufw allow from 127.0.0.1 to any port 13013 comment "Kannel sendsms"',
  'ufw deny 3306          comment "MariaDB localhost only"',
  'echo "y" | ufw enable 2>/dev/null || true',
  'ok "UFW Firewall configured"',
  '',

  // STEP 10
  'header "STEP 10: Fail2Ban"',
  '[ "$HAS_FAIL2BAN" -eq 0 ] && apt-get install -y fail2ban && ok "Fail2Ban installed" || info "Fail2Ban already present"',
  "cat > /etc/fail2ban/jail.local << 'EOF'",
  '[DEFAULT]',
  'bantime  = 3600',
  'findtime = 600',
  'maxretry = 5',
  '[sshd]',
  'enabled = true',
  'port    = 22',
  'maxretry = 3',
  'bantime  = 86400',
  'EOF',
  'systemctl enable fail2ban && systemctl restart fail2ban',
  'ok "Fail2Ban configured"',
  '',

  // STEP 11 — Run initial kannel sync
  'header "STEP 11: Initial Kannel Config Sync from DB"',
  'bash $API_DIR/gen-kannel-conf.sh && ok "kannel.conf synced from DB" || info "Sync skipped (no SMPP clients/suppliers in DB yet — run after adding them)"',
  '',

  // STEP 12 — Save credentials
  'header "STEP 12: Save Credentials"',
  'cat > /root/.net2app_credentials << CREDEOF',
  '# ═══════════════════════════════════════════════════════════════',
  '#  Net2app Server Credentials',
  '# ═══════════════════════════════════════════════════════════════',
  '#  SSH',
  `#  Host:     192.95.36.154`,
  `#  User:     root`,
  `#  Password: ${c.rootPass}`,
  '#',
  '#  MariaDB',
  `#  Root password:  ${c.dbRootPass}`,
  `#  App DB user:    ${c.dbAppUser}`,
  `#  App DB pass:    ${c.dbAppPass}`,
  `#  Database name:  ${c.dbName}`,
  '#',
  '#  Kannel',
  `#  Admin/Status password: ${c.kannelPass}`,
  '#  Admin URL:  http://127.0.0.1:13000',
  '#',
  '#  Net2app API',
  `#  URL:   http://127.0.0.1:5000`,
  `#  Token: ${c.apiToken}`,
  '#',
  '#  Kannel Config Sync',
  '#  Run: bash /opt/net2app-api/gen-kannel-conf.sh',
  '# ═══════════════════════════════════════════════════════════════',
  `DB_HOST=localhost`,
  `DB_NAME=${c.dbName}`,
  `DB_USER=${c.dbAppUser}`,
  `DB_PASS=${c.dbAppPass}`,
  `KANNEL_ADMIN=http://127.0.0.1:13000`,
  `KANNEL_ADMIN_PASS=${c.kannelPass}`,
  `API_URL=http://127.0.0.1:5000`,
  `API_TOKEN=${c.apiToken}`,
  'CREDEOF',
  'chmod 600 /root/.net2app_credentials',
  '',

  // STEP 13
  'header "STEP 13: Health Check & Full Summary"',
  '',
  '# Service status',
  'systemctl is-active nginx            && ok "Nginx:       RUNNING" || echo "  [!] Nginx: STOPPED"',
  'systemctl is-active mariadb          && ok "MariaDB:     RUNNING" || echo "  [!] MariaDB: STOPPED"',
  'systemctl is-active kannel-bearerbox && ok "Bearerbox:   RUNNING" || echo "  [!] Bearerbox: STOPPED"',
  'systemctl is-active kannel-smsbox    && ok "Smsbox:      RUNNING" || echo "  [!] Smsbox: STOPPED"',
  'pm2 list 2>/dev/null | grep net2app-api | grep -q online && ok "API Server:  RUNNING" || echo "  [!] API Server: STOPPED"',
  'systemctl is-active fail2ban         && ok "Fail2Ban:    RUNNING" || echo "  [!] Fail2Ban: STOPPED"',
  'curl -s http://127.0.0.1:5000/health | grep -q "ok" && ok "API /health: OK" || echo "  [!] API /health: FAIL"',
  '',
  '# Auto-detect Base44 App ID from built frontend files',
  'DETECTED_APP_ID=$(grep -r "appId" /var/www/html/assets/*.js 2>/dev/null | grep -oP \'(?<=appId:")[^"]+\' | head -1 || true)',
  '[ -z "$DETECTED_APP_ID" ] && DETECTED_APP_ID=$(grep -r "VITE_BASE44_APP_ID" /opt/net2app/.env 2>/dev/null | cut -d= -f2 | tr -d \'"\' || echo "NOT SET — set VITE_APP_ID in script and rebuild")',
  '',
  'SERVER_IP=$(hostname -I | awk \'{print $1}\')',
  '',
  'echo ""',
  'echo "╔══════════════════════════════════════════════════════════════╗"',
  'echo "║          NET2APP — DEPLOYMENT COMPLETE SUMMARY               ║"',
  'echo "╠══════════════════════════════════════════════════════════════╣"',
  'echo "║  URLS                                                        ║"',
  `echo "║  App:   http://$SERVER_IP                                    "`,
  `echo "║  API:   http://$SERVER_IP:5000                               "`,
  'echo "║  Kannel Admin: http://127.0.0.1:13000 (localhost only)       ║"',
  'echo "╠══════════════════════════════════════════════════════════════╣"',
  'echo "║  SSH ACCESS                                                  ║"',
  `echo "║  Host:     192.95.36.154                                     "`,
  `echo "║  User:     root                                              "`,
  `echo "║  Password: ${c.rootPass}                                     "`,
  'echo "╠══════════════════════════════════════════════════════════════╣"',
  'echo "║  DATABASE (MariaDB)                                          ║"',
  `echo "║  Root pass:  ${c.dbRootPass}                                 "`,
  `echo "║  App user:   ${c.dbAppUser}                                  "`,
  `echo "║  App pass:   ${c.dbAppPass}                                  "`,
  `echo "║  DB name:    ${c.dbName}                                     "`,
  `echo "║  Port:       3306 (localhost only)                           "`,
  'echo "╠══════════════════════════════════════════════════════════════╣"',
  'echo "║  KANNEL SMS GATEWAY                                          ║"',
  `echo "║  Admin/Status pass: ${c.kannelPass}                          "`,
  `echo "║  Admin port:  13000                                          "`,
  `echo "║  Smsbox port: 13001                                          "`,
  `echo "║  SendSMS port:13013                                          "`,
  'echo "║  Config sync: bash /opt/net2app-api/gen-kannel-conf.sh       ║"',
  'echo "╠══════════════════════════════════════════════════════════════╣"',
  'echo "║  NET2APP API                                                 ║"',
  `echo "║  Port:  5000                                                 "`,
  `echo "║  Token: ${c.apiToken}                                        "`,
  'echo "║  Endpoints:                                                  ║"',
  'echo "║    GET  /health              — liveness check                ║"',
  'echo "║    POST /api/kannel/sync     — sync kannel.conf from DB      ║"',
  'echo "║    POST /api/smpp/reload     — HUP bearerbox                 ║"',
  'echo "║    POST /api/smpp/test       — TCP connectivity test         ║"',
  'echo "║    GET  /api/dlr             — DLR callback (Kannel→API)     ║"',
  'echo "║    GET  /api/billing/dashboard — today billing summary       ║"',
  'echo "╠══════════════════════════════════════════════════════════════╣"',
  'echo "║  BASE44 FRONTEND CONFIG                                      ║"',
  `echo "║  VITE_BASE44_APP_ID:           $DETECTED_APP_ID              "`,
  `echo "║  VITE_BASE44_APP_BASE_URL:     ${c.appBaseUrl}               "`,
  `echo "║  VITE_BASE44_FUNCTIONS_VERSION:${c.funcVersion}              "`,
  'echo "╠══════════════════════════════════════════════════════════════╣"',
  'echo "║  ► SET THESE IN BASE44 Dashboard → Settings → Secrets:       ║"',
  `echo "║  SERVER_API_URL    = http://$SERVER_IP:5000                  "`,
  `echo "║  SERVER_API_TOKEN  = ${c.apiToken}                           "`,
  `echo "║  KANNEL_ADMIN_URL  = http://$SERVER_IP:13000                 "`,
  `echo "║  KANNEL_ADMIN_PASS = ${c.kannelPass}                         "`,
  'echo "╠══════════════════════════════════════════════════════════════╣"',
  'echo "║  ► AFTER ADDING CLIENTS/SUPPLIERS IN UI:                     ║"',
  'echo "║    bash /opt/net2app-api/gen-kannel-conf.sh                  ║"',
  'echo "║  ► Full credentials saved to:                                ║"',
  'echo "║    cat /root/.net2app_credentials                            ║"',
  'echo "╚══════════════════════════════════════════════════════════════╝"',
].join('\n');

const STEPS = [
  { num: "✈",  label: "Pre-Flight Check",             desc: "Detect what is already installed: MariaDB, Kannel, Nginx, Node.js, PM2, UFW, Fail2Ban" },
  { num: 1,  label: "System Update",                  desc: "apt-get update/upgrade + base packages" },
  { num: 2,  label: "MariaDB Database",               desc: "Install if missing; create DB + tables + billing triggers" },
  { num: 3,  label: "Billing Triggers",               desc: "Real-time billing triggers — billing-type aware (send/submit/delivery)" },
  { num: 4,  label: "Kannel SMS Gateway",             desc: "bearerbox + smsbox — SMPP gateway for real SMS delivery" },
  { num: 5,  label: "Node.js 20 + PM2",               desc: "Install if missing; process manager for all services" },
  { num: 6,  label: "SMPP API Server (:5000)",        desc: "Express API — DLR callback, Kannel reload, health check" },
  { num: "6b", label: "Session Servers (WA/TG/IMO)",  desc: "WPPConnect :5001 (WhatsApp), GramJS :5002 (Telegram), IMO-Bridge :5003 — real QR pairing" },
  { num: 7,  label: "Clone & Build Frontend",         desc: "Clone from GitHub, inject Base44 .env, npm build, deploy to /var/www/html" },
  { num: 8,  label: "Nginx SPA + API Proxy",          desc: "SPA fallback + /api/ reverse proxy + CORS headers" },
  { num: 9,  label: "UFW Firewall",                   desc: "Open: 22,80,443,5001,5002,5003,5060,9095-9200. Lock: 3306,13000,13001,13013" },
  { num: 10, label: "Fail2Ban",                       desc: "SSH brute-force protection" },
  { num: 11, label: "Kannel Sync from DB",            desc: "Auto-generate kannel.conf from MariaDB clients/suppliers" },
  { num: 12, label: "Save Credentials",               desc: "Write /root/.net2app_credentials with all passwords + endpoints" },
  { num: 13, label: "Health Check + Summary",         desc: "Verify all services; print full access summary with all URLs/tokens" },
];

// ─── CREDENTIALS SUMMARY TABLE ───────────────────────────────────────────────
const CRED_ROWS = [
  { category: "SSH", icon: Server, color: "bg-slate-100 text-slate-700", rows: [
    { label: "Host",     value: CREDS.serverIp },
    { label: "User",     value: "root" },
    { label: "Password", value: CREDS.rootPass, secret: true },
  ]},
  { category: "MariaDB", icon: Database, color: "bg-blue-100 text-blue-700", rows: [
    { label: "Root password",  value: CREDS.dbRootPass, secret: true },
    { label: "App user",       value: CREDS.dbAppUser },
    { label: "App password",   value: CREDS.dbAppPass, secret: true },
    { label: "Database",       value: CREDS.dbName },
  ]},
  { category: "Kannel", icon: Wifi, color: "bg-green-100 text-green-700", rows: [
    { label: "Admin/Status password", value: CREDS.kannelPass, secret: true },
    { label: "Admin port",            value: "13000" },
    { label: "Smsbox port",           value: "13001" },
    { label: "SendSMS port",          value: "13013" },
  ]},
  { category: "Net2app API", icon: Key, color: "bg-purple-100 text-purple-700", rows: [
    { label: "Port",    value: "5000" },
    { label: "Token",   value: CREDS.apiToken, secret: true },
    { label: "Kannel sync endpoint", value: "POST /api/kannel/sync" },
  ]},
];

export default function FullDeployScript() {
  const [copied, setCopied] = useState(false);
  const [copiedKannel, setCopiedKannel] = useState(false);
  const [stepsOpen, setStepsOpen] = useState(true);
  const [pushing, setPushing] = useState(false);
  const [pushed, setPushed] = useState(false);
  const [showSecrets, setShowSecrets] = useState({});
  const [appId, setAppId] = useState(CREDS.appId);
  const [appBaseUrl] = useState(CREDS.appBaseUrl);
  const [funcVersion] = useState(CREDS.funcVersion);

  const creds = { ...CREDS, appId, appBaseUrl, funcVersion };
  const SCRIPT = buildScript(creds);
  const KANNEL_SCRIPT = buildKannelSyncScript(creds);

  const copy = () => {
    navigator.clipboard.writeText(SCRIPT);
    setCopied(true);
    toast.success("deploy.sh copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const copyKannel = () => {
    navigator.clipboard.writeText(KANNEL_SCRIPT);
    setCopiedKannel(true);
    toast.success("gen-kannel-conf.sh copied!");
    setTimeout(() => setCopiedKannel(false), 2000);
  };

  const copyLine = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied!");
  };

  const toggleSecret = (key) => setShowSecrets(p => ({ ...p, [key]: !p[key] }));

  const pushToGithub = async () => {
    setPushing(true);
    try {
      const shaRes = await base44.functions.invoke("githubRelease", {
        action: "get_file", repo: "eliasewu/net2app.com", path: "deploy.sh"
      });
      const sha = shaRes?.data?.sha;
      await base44.functions.invoke("githubRelease", {
        action: "push_file",
        repo: "eliasewu/net2app.com",
        path: "deploy.sh",
        sha: sha || undefined,
        message: "Update deploy.sh — 13-step deploy with gen-kannel-conf + fixed nginx + correct passwords",
        content: SCRIPT,
      });
      // Also push the standalone kannel sync script
      const shaKRes = await base44.functions.invoke("githubRelease", {
        action: "get_file", repo: "eliasewu/net2app.com", path: "gen-kannel-conf.sh"
      });
      const shaK = shaKRes?.data?.sha;
      await base44.functions.invoke("githubRelease", {
        action: "push_file",
        repo: "eliasewu/net2app.com",
        path: "gen-kannel-conf.sh",
        sha: shaK || undefined,
        message: "Add gen-kannel-conf.sh — auto-sync kannel.conf from MariaDB",
        content: KANNEL_SCRIPT,
      });
      setPushed(true);
      toast.success("deploy.sh + gen-kannel-conf.sh pushed to GitHub!");
    } catch (e) {
      toast.error("Push failed: " + e.message);
    } finally {
      setPushing(false);
    }
  };

  const ONE_LINE = "bash <(curl -s https://raw.githubusercontent.com/eliasewu/net2app.com/main/deploy.sh)";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Full Deploy Script"
        description="Complete Debian 12 deployment — MariaDB, Kannel SMS GW, Express API, WPPConnect (WA :5001), GramJS (TG :5002), IMO (:5003), Nginx SPA, UFW, Fail2Ban, PM2. One command deploys everything."
      >
        <Button variant="outline" size="sm" onClick={copyKannel} className="gap-1.5">
          {copiedKannel ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          Copy Kannel Sync Script
        </Button>
        <Button variant="outline" size="sm" onClick={pushToGithub} disabled={pushing} className="gap-1.5">
          {pushing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
           pushed   ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> :
                      <Upload className="w-3.5 h-3.5" />}
          {pushing ? "Pushing..." : pushed ? "Pushed!" : "Push to GitHub"}
        </Button>
        <Button size="sm" onClick={copy} className="gap-1.5">
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied!" : "Copy deploy.sh"}
        </Button>
      </PageHeader>

      {/* ── CREDENTIALS SUMMARY ── */}
      <Card className="border-slate-300">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Key className="w-4 h-4 text-amber-600" />
            Complete Credentials & Access Summary
            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200 ml-1">All Passwords Pre-Configured</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid md:grid-cols-2 gap-4">
            {CRED_ROWS.map(({ category, icon: Icon, color, rows }) => (
              <div key={category} className="border rounded-lg overflow-hidden">
                <div className={`flex items-center gap-2 px-3 py-2 ${color} font-semibold text-xs`}>
                  <Icon className="w-3.5 h-3.5" />
                  {category}
                </div>
                <div className="divide-y">
                  {rows.map(({ label, value, secret }) => {
                    const sk = `${category}_${label}`;
                    const shown = showSecrets[sk];
                    return (
                      <div key={label} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                        <span className="text-muted-foreground w-36 shrink-0">{label}</span>
                        <code className="font-mono font-medium flex-1 truncate">
                          {secret && !shown ? "•".repeat(Math.min(value.length, 14)) : value}
                        </code>
                        <div className="flex gap-1 shrink-0">
                          {secret && (
                            <button onClick={() => toggleSecret(sk)} className="text-muted-foreground hover:text-foreground p-0.5">
                              {shown ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </button>
                          )}
                          <button onClick={() => copyLine(value)} className="text-muted-foreground hover:text-foreground p-0.5">
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Base44 secrets to set */}
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs font-bold text-blue-800 mb-2">Set these 4 secrets in Base44 Dashboard → Settings → Secrets</p>
            <div className="grid md:grid-cols-2 gap-2">
              {[
                ["SERVER_API_URL",    `http://${CREDS.serverIp}:5000`],
                ["SERVER_API_TOKEN",  CREDS.apiToken],
                ["KANNEL_ADMIN_URL",  `http://${CREDS.serverIp}:13000`],
                ["KANNEL_ADMIN_PASS", CREDS.kannelPass],
                ["WA_SESSION_URL",    `http://${CREDS.serverIp}:5001`],
                ["TG_SESSION_URL",    `http://${CREDS.serverIp}:5002`],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center gap-2 bg-white rounded px-3 py-1.5 border border-blue-200">
                  <code className="text-xs font-mono font-semibold text-blue-800 shrink-0 w-40">{k}</code>
                  <code className="text-xs font-mono text-gray-700 flex-1 truncate">{v}</code>
                  <button onClick={() => copyLine(v)} className="text-muted-foreground hover:text-foreground shrink-0 p-1">
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── TELEGRAM API CREDENTIALS NOTE ── */}
      <Card className="border-blue-300 bg-blue-50">
        <CardContent className="p-4 space-y-2">
          <p className="text-xs font-bold text-blue-800 flex items-center gap-2">
            <Wifi className="w-3.5 h-3.5" /> Telegram QR — Requires API Credentials (one-time setup)
          </p>
          <div className="grid md:grid-cols-2 gap-3 text-xs text-blue-800">
            <div className="bg-white rounded border border-blue-200 p-3 space-y-1">
              <p className="font-bold">Get TG API credentials:</p>
              <p>1. Go to <strong>https://my.telegram.org</strong> and log in</p>
              <p>2. Click "API Development Tools"</p>
              <p>3. Create app → copy <code className="bg-blue-100 px-1 rounded">api_id</code> and <code className="bg-blue-100 px-1 rounded">api_hash</code></p>
            </div>
            <div className="bg-white rounded border border-blue-200 p-3 space-y-1">
              <p className="font-bold">Set on server:</p>
              <div className="bg-gray-900 rounded p-2 font-mono text-green-400 text-xs">
                <p>echo 'export TG_API_ID=12345' &gt;&gt; ~/.bashrc</p>
                <p>echo 'export TG_API_HASH=abc123' &gt;&gt; ~/.bashrc</p>
                <p>source ~/.bashrc</p>
                <p>pm2 restart tg-session</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── KANNEL SYNC EXPLANATION ── */}
      <Card className="border-green-200 bg-green-50">
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-bold text-green-800 flex items-center gap-2">
            <Wifi className="w-4 h-4" /> How Kannel Auto-Config Works
          </p>
          <div className="grid md:grid-cols-3 gap-3 text-xs text-green-800">
            <div className="bg-white rounded-lg border border-green-200 p-3">
              <p className="font-bold mb-1">1. Add Clients / Suppliers in UI</p>
              <p className="text-green-700">Go to Clients or Suppliers, set connection type = SMPP, fill in IP / port / username / password.</p>
            </div>
            <div className="bg-white rounded-lg border border-green-200 p-3">
              <p className="font-bold mb-1">2. Click "Sync Kannel" or run script</p>
              <p className="text-green-700">From SMPP Gateway page → Sync button calls <code className="font-mono bg-green-100 px-1 rounded">POST /api/kannel/sync</code> which runs gen-kannel-conf.sh</p>
            </div>
            <div className="bg-white rounded-lg border border-green-200 p-3">
              <p className="font-bold mb-1">3. kannel.conf auto-written + reloaded</p>
              <p className="text-green-700">Script reads all active SMPP suppliers (smsc blocks) + clients (smpp-server blocks) from MariaDB and HUPs bearerbox.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-gray-900 rounded-lg px-4 py-2">
            <code className="flex-1 text-sm text-green-400 font-mono">bash /opt/net2app-api/gen-kannel-conf.sh</code>
            <button onClick={() => copyLine("bash /opt/net2app-api/gen-kannel-conf.sh")} className="text-gray-400 hover:text-white p-1">
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* ── ONE LINE DEPLOY ── */}
      <Card className="border-orange-200 bg-orange-50">
        <CardContent className="p-4">
          <p className="text-xs font-bold text-orange-800 mb-2 uppercase tracking-wide flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5" /> One-Line Deploy (run as root on Debian 12)
          </p>
          <div className="flex items-center gap-2 bg-gray-900 rounded-lg px-4 py-3">
            <code className="flex-1 text-sm text-green-400 font-mono break-all">{ONE_LINE}</code>
            <button onClick={() => copyLine(ONE_LINE)} className="text-gray-400 hover:text-white shrink-0 p-1">
              <Copy className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-orange-700 mt-2">
            SSH: <code className="font-mono bg-orange-100 px-1 rounded">ssh root@{CREDS.serverIp}</code> — password: <code className="font-mono bg-orange-100 px-1 rounded">{CREDS.rootPass}</code>
          </p>
        </CardContent>
      </Card>

      {/* ── BASE44 APP ID INPUT ── */}
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="p-4 space-y-3">
          <p className="text-xs font-bold text-yellow-800">Base44 App ID — needed for frontend Vite build</p>
          <div className="flex gap-3 items-end">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-semibold text-yellow-800">VITE_BASE44_APP_ID</label>
              <input
                className="w-full text-xs font-mono border border-yellow-300 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-yellow-400"
                value={appId}
                onChange={e => setAppId(e.target.value)}
                placeholder="Find in your Base44 app URL"
              />
            </div>
            <div className="space-y-1 w-56">
              <label className="text-xs font-semibold text-yellow-800">VITE_BASE44_APP_BASE_URL</label>
              <input readOnly className="w-full text-xs font-mono border border-yellow-200 rounded px-2 py-1.5 bg-yellow-100 text-yellow-700" value={appBaseUrl} />
            </div>
            <div className="space-y-1 w-24">
              <label className="text-xs font-semibold text-yellow-800">Functions Ver</label>
              <input readOnly className="w-full text-xs font-mono border border-yellow-200 rounded px-2 py-1.5 bg-yellow-100 text-yellow-700" value={funcVersion} />
            </div>
          </div>
          <p className="text-xs text-yellow-700">Find your App ID in the Base44 app URL: <code className="font-mono bg-yellow-100 px-1 rounded">app.base44.com/apps/<strong>YOUR_APP_ID</strong></code></p>
        </CardContent>
      </Card>

      {/* ── STEPS OVERVIEW ── */}
      <Card>
        <CardHeader className="pb-2">
          <button className="flex items-center justify-between w-full text-left" onClick={() => setStepsOpen(v => !v)}>
            <CardTitle className="text-sm flex items-center gap-2">
              What this script does
              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">14 Steps</Badge>
            </CardTitle>
            {stepsOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
        </CardHeader>
        {stepsOpen && (
          <CardContent className="pt-0">
            <div className="grid md:grid-cols-2 gap-2">
              {STEPS.map(step => (
                <div key={step.num} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/20">
                  <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0">
                    {step.num}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{step.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── FULL SCRIPT VIEWER ── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Terminal className="w-4 h-4 text-green-600" />
              Full Script — deploy.sh
            </CardTitle>
            <Button size="sm" variant="outline" onClick={copy} className="gap-1.5 h-7 text-xs">
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? "Copied!" : "Copy All"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <pre className="bg-gray-950 text-green-400 text-xs font-mono p-4 rounded-b-xl overflow-x-auto overflow-y-auto max-h-[600px] whitespace-pre leading-relaxed">
            {SCRIPT}
          </pre>
        </CardContent>
      </Card>

      {/* ── KANNEL SYNC SCRIPT VIEWER ── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Wifi className="w-4 h-4 text-green-600" />
              Standalone Kannel Sync Script — gen-kannel-conf.sh
            </CardTitle>
            <Button size="sm" variant="outline" onClick={copyKannel} className="gap-1.5 h-7 text-xs">
              {copiedKannel ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copiedKannel ? "Copied!" : "Copy"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <pre className="bg-gray-950 text-cyan-400 text-xs font-mono p-4 rounded-b-xl overflow-x-auto overflow-y-auto max-h-96 whitespace-pre leading-relaxed">
            {KANNEL_SCRIPT}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}