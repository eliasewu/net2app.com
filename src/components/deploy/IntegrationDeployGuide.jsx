import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Copy, Server, Wifi, Phone, Database, Shield, BookOpen, Users, Settings, GitBranch } from "lucide-react";
import { toast } from "sonner";

function CodeBlock({ label, code, color = "text-green-400" }) {
  return (
    <div className="space-y-1">
      {label && <p className="text-xs font-semibold text-muted-foreground">{label}</p>}
      <div className="relative">
        <pre className={`bg-gray-900 ${color} text-xs font-mono p-4 rounded-lg overflow-x-auto whitespace-pre`}>{code}</pre>
        <Button size="sm" variant="ghost" className="absolute top-2 right-2 text-gray-400 hover:text-white gap-1"
          onClick={() => { navigator.clipboard.writeText(code); toast.success("Copied!"); }}>
          <Copy className="w-3 h-3" />Copy
        </Button>
      </div>
    </div>
  );
}

function InfoBox({ color = "blue", children }) {
  const cls = {
    blue: "bg-blue-50 border-blue-200 text-blue-800",
    orange: "bg-orange-50 border-orange-200 text-orange-800",
    yellow: "bg-yellow-50 border-yellow-300 text-yellow-900",
    red: "bg-red-50 border-red-200 text-red-800",
    green: "bg-green-50 border-green-200 text-green-800",
    purple: "bg-purple-50 border-purple-200 text-purple-800",
  }[color];
  return <div className={`p-3 border rounded-lg text-xs space-y-1 ${cls}`}>{children}</div>;
}

const SCRIPTS = {
  system: `#!/bin/bash
# Net2app – Debian 12 Full Stack Setup
# Run as root: bash setup.sh

apt-get update && apt-get install -y \\
    build-essential git curl wget vim \\
    libssl-dev libncurses5-dev libxml2-dev libsqlite3-dev \\
    uuid-dev libjansson-dev libedit-dev \\
    mariadb-server mariadb-client \\
    kannel kannel-extras \\
    ufw fail2ban net-tools tcpdump nmap \\
    php8.2 php8.2-mysql php8.2-curl \\
    nginx supervisor

# Start core services
systemctl enable mariadb kannel nginx
systemctl start mariadb kannel nginx
echo "✅ System packages installed successfully"`,

  asterisk: `#!/bin/bash
# Install Asterisk 20 LTS on Debian 12

cd /usr/src
wget https://downloads.asterisk.org/pub/telephony/asterisk/asterisk-20-current.tar.gz
tar xzf asterisk-20-current.tar.gz
cd asterisk-20*/

contrib/scripts/install_prereq install
./configure --with-jansson-bundled
make menuselect  # Enable: chan_sip, chan_pjsip, app_dial, cdr_mysql, res_odbc
make -j$(nproc)
make install && make samples && make config
ldconfig

systemctl enable asterisk
systemctl start asterisk
asterisk -rx "core show version"`,

  kannel_core: `# /etc/kannel/kannel.conf
# ═══════════════════════════════════════════════════════════════════
#  Net2app Kannel — bearerbox + smsbox configuration
#  Kannel acts as BOTH:
#    • SMPP SERVER  — tenants/clients connect TO us via SMPP bind
#    • SMPP CLIENT  — we connect OUT to upstream SMPP suppliers
#    • HTTP SERVER  — accept HTTP submit from tenant panels
#    • HTTP CLIENT  — forward to HTTP API suppliers
# ═══════════════════════════════════════════════════════════════════

# ── Core (bearerbox) ─────────────────────────────────────────────
group = core
admin-port = 13000
admin-password = CHANGE_ADMIN_PASSWORD
status-password = CHANGE_STATUS_PASSWORD
log-file = "/var/log/kannel/bearerbox.log"
log-level = 1
box-allow-ip = 127.0.0.1
access-log = "/var/log/kannel/access.log"
unified-prefix = "+,00,011"
# Allow bearerbox to listen for incoming SMPP client binds
# Each tenant gets a dedicated port (9096, 9097, ...)
# Configured per-tenant below in smpp-server blocks

# ── SMSbox ────────────────────────────────────────────────────────
group = smsbox
smsbox-id = "net2app_smsbox"
bearerbox-host = 127.0.0.1
bearerbox-port = 13000
sendsms-port = 13013
sendsms-interface = 127.0.0.1
log-file = "/var/log/kannel/smsbox.log"
log-level = 1
global-sender = "NET2APP"
max-msgs-per-second = 500

# ── SMPP Upstream Supplier (smsc group = outbound) ───────────────
group = smsc
smsc = smpp
smsc-id = "supplier_main"
host = "smpp.yoursupplier.com"
port = 2775
smsc-username = "your_login"
smsc-password = "your_pass"
system-type = "SMPP"
transceiver-mode = 1
max-pending-submits = 20
throughput = 200
reconnect-delay = 10
log-file = "/var/log/kannel/supplier_main.log"

# ── HTTP Upstream Supplier ────────────────────────────────────────
group = smsc
smsc = http
smsc-id = "supplier_http"
smsc-url = "https://api.yoursupplier.com/send"
username = "api_user"
password = "api_pass"
throughput = 100`,

  kannel_tenants: `# ════════════════════════════════════════════════════════════════
#  TENANT SMPP SERVER BLOCKS — Clients connect TO these ports
#  Add this section for each tenant created in Net2app dashboard
# ════════════════════════════════════════════════════════════════

# ── Tenant 1 Example ─────────────────────────────────────────────
# DLR MODE: REAL
group = smpp-server
smpp-server-id = tenant1_acme
port = 9096
system-id = acme_user
password = SecurePass123!
system-type = ""
log-file = "/var/log/kannel/tenant1_acme_smpp.log"
log-level = 1

# ── Tenant 2 Example ─────────────────────────────────────────────
# DLR MODE: ALL SUCCESS — message_state forced to 1 (DELIVERED)
group = smpp-server
smpp-server-id = tenant2_xyz
port = 9097
system-id = xyz_user
password = AnotherPass!
system-type = ""
log-file = "/var/log/kannel/tenant2_xyz_smpp.log"
log-level = 1

# NOTE: After creating tenants in dashboard → Tenant Management → Kannel Config tab
# Copy the auto-generated blocks and append here, then:
#   killall -HUP bearerbox   (reload without downtime)`,

  kannel_http: `# HTTP Send API (smsbox sendsms endpoint)
# Clients can POST/GET to submit SMS via HTTP:
#
# POST http://SERVER_IP:13013/cgi-bin/sendsms
# Parameters:
#   username=smsgw  password=PASS  from=SENDER  to=880XXXXXXXX  text=Hello
#
# For tenant HTTP ports (4000-6000), use nginx reverse proxy:

# /etc/nginx/sites-available/tenant_http
server {
    listen 4000;
    location / {
        proxy_pass http://127.0.0.1:13013;
        proxy_set_header Host $host;
        # Inject tenant credentials via header or URL rewrite
    }
}

# ── DLR Callback (Kannel → Net2app backend) ──────────────────────
# In kannel.conf smsbox group, add:
# dlr-url = "http://127.0.0.1:8080/dlr?msgid=%i&status=%d&to=%p"`,

  bearerbox_simbox: `#!/bin/bash
# ── SIM Box / Bearer Box Integration ────────────────────────────
# For SIM Box hardware (BearBox, GoIP, Hybertone, Dinstar):
# Each SIM card appears as an SMSC in Kannel.
# The SIM box connects to bearerbox via AT modem or custom SMPP.

# Option A: AT Modem (serial/USB SIM box)
group = smsc
smsc = at
smsc-id = "simbox_slot1"
device = /dev/ttyUSB0
speed = 115200
sms-center = "+8801XXXXXXXXX"
throughput = 3

# Option B: SMPP SIM box (GoIP/BearBox sends SMPP to us)
# SIM box connects TO our bearerbox port 9095
group = smsc
smsc = smpp
smsc-id = "simbox_goip1"
host = "192.168.1.200"   # SIM box IP
port = 7777              # SIM box SMPP port
smsc-username = "goip_user"
smsc-password = "goip_pass"
transceiver-mode = 1
throughput = 10

# ── Reload bearerbox after config changes ────────────────────────
# killall -HUP bearerbox
# Or: systemctl reload kannel`,

  mariadb_master: `#!/bin/bash
# ══════════════════════════════════════════════════════════════════
#  MariaDB — Master Database Setup for Net2app
#  One shared server, per-tenant databases + global tables
# ══════════════════════════════════════════════════════════════════

mysql -u root << 'EOF'

-- ── Global Super Admin Database ──────────────────────────────────
CREATE DATABASE IF NOT EXISTS net2app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'net2app'@'localhost' IDENTIFIED BY 'STRONG_PASSWORD_CHANGE_ME';
GRANT ALL PRIVILEGES ON net2app.* TO 'net2app'@'localhost';

-- ── Platform-wide tables (shared) ────────────────────────────────
USE net2app;

-- SMS Clients
CREATE TABLE IF NOT EXISTS clients (
  id           VARCHAR(64) PRIMARY KEY,
  tenant_id    VARCHAR(64) NOT NULL,
  name         VARCHAR(128),
  email        VARCHAR(128),
  smpp_ip      VARCHAR(64),
  smpp_port    INT,
  smpp_username VARCHAR(64),
  smpp_password VARCHAR(128),
  connection_type ENUM('SMPP','HTTP') DEFAULT 'SMPP',
  status       ENUM('active','inactive','blocked') DEFAULT 'active',
  balance      DECIMAL(12,4) DEFAULT 0,
  currency     VARCHAR(8) DEFAULT 'USD',
  created_at   DATETIME DEFAULT NOW(),
  INDEX(tenant_id), INDEX(status)
) ENGINE=InnoDB;

-- SMS Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id           VARCHAR(64) PRIMARY KEY,
  tenant_id    VARCHAR(64) NOT NULL,
  name         VARCHAR(128),
  connection_type ENUM('HTTP','SMPP','SIP') DEFAULT 'HTTP',
  smpp_ip      VARCHAR(64),
  smpp_port    INT DEFAULT 2775,
  smpp_username VARCHAR(64),
  smpp_password VARCHAR(128),
  http_url     TEXT,
  api_key      VARCHAR(256),
  status       ENUM('active','inactive','blocked') DEFAULT 'active',
  priority     INT DEFAULT 1,
  tps_limit    INT DEFAULT 100,
  created_at   DATETIME DEFAULT NOW(),
  INDEX(tenant_id)
) ENGINE=InnoDB;

-- Routes
CREATE TABLE IF NOT EXISTS routes (
  id           VARCHAR(64) PRIMARY KEY,
  tenant_id    VARCHAR(64) NOT NULL,
  name         VARCHAR(128),
  client_id    VARCHAR(64),
  supplier_id  VARCHAR(64),
  mcc          VARCHAR(8),
  mnc          VARCHAR(8),
  country      VARCHAR(64),
  network      VARCHAR(128),
  prefix       VARCHAR(32),
  routing_mode ENUM('LCR','ASR','Priority','Round Robin') DEFAULT 'Priority',
  status       ENUM('active','inactive','blocked') DEFAULT 'active',
  INDEX(tenant_id), INDEX(mcc, mnc)
) ENGINE=InnoDB;

-- Rates (client + supplier)
CREATE TABLE IF NOT EXISTS rates (
  id           VARCHAR(64) PRIMARY KEY,
  tenant_id    VARCHAR(64) NOT NULL,
  type         ENUM('client','supplier','voice') NOT NULL,
  entity_id    VARCHAR(64),
  entity_name  VARCHAR(128),
  mcc          VARCHAR(8),
  mnc          VARCHAR(8),
  country      VARCHAR(64),
  network      VARCHAR(128),
  prefix       VARCHAR(32),
  rate         DECIMAL(12,6) DEFAULT 0,
  currency     VARCHAR(8) DEFAULT 'USD',
  status       ENUM('active','inactive','scheduled') DEFAULT 'active',
  effective_from DATETIME,
  effective_until DATETIME,
  version      INT DEFAULT 1,
  INDEX(tenant_id, type, entity_id, mcc, mnc)
) ENGINE=InnoDB;

-- SMS Log (CDR for SMS)
CREATE TABLE IF NOT EXISTS sms_log (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  tenant_id    VARCHAR(64) NOT NULL,
  message_id   VARCHAR(64),
  client_id    VARCHAR(64),
  client_name  VARCHAR(128),
  supplier_id  VARCHAR(64),
  supplier_name VARCHAR(128),
  sender_id    VARCHAR(32),
  destination  VARCHAR(32),
  mcc          VARCHAR(8),
  mnc          VARCHAR(8),
  country      VARCHAR(64),
  network      VARCHAR(128),
  content      TEXT,
  status       ENUM('pending','sent','delivered','failed','rejected','blocked') DEFAULT 'pending',
  fail_reason  VARCHAR(256),
  dest_msg_id  VARCHAR(64),
  parts        TINYINT DEFAULT 1,
  cost         DECIMAL(12,6) DEFAULT 0,
  sell_rate    DECIMAL(12,6) DEFAULT 0,
  submit_time  DATETIME DEFAULT NOW(),
  delivery_time DATETIME,
  dlr_mode     ENUM('real','fake_success') DEFAULT 'real',
  INDEX(tenant_id), INDEX(destination), INDEX(client_id), INDEX(status), INDEX(submit_time)
) ENGINE=InnoDB;

-- Voice CDR (Asterisk)
CREATE TABLE IF NOT EXISTS cdr (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  tenant_id    VARCHAR(64),
  calldate     DATETIME NOT NULL DEFAULT NOW(),
  clid         VARCHAR(80),
  src          VARCHAR(80),
  dst          VARCHAR(80),
  dcontext     VARCHAR(80),
  channel      VARCHAR(80),
  dstchannel   VARCHAR(80),
  lastapp      VARCHAR(80),
  lastdata     VARCHAR(80),
  duration     INT,
  billsec      INT,
  disposition  VARCHAR(45),
  amaflags     INT,
  accountcode  VARCHAR(20),
  uniqueid     VARCHAR(32) NOT NULL,
  buy_rate     DECIMAL(10,6) DEFAULT 0,
  sell_rate    DECIMAL(10,6) DEFAULT 0,
  cost         DECIMAL(12,6) DEFAULT 0,
  INDEX(tenant_id), INDEX(calldate), INDEX(src), INDEX(dst)
) ENGINE=InnoDB;

-- IP Access
CREATE TABLE IF NOT EXISTS ip_access (
  id           VARCHAR(64) PRIMARY KEY,
  tenant_id    VARCHAR(64),
  ip_address   VARCHAR(64),
  list_type    ENUM('whitelist','blacklist','web_blacklist') DEFAULT 'whitelist',
  entity_type  ENUM('client','supplier','admin','global') DEFAULT 'global',
  entity_id    VARCHAR(64),
  is_active    TINYINT(1) DEFAULT 1,
  hit_count    INT DEFAULT 0,
  created_at   DATETIME DEFAULT NOW(),
  INDEX(tenant_id, ip_address)
) ENGINE=InnoDB;

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id           VARCHAR(64) PRIMARY KEY,
  tenant_id    VARCHAR(64) NOT NULL,
  invoice_number VARCHAR(32),
  client_id    VARCHAR(64),
  client_name  VARCHAR(128),
  period_start DATE,
  period_end   DATE,
  total_sms    BIGINT DEFAULT 0,
  total_amount DECIMAL(14,4) DEFAULT 0,
  currency     VARCHAR(8) DEFAULT 'USD',
  status       ENUM('draft','sent','paid','overdue','cancelled') DEFAULT 'draft',
  breakdown    JSON,
  created_at   DATETIME DEFAULT NOW(),
  INDEX(tenant_id, client_id)
) ENGINE=InnoDB;

-- Billing summary (real-time update via trigger)
CREATE TABLE IF NOT EXISTS billing_summary (
  id           VARCHAR(64) PRIMARY KEY,
  tenant_id    VARCHAR(64) NOT NULL,
  period       DATE,
  total_sms    BIGINT DEFAULT 0,
  total_cost   DECIMAL(14,4) DEFAULT 0,
  total_revenue DECIMAL(14,4) DEFAULT 0,
  margin       DECIMAL(14,4) DEFAULT 0,
  updated_at   DATETIME DEFAULT NOW() ON UPDATE NOW(),
  INDEX(tenant_id, period)
) ENGINE=InnoDB;

-- VoIP Platform
CREATE TABLE IF NOT EXISTS voip_platforms (
  id           VARCHAR(64) PRIMARY KEY,
  tenant_id    VARCHAR(64),
  name         VARCHAR(128),
  host         VARCHAR(128),
  sip_port     INT DEFAULT 5060,
  ami_port     INT DEFAULT 5038,
  ami_username VARCHAR(64),
  ami_password VARCHAR(128),
  status       ENUM('active','inactive','error') DEFAULT 'active',
  created_at   DATETIME DEFAULT NOW(),
  INDEX(tenant_id)
) ENGINE=InnoDB;

FLUSH PRIVILEGES;
EOF
echo "Net2app master database created."`,

  tenant_db: `#!/bin/bash
# ── Per-Tenant Database Provisioning ─────────────────────────────
# Run this when creating each new tenant from dashboard.
# Replace TENANT_ID, TENANT_NAME, TENANT_PASS accordingly.

TENANT_ID="tenant_acme"
TENANT_NAME="acme_db"
TENANT_PASS="TenantSecurePass!123"

mysql -u root << EOF
CREATE DATABASE IF NOT EXISTS \\\`\${TENANT_NAME}\\\` CHARACTER SET utf8mb4;
CREATE USER IF NOT EXISTS '\${TENANT_ID}'@'localhost' IDENTIFIED BY '\${TENANT_PASS}';
GRANT ALL PRIVILEGES ON \\\`\${TENANT_NAME}\\\`.*  TO '\${TENANT_ID}'@'localhost';
-- Tenant can also SELECT from shared global tables
GRANT SELECT ON net2app.cdr TO '\${TENANT_ID}'@'localhost';
GRANT SELECT ON net2app.sms_log TO '\${TENANT_ID}'@'localhost';
FLUSH PRIVILEGES;
EOF

# Create tenant-specific tables (mirror of global, filtered by tenant_id)
mysql -u root "\${TENANT_NAME}" << 'ENDSQL'
-- Tenant sees their own clients, suppliers, routes, rates, logs
-- These are VIEWS into the global tables filtered by tenant_id

CREATE OR REPLACE VIEW v_clients   AS SELECT * FROM net2app.clients   WHERE tenant_id = DATABASE();
CREATE OR REPLACE VIEW v_suppliers AS SELECT * FROM net2app.suppliers  WHERE tenant_id = DATABASE();
CREATE OR REPLACE VIEW v_routes    AS SELECT * FROM net2app.routes     WHERE tenant_id = DATABASE();
CREATE OR REPLACE VIEW v_rates     AS SELECT * FROM net2app.rates      WHERE tenant_id = DATABASE();
CREATE OR REPLACE VIEW v_sms_log   AS SELECT * FROM net2app.sms_log    WHERE tenant_id = DATABASE();
CREATE OR REPLACE VIEW v_cdr       AS SELECT * FROM net2app.cdr        WHERE tenant_id = DATABASE();
CREATE OR REPLACE VIEW v_invoices  AS SELECT * FROM net2app.invoices   WHERE tenant_id = DATABASE();
ENDSQL

echo "Tenant database created."`,

  billing_trigger: `-- ════════════════════════════════════════════════════════════════════
--  Net2app Real-Time Billing — Billing-Type Aware Trigger
--
--  CLIENT billing rules (per billing_type stored in clients table):
--    send     → charge on any non-blocked status (even if later failed)
--    submit   → charge only when SMSC returns msg_id (not failed/rejected)
--    delivery → charge only on status='delivered' (or force_dlr synthetic)
--
--  SUPPLIER billing rules (always same regardless of client billing_type):
--    charge only on successful submit (status NOT IN failed/rejected/blocked)
--    DLR fail, undelivered, force_dlr to client = supplier NOT charged
-- ════════════════════════════════════════════════════════════════════

-- Add billing columns to clients table if not present
ALTER TABLE net2app.clients
  ADD COLUMN IF NOT EXISTS billing_type ENUM('send','submit','delivery') DEFAULT 'submit',
  ADD COLUMN IF NOT EXISTS force_dlr TINYINT(1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS force_dlr_timeout INT DEFAULT 30;

DELIMITER //

-- ── Client billing trigger ────────────────────────────────────────
CREATE OR REPLACE TRIGGER trg_sms_billing_update
AFTER UPDATE ON net2app.sms_log
FOR EACH ROW
BEGIN
  DECLARE v_period       DATE;
  DECLARE v_billing_type VARCHAR(16);
  DECLARE v_force_dlr    TINYINT(1);
  DECLARE v_do_client    TINYINT(1) DEFAULT 0;
  DECLARE v_do_supplier  TINYINT(1) DEFAULT 0;

  SET v_period = DATE(NEW.submit_time);

  -- Fetch client billing settings
  SELECT billing_type, force_dlr
    INTO v_billing_type, v_force_dlr
    FROM net2app.clients
   WHERE id = NEW.client_id LIMIT 1;

  SET v_billing_type = IFNULL(v_billing_type, 'submit');

  -- ── Decide CLIENT charge ──────────────────────────────────────
  IF v_billing_type = 'send' THEN
    -- Charge on any status except blocked (already blocked before send)
    IF NEW.status NOT IN ('blocked','pending') THEN SET v_do_client = 1; END IF;

  ELSEIF v_billing_type = 'submit' THEN
    -- Charge only when SMSC accepted (has dest_msg_id / not failed/rejected)
    IF NEW.status NOT IN ('failed','rejected','blocked','pending') THEN SET v_do_client = 1; END IF;

  ELSEIF v_billing_type = 'delivery' THEN
    -- Charge only on DELIVRD
    IF NEW.status = 'delivered' THEN SET v_do_client = 1; END IF;
    -- Force DLR: if force_dlr=1 and status goes to sent/submitted → count as billable
    IF v_force_dlr = 1 AND NEW.status NOT IN ('failed','rejected','blocked','pending') THEN SET v_do_client = 1; END IF;
  END IF;

  -- ── Decide SUPPLIER charge ────────────────────────────────────
  -- Supplier ALWAYS only charged on successful submit regardless of client billing_type
  IF NEW.status NOT IN ('failed','rejected','blocked','pending') THEN
    SET v_do_supplier = 1;
  END IF;

  -- ── Update billing_summary ────────────────────────────────────
  INSERT INTO net2app.billing_summary
    (id, tenant_id, period, total_sms, total_cost, total_revenue, margin)
  VALUES (
    CONCAT(NEW.tenant_id,'_', v_period),
    NEW.tenant_id, v_period,
    IF(v_do_client,1,0),
    IF(v_do_supplier, NEW.cost, 0),
    IF(v_do_client, NEW.sell_rate, 0),
    IF(v_do_client, NEW.sell_rate, 0) - IF(v_do_supplier, NEW.cost, 0)
  )
  ON DUPLICATE KEY UPDATE
    total_sms     = total_sms     + IF(v_do_client,1,0),
    total_cost    = total_cost    + IF(v_do_supplier, NEW.cost, 0),
    total_revenue = total_revenue + IF(v_do_client, NEW.sell_rate, 0),
    margin        = margin        + IF(v_do_client, NEW.sell_rate, 0)
                                  - IF(v_do_supplier, NEW.cost, 0),
    updated_at    = NOW();
END //
DELIMITER ;

-- ── Invoice generation stored procedure ───────────────────────────
DELIMITER //
CREATE OR REPLACE PROCEDURE sp_generate_invoice(
  IN p_tenant_id  VARCHAR(64),
  IN p_client_id  VARCHAR(64),
  IN p_start      DATE,
  IN p_end        DATE,
  IN p_currency   VARCHAR(8)
)
BEGIN
  DECLARE v_billing_type VARCHAR(16);
  DECLARE v_force_dlr    TINYINT(1);

  SELECT billing_type, force_dlr INTO v_billing_type, v_force_dlr
    FROM net2app.clients WHERE id = p_client_id LIMIT 1;
  SET v_billing_type = IFNULL(v_billing_type,'submit');

  SELECT
    client_id,
    client_name,
    COUNT(*) AS total_sms,
    SUM(sell_rate) AS total_amount,
    p_currency AS currency,
    p_start AS period_start,
    p_end AS period_end,
    v_billing_type AS billing_type
  FROM net2app.sms_log
  WHERE tenant_id = p_tenant_id
    AND client_id = p_client_id
    AND submit_time BETWEEN p_start AND p_end
    AND (
      (v_billing_type = 'send'     AND status NOT IN ('blocked','pending'))
      OR (v_billing_type = 'submit'   AND status NOT IN ('failed','rejected','blocked','pending'))
      OR (v_billing_type = 'delivery' AND (status = 'delivered' OR v_force_dlr = 1))
    )
  GROUP BY client_id, client_name;
END //
DELIMITER ;`,

  cdr_mysql: `; /etc/asterisk/cdr_mysql.conf
[global]
hostname=localhost
dbname=net2app
table=cdr
password=STRONG_PASSWORD
user=net2app
port=3306
sock=/var/run/mysqld/mysqld.sock
userfield=1
additionalfields=tenant_id|buy_rate|sell_rate|cost`,

  ami_conf: `; /etc/asterisk/manager.conf
[general]
enabled = yes
port = 5038
bindaddr = 127.0.0.1
displayconnects = yes

[net2app]
secret = STRONG_AMI_PASSWORD
deny = 0.0.0.0/0.0.0.0
permit = 127.0.0.1/255.255.255.0
read = all
write = all`,

  sip_conf: `; /etc/asterisk/sip.conf
[general]
context=default
udpbindaddr=0.0.0.0
transport=udp
nat=force_rport,comedia
qualify=yes
dtmfmode=rfc2833
disallow=all
allow=ulaw
allow=alaw
allow=g729

; IPTSP providers each get dedicated port
; Tenant calls are tagged with accountcode = tenant_id for CDR billing`,

  firewall: `#!/bin/bash
# Net2app UFW Firewall – Debian 12
# Covers: SSH, SIP, RTP, Kannel, SMPP server ports, HTTP tenant panels

ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp           # SSH
ufw allow 80/tcp           # HTTP
ufw allow 443/tcp          # HTTPS
ufw allow 5060/udp         # SIP
ufw allow 5060/tcp         # SIP TCP
ufw allow 5080/udp         # SIP alt
ufw allow 6060/udp         # IPTSP alt
ufw allow 7074/udp         # BD IIGW
ufw allow 10000:20000/udp  # RTP audio

# Kannel bearerbox — restrict to localhost
ufw allow from 127.0.0.1 to any port 13000
ufw allow from 127.0.0.1 to any port 13013

# SMPP base port (Kannel server)
ufw allow 9095/tcp
# Tenant SMPP ports (auto-opened per tenant via dashboard)
ufw allow 9096:9200/tcp

# Tenant HTTP panel ports
ufw allow 4000:6000/tcp

# MariaDB — localhost only
ufw deny 3306

ufw enable
ufw status verbose`,

  github_deploy: `#!/bin/bash
# ════════════════════════════════════════════════════════════════════
#  Net2app — GitHub Deploy to Debian 12 Server
#  Run this ONCE on your server as root to clone & set up auto-deploy
#  Replace YOUR_GITHUB_USER and YOUR_REPO_NAME below.
# ════════════════════════════════════════════════════════════════════

GITHUB_USER="YOUR_GITHUB_USER"
REPO_NAME="YOUR_REPO_NAME"
DEPLOY_DIR="/opt/net2app"
APP_PORT="8080"
NODE_VERSION="20"

# 1. Install Node.js + npm + git
curl -fsSL https://deb.nodesource.com/setup_\${NODE_VERSION}.x | bash -
apt-get install -y nodejs git build-essential

# 2. Clone repo (use SSH key or HTTPS token)
mkdir -p \$DEPLOY_DIR
git clone https://github.com/\${GITHUB_USER}/\${REPO_NAME}.git \$DEPLOY_DIR
cd \$DEPLOY_DIR

# 3. Install dependencies & build
npm install
npm run build          # Vite outputs to dist/

# 4. Install PM2 (process manager) if running a backend
npm install -g pm2

# 5. Serve the built frontend via nginx
cp dist/* /var/www/html/ -r

# 6. Nginx config for React SPA
cat > /etc/nginx/sites-available/net2app << 'NGINX'
server {
    listen 80;
    server_name _;

    root /var/www/html;
    index index.html;

    # React Router — serve index.html for all routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API backend proxy (if you add a Node.js/Deno backend)
    location /api/ {
        proxy_pass http://127.0.0.1:\${APP_PORT}/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection upgrade;
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/net2app /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "✅ Net2app deployed at http://$(hostname -I | awk '{print $1}')"`,

  github_update: `#!/bin/bash
# ════════════════════════════════════════════════════════════════════
#  Net2app — Pull Latest Changes + Rebuild (run on server)
#  Save this as /opt/net2app/deploy.sh and run it on each update
# ════════════════════════════════════════════════════════════════════

set -e
DEPLOY_DIR="/opt/net2app"
cd $DEPLOY_DIR

echo "📥 Pulling latest from GitHub..."
git pull origin main

echo "📦 Installing dependencies..."
npm install

echo "🔨 Building..."
npm run build

echo "📂 Copying build to nginx..."
cp -r dist/* /var/www/html/

echo "🔄 Reloading nginx..."
nginx -t && systemctl reload nginx

echo "✅ Deploy complete at $(date)"`,

  github_actions: `# .github/workflows/deploy.yml
# ════════════════════════════════════════════════════════════════════
#  GitHub Actions — Auto Deploy to your Debian 12 server on push
#  Secrets required in GitHub repo settings:
#    SERVER_HOST  = your server IP / domain
#    SERVER_USER  = root (or deploy user)
#    SERVER_KEY   = private SSH key (paste full content)
# ════════════════════════════════════════════════════════════════════

name: Deploy Net2app

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install & Build
        run: |
          npm install
          npm run build

      - name: Deploy to server via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: \${{ secrets.SERVER_HOST }}
          username: \${{ secrets.SERVER_USER }}
          key: \${{ secrets.SERVER_KEY }}
          script: |
            cd /opt/net2app
            git pull origin main
            npm install
            npm run build
            cp -r dist/* /var/www/html/
            nginx -t && systemctl reload nginx
            echo "Deployed at $(date)"`,

  github_ssh: `# ════════════════════════════════════════════════════════════════════
#  Setup SSH Key for GitHub → Server Auto Deploy
#  Run these commands on your Debian 12 server
# ════════════════════════════════════════════════════════════════════

# 1. Generate SSH key pair on the server
ssh-keygen -t ed25519 -C "net2app-deploy" -f ~/.ssh/deploy_key -N ""

# 2. Print the PUBLIC key — add this to GitHub:
#    GitHub Repo → Settings → Deploy Keys → Add Deploy Key (read-only)
cat ~/.ssh/deploy_key.pub

# 3. Print the PRIVATE key — add this to GitHub Actions secrets as SERVER_KEY:
cat ~/.ssh/deploy_key

# 4. Configure SSH to use this key for GitHub
cat >> ~/.ssh/config << 'EOF'
Host github.com
  IdentityFile ~/.ssh/deploy_key
  StrictHostKeyChecking no
EOF

# 5. Test connection
ssh -T git@github.com

# 6. For GitHub Actions: also add your server's public key to authorized_keys
cat ~/.ssh/deploy_key.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys`,

  tenant_smtp: `# ── Tenant SMTP + Branding Setup (per-tenant via dashboard) ──────
# Tenants configure their own SMTP credentials + logo from their account.
# These are stored in tenant settings and used for:
#   - Rate card emails to clients/suppliers
#   - Invoice delivery
#   - OTP / notification emails

# Example: Tenant SMTP config stored in SystemSettings entity
# setting_key = smtp_host_tenant_{id}    value = smtp.gmail.com
# setting_key = smtp_port_tenant_{id}    value = 587
# setting_key = smtp_user_tenant_{id}    value = admin@company.com
# setting_key = smtp_pass_tenant_{id}    value = APP_PASSWORD
# setting_key = smtp_from_tenant_{id}    value = "Company Name <admin@company.com>"
# setting_key = logo_url_tenant_{id}     value = https://cdn.../logo.png

# Rate Card Email template (auto-generated by Net2app):
# Subject: Rate Update — [Destination] — [Date]
# Body: HTML table with MCC/MNC, Country, Network, Rate, Currency, Effective Date
# Attached: CSV export of rate card`,
};

const ARCH = `
  ┌─────────────────────────────────────────────────────────────────┐
  │               Net2app — Debian 12 Multi-Tenant Platform         │
  │                                                                 │
  │  ┌──────────────────────────────────────────────────────────┐  │
  │  │   KANNEL BEARERBOX (core) — port 13000 admin              │  │
  │  │   • SMPP SERVER mode: listens per-tenant ports 9096+      │  │
  │  │   • SMPP CLIENT mode: connects OUT to suppliers           │  │
  │  │   • HTTP CLIENT mode: forwards to HTTP API suppliers      │  │
  │  │   • SIM Box (BearBox/GoIP) via AT modem or SMPP          │  │
  │  │                                                           │  │
  │  │   KANNEL SMSBOX — port 13013 (HTTP submit)               │  │
  │  │   • Tenant HTTP panels proxy via nginx 4000-6000          │  │
  │  └────────────────────────┬─────────────────────────────────┘  │
  │                           │                                     │
  │  ┌─────────────────────────▼────────────────────────────────┐  │
  │  │              MariaDB — net2app master DB                  │  │
  │  │  clients | suppliers | routes | rates | sms_log | cdr    │  │
  │  │  ip_access | invoices | billing_summary (real-time)       │  │
  │  │  Per-tenant VIEWS — tenant sees only their data           │  │
  │  └──────────────────────────────────────────────────────────┘  │
  │                                                                 │
  │  ┌───────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
  │  │  Asterisk 20  │  │  Net2app API │  │  Nginx (tenant HTTP) │ │
  │  │  chan_sip      │  │  :8080       │  │  4000–6000 panels    │ │
  │  │  PJSIP :5060  │  │  DLR handler │  │  80/443 admin panel  │ │
  │  │  AMI   :5038  │  │  CDR billing │  └──────────────────────┘ │
  │  │  CDR → MariaDB│  └──────────────┘                           │
  │  └───────────────┘                                              │
  │                                                                 │
  │  Tenants → SMPP bind to port 9096+  (bearerbox SMPP server)    │
  │  Tenants → HTTP POST to port 4000+  (nginx → smsbox)           │
  │  Suppliers ← SMPP connect out       (bearerbox SMPP client)    │
  │  SIM Boxes ← AT/SMPP devices        (bearerbox bearer)         │
  │  Super Admin → manages all tenants, rates, routes, billing      │
  │  Tenant Admin → manages their own clients, suppliers, etc.      │
  └─────────────────────────────────────────────────────────────────┘
`;

export default function IntegrationDeployGuide() {
  const [tab, setTab] = useState("overview");

  return (
    <div className="space-y-4">
      <div className="p-4 bg-gradient-to-r from-blue-900 to-indigo-900 rounded-xl text-white space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <BookOpen className="w-5 h-5" />
          <h2 className="font-bold text-lg">Full Deploy Guide — Super Admin Only</h2>
          <Badge className="bg-white/20 text-white border-white/30">Debian 12 Bookworm</Badge>
          <Badge className="bg-red-500/80 text-white border-red-400/50">Super Admin</Badge>
        </div>
        <p className="text-blue-200 text-sm">
          Asterisk 20 + Kannel (bearerbox/smsbox) SMPP/HTTP server + SIM Box + MariaDB per-tenant CDR + real-time billing + firewall
        </p>
        <div className="flex flex-wrap gap-2 text-xs">
          {["1. System Prep","2. Kannel SMS","3. SIM Box","4. MariaDB Schema","5. Per-Tenant DB","6. Real-Time Billing","7. Asterisk CDR","8. Firewall","9. Tenant SMTP"].map((s,i) => (
            <div key={i} className="flex items-center gap-1 bg-white/10 rounded px-2 py-0.5">
              <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[9px] font-bold">{i+1}</span>
              {s.split(". ")[1]}
            </div>
          ))}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto gap-1 bg-muted/50 p-1">
          <TabsTrigger value="overview" className="gap-1 text-xs"><Server className="w-3 h-3" />Overview</TabsTrigger>
          <TabsTrigger value="system" className="gap-1 text-xs"><Settings className="w-3 h-3" />System</TabsTrigger>
          <TabsTrigger value="kannel" className="gap-1 text-xs"><Wifi className="w-3 h-3" />Kannel</TabsTrigger>
          <TabsTrigger value="simbox" className="gap-1 text-xs"><Wifi className="w-3 h-3" />SIM Box</TabsTrigger>
          <TabsTrigger value="database" className="gap-1 text-xs"><Database className="w-3 h-3" />Database</TabsTrigger>
          <TabsTrigger value="tenant_db" className="gap-1 text-xs"><Users className="w-3 h-3" />Tenant DB</TabsTrigger>
          <TabsTrigger value="billing" className="gap-1 text-xs"><Database className="w-3 h-3" />Billing</TabsTrigger>
          <TabsTrigger value="asterisk" className="gap-1 text-xs"><Phone className="w-3 h-3" />Asterisk</TabsTrigger>
          <TabsTrigger value="security" className="gap-1 text-xs"><Shield className="w-3 h-3" />Firewall</TabsTrigger>
          <TabsTrigger value="smtp" className="gap-1 text-xs"><Settings className="w-3 h-3" />SMTP/Logo</TabsTrigger>
          <TabsTrigger value="github" className="gap-1 text-xs"><GitBranch className="w-3 h-3" />GitHub Deploy</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">System Architecture</CardTitle></CardHeader>
            <CardContent>
              <pre className="text-xs font-mono text-muted-foreground bg-muted p-4 rounded-lg overflow-x-auto">{ARCH}</pre>
            </CardContent>
          </Card>
          <InfoBox color="orange">
            <p className="font-bold">Key Architecture Decisions:</p>
            <p>• <strong>Kannel only</strong> — no Jasmin. Kannel handles SMPP server + client + HTTP + SIM box (bearerbox).</p>
            <p>• <strong>BearBox/SIM boxes</strong> connect via AT modem (/dev/ttyUSB*) or outbound SMPP to bearerbox.</p>
            <p>• <strong>Per-tenant SMPP port</strong> (9096+): each tenant gets a dedicated smpp-server block in kannel.conf.</p>
            <p>• <strong>MariaDB</strong>: global tables + per-tenant VIEWs = data isolation without duplication.</p>
            <p>• <strong>Real-time billing</strong>: MySQL trigger updates billing_summary on every DLR/status update.</p>
            <p>• <strong>Tenants act as admin</strong>: full access to their clients, suppliers, routes, rates, CDR, invoices.</p>
          </InfoBox>
        </TabsContent>

        {/* System */}
        <TabsContent value="system" className="mt-4 space-y-4">
          <CodeBlock label="Step 1 — System Preparation (Debian 12, run as root)" code={SCRIPTS.system} />
          <InfoBox color="green">
            <p>Installs: MariaDB, Kannel, Nginx, PHP, supervisor, UFW, fail2ban. Start Kannel after configuring /etc/kannel/kannel.conf.</p>
          </InfoBox>
        </TabsContent>

        {/* Kannel */}
        <TabsContent value="kannel" className="mt-4 space-y-4">
          <InfoBox color="blue">
            <p className="font-bold">Kannel = bearerbox + smsbox. NO Jasmin needed.</p>
            <p>• <strong>bearerbox</strong>: handles all SMSC connections (inbound SMPP server for tenants + outbound SMPP/HTTP to suppliers).</p>
            <p>• <strong>smsbox</strong>: handles HTTP send API (port 13013). Tenant panels connect via nginx reverse proxy on ports 4000–6000.</p>
            <p>• DLR mode per tenant: "real" forwards actual status; "fake_success" injects message_state=1 at bearerbox layer.</p>
          </InfoBox>
          <CodeBlock label="Kannel Master Config — /etc/kannel/kannel.conf" code={SCRIPTS.kannel_core} />
          <CodeBlock label="Per-Tenant SMPP Server Blocks (append to kannel.conf)" code={SCRIPTS.kannel_tenants} color="text-yellow-300" />
          <CodeBlock label="HTTP Submit API + Tenant Nginx Proxy" code={SCRIPTS.kannel_http} color="text-cyan-300" />
          <CodeBlock label="Start/Reload Kannel" code={`# Install
apt-get install -y kannel kannel-extras
mkdir -p /var/log/kannel && chown kannel:kannel /var/log/kannel

# Start
systemctl enable kannel && systemctl start kannel
# OR start manually:
/usr/sbin/bearerbox /etc/kannel/kannel.conf &
/usr/sbin/smsbox /etc/kannel/kannel.conf &

# Reload config without downtime (SIGHUP):
killall -HUP bearerbox

# Check status (web):
curl "http://localhost:13000/status?password=CHANGE_ADMIN_PASSWORD"

# Test send via smsbox:
curl "http://localhost:13013/cgi-bin/sendsms?username=smsgw&password=PASS&from=TEST&to=8801XXXXXXXX&text=Hello"`} />
        </TabsContent>

        {/* SIM Box */}
        <TabsContent value="simbox" className="mt-4 space-y-4">
          <InfoBox color="purple">
            <p className="font-bold">SIM Box / BearBox / GoIP Integration</p>
            <p>• Kannel bearerbox connects to SIM box hardware via AT modem commands or SMPP.</p>
            <p>• Each SIM slot = one smsc group. Bearerbox round-robins or prioritises across slots.</p>
            <p>• For GoIP/Hybertone/Dinstar: use SMPP mode. For BearBox USB: use AT modem mode.</p>
          </InfoBox>
          <CodeBlock label="SIM Box Configuration — add to /etc/kannel/kannel.conf" code={SCRIPTS.bearerbox_simbox} />
          <CodeBlock label="Detect SIM Box USB devices" code={`# List connected modems
ls /dev/ttyUSB* /dev/ttyACM*
dmesg | grep -i tty

# Install modem manager (optional for diagnostics)
apt-get install -y modemmanager
mmcli -L

# Test AT commands on SIM box slot
# minicom -D /dev/ttyUSB0 -b 115200
# AT+CIMI   — check SIM IMSI
# AT+CSQ    — signal quality
# AT+CREG?  — network registration`} color="text-cyan-300" />
        </TabsContent>

        {/* Database */}
        <TabsContent value="database" className="mt-4 space-y-4">
          <InfoBox color="blue">
            <p className="font-bold">One MariaDB instance — all tenants, all data.</p>
            <p>Tables: clients, suppliers, routes, rates, sms_log, cdr, ip_access, invoices, billing_summary, voip_platforms — all with <code>tenant_id</code> column.</p>
            <p>Super Admin queries globally. Tenants query through VIEWs filtered by their tenant_id.</p>
          </InfoBox>
          <CodeBlock label="Step 4 — Master Database Schema (run as root)" code={SCRIPTS.mariadb_master} />
          <CodeBlock label="Asterisk CDR MySQL Config — /etc/asterisk/cdr_mysql.conf" code={SCRIPTS.cdr_mysql} />
          <CodeBlock label="Enable CDR MySQL in Asterisk" code={`# /etc/asterisk/modules.conf — add:
load => cdr_mysql.so

# Reload
asterisk -rx "module reload cdr_mysql.so"
asterisk -rx "cdr mysql status"`} />
        </TabsContent>

        {/* Tenant DB */}
        <TabsContent value="tenant_db" className="mt-4 space-y-4">
          <InfoBox color="yellow">
            <p className="font-bold">Per-Tenant Database Provisioning</p>
            <p>Each new tenant created in the dashboard needs a database user + filtered VIEWs. Run this script once per tenant.</p>
            <p>Tenant sees only their own clients, suppliers, routes, rates, logs — isolated by tenant_id via SQL VIEWs.</p>
          </InfoBox>
          <CodeBlock label="Step 5 — Create Tenant Database + Views (run per tenant)" code={SCRIPTS.tenant_db} color="text-yellow-300" />
          <CodeBlock label="Verify tenant isolation" code={`# Login as tenant DB user — should only see own data
mysql -u tenant_acme -p acme_db -e "SELECT COUNT(*) FROM v_sms_log;"
mysql -u tenant_acme -p acme_db -e "SELECT COUNT(*) FROM v_clients;"

# Super admin sees everything
mysql -u net2app -p net2app -e "SELECT tenant_id, COUNT(*) c FROM sms_log GROUP BY tenant_id;"`} />
        </TabsContent>

        {/* Billing */}
        <TabsContent value="billing" className="mt-4 space-y-4">
          <InfoBox color="green">
            <p className="font-bold">Real-Time Billing via MySQL Trigger — Billing-Type Aware</p>
            <p>Every DLR/status update fires a trigger that respects each client's billing_type:</p>
            <p>• <strong>send</strong>: client charged on any non-blocked status. Supplier charged on successful submit only.</p>
            <p>• <strong>submit</strong>: client charged only when SMSC returns Message ID. Fail/reject = NOT charged (client or supplier).</p>
            <p>• <strong>delivery</strong>: client charged only on DELIVRD. Force DLR also counts as billable for client. Supplier NOT charged on undelivered/DLR fail.</p>
          </InfoBox>
          <CodeBlock label="Step 6 — Billing-Type Aware Trigger + Invoice Procedure" code={SCRIPTS.billing_trigger} color="text-yellow-300" />
          <CodeBlock label="Test billing calculation" code={`-- Check real-time billing for today
SELECT tenant_id, period, total_sms, total_cost, total_revenue, margin
FROM net2app.billing_summary
WHERE period = CURDATE()
ORDER BY total_revenue DESC;

-- Generate invoice preview for a client
CALL net2app.sp_generate_invoice(
  'tenant_acme',
  'client_id_here',
  '2026-04-01',
  '2026-04-30',
  'USD'
);`} />
        </TabsContent>

        {/* Asterisk */}
        <TabsContent value="asterisk" className="mt-4 space-y-4">
          <CodeBlock label="Step 7 — Install Asterisk 20 LTS" code={SCRIPTS.asterisk} />
          <CodeBlock label="SIP Configuration (/etc/asterisk/sip.conf)" code={SCRIPTS.sip_conf} />
          <CodeBlock label="AMI Configuration (/etc/asterisk/manager.conf)" code={SCRIPTS.ami_conf} />
        </TabsContent>

        {/* Firewall */}
        <TabsContent value="security" className="mt-4 space-y-4">
          <CodeBlock label="Step 8 — UFW Firewall (includes all tenant ports)" code={SCRIPTS.firewall} />
          <CodeBlock label="Fail2ban — protect SIP + SSH" code={`# /etc/fail2ban/jail.local
[asterisk]
enabled = true
filter = asterisk
logpath = /var/log/asterisk/messages
maxretry = 5
bantime = 3600
findtime = 600

[sshd]
enabled = true
port = 22
maxretry = 3
bantime = 86400

systemctl reload fail2ban
fail2ban-client status`} />
          <InfoBox color="orange">
            <p className="font-bold">Tenant ports auto-opened via dashboard:</p>
            <p>When you create a tenant in Tenant Management, the UFW commands are auto-generated. Go to <strong>Tenant Management → UFW Commands</strong> tab to copy and run them on the server.</p>
          </InfoBox>
        </TabsContent>

        {/* GitHub Deploy */}
        <TabsContent value="github" className="mt-4 space-y-4">
          <div className="p-4 bg-gradient-to-r from-gray-900 to-slate-800 rounded-xl text-white space-y-2">
            <div className="flex items-center gap-2">
              <GitBranch className="w-5 h-5" />
              <h3 className="font-bold">GitHub → Debian 12 Auto Deploy</h3>
            </div>
            <p className="text-gray-300 text-sm">Push to GitHub → Server automatically pulls, builds, and deploys. No manual SSH needed after initial setup.</p>
          </div>

          <InfoBox color="blue">
            <p className="font-bold">Deploy Flow:</p>
            <p>1. Push code to GitHub (main branch)</p>
            <p>2. GitHub Actions builds + SSHs into your server</p>
            <p>3. Server pulls latest, runs <code>npm run build</code>, copies to nginx /var/www/html</p>
            <p>4. Nginx reloads — app is live within ~60 seconds of push</p>
          </InfoBox>

          <CodeBlock label="Step 1 — SSH Key Setup (run on Debian 12 server as root)" code={SCRIPTS.github_ssh} color="text-cyan-300" />
          <CodeBlock label="Step 2 — Initial Server Deploy (clone + build + nginx)" code={SCRIPTS.github_deploy} color="text-green-400" />
          <CodeBlock label="Step 3 — Manual Update Script (/opt/net2app/deploy.sh)" code={SCRIPTS.github_update} color="text-yellow-300" />
          <CodeBlock label="Step 4 — GitHub Actions CI/CD (.github/workflows/deploy.yml)" code={SCRIPTS.github_actions} color="text-purple-300" />

          <Card>
            <CardHeader><CardTitle className="text-sm">Required GitHub Secrets</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                {[
                  { key: "SERVER_HOST", val: "Your server IP or domain (e.g. 192.168.1.100)" },
                  { key: "SERVER_USER", val: "root or deploy user" },
                  { key: "SERVER_KEY",  val: "Full content of ~/.ssh/deploy_key (private key)" },
                ].map(s => (
                  <div key={s.key} className="flex items-start gap-3 p-2 bg-muted rounded-lg">
                    <code className="text-xs bg-black/10 px-2 py-0.5 rounded font-mono shrink-0">{s.key}</code>
                    <span className="text-xs text-muted-foreground">{s.val}</span>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground pt-2">Go to: GitHub Repo → Settings → Secrets and variables → Actions → New repository secret</p>
              </div>
            </CardContent>
          </Card>

          <InfoBox color="green">
            <p className="font-bold">Quick checklist for your GitHub repo:</p>
            <p>✅ Add <code>.github/workflows/deploy.yml</code> (copy from above)</p>
            <p>✅ Add 3 secrets: SERVER_HOST, SERVER_USER, SERVER_KEY</p>
            <p>✅ Add deploy public key to GitHub repo Deploy Keys (read-only is fine)</p>
            <p>✅ Push to <code>main</code> branch → Actions tab shows deploy progress</p>
          </InfoBox>
        </TabsContent>

        {/* SMTP/Logo */}
        <TabsContent value="smtp" className="mt-4 space-y-4">
          <InfoBox color="blue">
            <p className="font-bold">Tenant SMTP + Logo Branding</p>
            <p>Each tenant configures their own SMTP credentials and logo from their tenant account settings. These are used for rate card emails, invoices, and notifications.</p>
          </InfoBox>
          <CodeBlock label="Tenant SMTP + Branding Architecture" code={SCRIPTS.tenant_smtp} color="text-cyan-300" />
          <Card>
            <CardHeader><CardTitle className="text-sm">Rate Card Email Flow</CardTitle></CardHeader>
            <CardContent>
              <pre className="text-xs font-mono text-muted-foreground bg-muted p-4 rounded">{`
1. Admin adds/updates rates in Rate Management
2. "Send to Client/Supplier" button appears in rate table
3. Clicking it:
   a. Fetches tenant's SMTP settings
   b. Generates HTML rate card table (grouped by MCC/MNC)
   c. Attaches CSV export
   d. Sends via tenant's configured SMTP
   e. Logs notification in Notifications entity

Email includes:
  • Tenant logo (from tenant logo_url setting)
  • Rate table: Country | Network | MCC | MNC | Prefix | Rate | Currency | Effective
  • "This rate card supersedes all previous versions"
  • Applies to both SMS clients/suppliers AND VoIP clients/suppliers
              `}</pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}