export const SCRIPTS = {
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

systemctl enable mariadb kannel nginx
systemctl start mariadb kannel nginx
echo "✅ System packages installed successfully"`,

  asterisk: `#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
#  Asterisk Full Install — Fixed for Debian 12
#  Run as root: sudo bash install_asterisk.sh
# ═══════════════════════════════════════════════════════════════════

if [ "\$EUID" -ne 0 ]; then exec sudo bash "\$0" "\$@"; fi
set -e

GREEN='\\033[0;32m'; RED='\\033[0;31m'; YELLOW='\\033[1;33m'; BLUE='\\033[0;34m'; NC='\\033[0m'
ok()     { echo -e "\${GREEN}[OK]\${NC} \$1"; }
fail()   { echo -e "\${RED}[FAIL]\${NC} \$1"; }
info()   { echo -e "\${YELLOW}[i]\${NC} \$1"; }
header() { echo -e "\\n\${BLUE}== \$1 ==\${NC}\\n"; }

echo ""; echo "============================================"
echo "  Asterisk Full Install - Net2App"
echo "  Running as: \$(whoami)"
echo "============================================"

header "STEP 1: Update System"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y && apt-get upgrade -y
ok "System updated"

header "STEP 2: Install Dependencies"
apt-get install -y \\
    build-essential wget curl git \\
    libssl-dev libncurses5-dev libnewt-dev \\
    libxml2-dev libsqlite3-dev uuid-dev \\
    libjansson-dev libedit-dev \\
    libgsm1-dev mpg123 sox \\
    unixodbc unixodbc-dev odbcinst subversion \\
    pkg-config liblua5.2-dev \\
    libspeex-dev libspeexdsp-dev \\
    libogg-dev libvorbis-dev \\
    libcurl4-openssl-dev
apt-get install -y libsrtp2-dev 2>/dev/null || apt-get install -y libsrtp-dev 2>/dev/null || info "libsrtp not found - continuing"
ok "Dependencies installed"

header "STEP 3: Download Asterisk 20"
cd /usr/src
rm -f asterisk-20-current.tar.gz; rm -rf asterisk-20*/
wget -q --show-progress https://downloads.asterisk.org/pub/telephony/asterisk/asterisk-20-current.tar.gz -O asterisk-20-current.tar.gz
tar -xzf asterisk-20-current.tar.gz
ASTERISK_DIR=\$(find /usr/src -maxdepth 1 -name "asterisk-20*" -type d | head -1)
[ -z "\$ASTERISK_DIR" ] && { echo "Extraction failed"; exit 1; }
ok "Asterisk extracted: \$ASTERISK_DIR"

header "STEP 4: Install Prerequisites"
cd "\$ASTERISK_DIR"
[ -f contrib/scripts/install_prereq ] && chmod +x contrib/scripts/install_prereq && contrib/scripts/install_prereq install 2>&1 | tail -5 || info "install_prereq skipped"

header "STEP 5: Configure"
./configure --with-jansson-bundled --with-pjproject-bundled 2>&1 | tail -5
ok "Configure complete"

header "STEP 6: Select Modules"
make menuselect.makeopts 2>&1 | tail -3
menuselect/menuselect \\
    --enable chan_sip --enable chan_pjsip --enable res_pjsip \\
    --enable res_pjsip_session --enable res_pjsip_authenticator_digest \\
    --enable res_pjsip_endpoint_identifier_ip --enable res_pjsip_registrar \\
    --enable res_pjsip_sdp_rtp --enable res_pjsip_outbound_registration \\
    --enable app_voicemail --enable codec_gsm --enable codec_ulaw --enable codec_alaw \\
    --enable format_mp3 --enable app_dial --enable app_playback --enable app_record \\
    --enable app_echo --enable app_transfer --enable cdr_csv --enable cdr_manager \\
    menuselect.makeopts 2>/dev/null || true
ok "Modules selected"

header "STEP 7: Compile (5-15 minutes)"
make -j\$(nproc) 2>&1 | tail -10
ok "Compilation complete"

header "STEP 8: Install"
make install 2>&1 | tail -5 && ok "make install"
make samples 2>&1 | tail -3 && ok "make samples"
make config  2>&1 | tail -3 && ok "make config"
ldconfig && ok "ldconfig updated"

header "STEP 9: Create Asterisk User"
id asterisk &>/dev/null || useradd -r -d /var/lib/asterisk -s /sbin/nologin -c "Asterisk Communications" asterisk
for DIR in /etc/asterisk /var/lib/asterisk /var/log/asterisk /var/spool/asterisk /usr/lib/asterisk /var/run/asterisk; do
  [ -d "\$DIR" ] && chown -R asterisk:asterisk "\$DIR" || true
done
ok "User and permissions set"

header "STEP 10: Write Config Files"

cat > /etc/asterisk/asterisk.conf <<'CONF'
[options]
runuser = asterisk
rungroup = asterisk
verbose = 3
debug = 0
alwaysfork = yes
CONF

cat > /etc/asterisk/sip.conf <<'CONF'
[general]
context=default
bindport=5060
bindaddr=0.0.0.0
language=en
disallow=all
allow=ulaw
allow=alaw
allow=gsm
nat=force_rport,comedia
qualify=yes
alwaysauthreject=yes
canreinvite=no
session-timers=refuse
defaultexpiry=120
minexpiry=60
maxexpiry=3600

[1001]
type=friend
context=default
host=dynamic
secret=Telco1988
callerid="Extension 1001" <1001>
disallow=all
allow=ulaw
allow=alaw

[1002]
type=friend
context=default
host=dynamic
secret=Telco1988
callerid="Extension 1002" <1002>
disallow=all
allow=ulaw
allow=alaw
CONF

cat > /etc/asterisk/pjsip.conf <<'CONF'
[global]
type=global
endpoint_identifier_order=ip,username,anonymous

[transport-udp]
type=transport
protocol=udp
bind=0.0.0.0:5060

[endpoint-basic](!)
type=endpoint
context=default
disallow=all
allow=ulaw,alaw,gsm
direct_media=no
force_rport=yes
rewrite_contact=yes
rtp_symmetric=yes

[auth-basic](!)
type=auth
auth_type=userpass

[aor-basic](!)
type=aor
max_contacts=5
remove_existing=yes
qualify_frequency=30

[1001](endpoint-basic)
auth=auth1001
aors=aor1001
callerid="Ext 1001" <1001>

[auth1001](auth-basic)
username=1001
password=Telco1988

[aor1001](aor-basic)
mailboxes=1001@default

[1002](endpoint-basic)
auth=auth1002
aors=aor1002
callerid="Ext 1002" <1002>

[auth1002](auth-basic)
username=1002
password=Telco1988

[aor1002](aor-basic)
mailboxes=1002@default
CONF

cat > /etc/asterisk/extensions.conf <<'CONF'
[general]
static=yes
writeprotect=no
autofallthrough=yes

[default]
exten => 1001,1,NoOp(Call to 1001)
 same => n,Dial(PJSIP/1001,30)
 same => n,Hangup()

exten => 1002,1,NoOp(Call to 1002)
 same => n,Dial(PJSIP/1002,30)
 same => n,Hangup()

exten => 9999,1,Answer()
 same => n,Echo()
 same => n,Hangup()

exten => h,1,Hangup()
CONF

cat > /etc/asterisk/manager.conf <<'CONF'
[general]
enabled=yes
port=5038
bindaddr=127.0.0.1
displayconnects=yes
timestampevents=yes

[admin]
secret=Telco1988
deny=0.0.0.0/0.0.0.0
permit=127.0.0.1/255.255.255.0
read=all
write=all

[net2app]
secret=Telco1988
deny=0.0.0.0/0.0.0.0
permit=127.0.0.1/255.255.255.0
read=all
write=all
CONF

cat > /etc/asterisk/cdr_mysql.conf <<'CONF'
[global]
hostname=localhost
port=3306
dbname=net2app
password=Telco1988
user=net2app
table=cdr
charset=utf8mb4
CONF

chown -R asterisk:asterisk /etc/asterisk && chmod -R 640 /etc/asterisk/*
ok "Config files written"

header "STEP 11: Systemd Service"
cat > /etc/systemd/system/asterisk.service <<'UNIT'
[Unit]
Description=Asterisk PBX
After=network.target

[Service]
Type=simple
User=asterisk
Group=asterisk
Environment=HOME=/var/lib/asterisk
ExecStart=/usr/sbin/asterisk -f -C /etc/asterisk/asterisk.conf
ExecReload=/usr/sbin/asterisk -rx "core reload"
ExecStop=/usr/sbin/asterisk -rx "core stop now"
Restart=always
RestartSec=10
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload && systemctl enable asterisk
ok "Systemd service configured"

header "STEP 12: Start Asterisk"
systemctl stop asterisk 2>/dev/null || true
pkill -f asterisk 2>/dev/null || true; sleep 2
systemctl start asterisk; sleep 5
systemctl is-active --quiet asterisk && ok "Asterisk STARTED" || { journalctl -u asterisk --no-pager -n 20; fail "Asterisk failed to start"; }

header "STEP 13: Open Firewall Ports"
iptables -I INPUT -p udp --dport 5060 -j ACCEPT 2>/dev/null || true
iptables -I INPUT -p tcp --dport 5060 -j ACCEPT 2>/dev/null || true
iptables -I INPUT -p tcp --dport 5038 -j ACCEPT 2>/dev/null || true
iptables -I INPUT -p udp --dport 10000:20000 -j ACCEPT 2>/dev/null || true
iptables-save > /etc/iptables.rules 2>/dev/null || true
ok "Firewall ports opened"

header "Final Verification"
systemctl is-active --quiet asterisk && ok "Asterisk: RUNNING" || fail "Asterisk: STOPPED"
asterisk -V 2>/dev/null && ok "Version OK"
ss -tlunp | grep -E "5060|5038" && ok "Ports listening" || info "Ports check above"
sleep 2
AMI_TEST=\$(echo -e "Action: Login\\r\\nUsername: admin\\r\\nSecret: Telco1988\\r\\n\\r\\n" | nc -w3 127.0.0.1 5038 2>/dev/null | head -3)
echo "\$AMI_TEST" | grep -q "Success" && ok "AMI Login OK" || info "AMI: \$AMI_TEST"
asterisk -rx "core show version" 2>/dev/null && ok "CLI working" || info "CLI not ready yet"

cat > /root/.asterisk_credentials <<EOF
AMI_HOST=127.0.0.1
AMI_PORT=5038
AMI_USER=admin / Telco1988
AMI_USER2=net2app / Telco1988
SIP_PORT=5060
EXT1=1001 / Telco1988
EXT2=1002 / Telco1988
CONFIG=/etc/asterisk
LOGS=/var/log/asterisk
EOF
chmod 600 /root/.asterisk_credentials
ok "Credentials saved: /root/.asterisk_credentials"

echo ""
echo "============================================"
echo "  ASTERISK INSTALLATION COMPLETE"
echo "============================================"
echo "  systemctl status asterisk"
echo "  asterisk -rvvv"
echo "  asterisk -rx 'core show version'"
echo "  asterisk -rx 'sip show peers'"
echo "  asterisk -rx 'pjsip show endpoints'"
echo "  Logs: tail -f /var/log/asterisk/messages"
echo "  AMI: 127.0.0.1:5038  admin/Telco1988"
echo "  SIP: 5060  Exts: 1001/1002  Pass: Telco1988"
echo "  cat /root/.asterisk_credentials"
echo "============================================"`,

  kannel_install: `#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
#  Net2app Kannel — Full Install Script
#  Run as root: bash install_kannel.sh
# ═══════════════════════════════════════════════════════════════════
set -e
echo "════════════════════════════════════════════"
echo "  Net2app Kannel Installer"
echo "════════════════════════════════════════════"

echo "[1/6] Installing Kannel..."
apt-get update -y && apt-get install -y kannel

echo "[2/6] Creating directories..."
mkdir -p /etc/kannel /var/log/kannel
chmod 755 /var/log/kannel

echo "[3/6] Writing kannel.conf..."
tee /etc/kannel/kannel.conf > /dev/null << 'KANNELEOF'
group = core
admin-port = 13000
admin-password = CHANGE_ADMIN_PASSWORD
status-password = CHANGE_STATUS_PASSWORD
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
KANNELEOF

echo "[4/6] Creating systemd services..."
tee /etc/systemd/system/kannel-bearerbox.service > /dev/null << 'EOF'
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

tee /etc/systemd/system/kannel-smsbox.service > /dev/null << 'EOF'
[Unit]
Description=Kannel Smsbox
After=network.target kannel-bearerbox.service
Requires=kannel-bearerbox.service
[Service]
Type=simple
ExecStartPre=/bin/sleep 3
ExecStart=/usr/sbin/smsbox /etc/kannel/kannel.conf
Restart=always
RestartSec=5
User=root
[Install]
WantedBy=multi-user.target
EOF

echo "[5/6] Starting services..."
systemctl daemon-reload
systemctl enable kannel-bearerbox kannel-smsbox
pkill -f bearerbox 2>/dev/null || true
pkill -f smsbox 2>/dev/null || true
sleep 2
systemctl start kannel-bearerbox; sleep 4
systemctl start kannel-smsbox; sleep 2

echo "[6/6] Verifying..."
systemctl is-active kannel-bearerbox && echo "bearerbox: RUNNING ✅" || echo "bearerbox: FAILED ❌"
systemctl is-active kannel-smsbox    && echo "smsbox:    RUNNING ✅" || echo "smsbox:    FAILED ❌"
curl -s "http://localhost:13000/status?password=CHANGE_ADMIN_PASSWORD" || echo "Admin not reachable yet"

echo "════════════════════════════════════════════"
echo "  Installation Complete!"
echo "  ⚠️  Update /etc/kannel/kannel.conf passwords + supplier credentials"
echo "════════════════════════════════════════════"`,

  kannel_core: `# /etc/kannel/kannel.conf — Net2app Kannel
# ═══════════════════════════════════════════════════════════════════
#  Kannel acts as BOTH:
#    • SMPP SERVER  — tenants/clients connect TO us via SMPP bind
#    • SMPP CLIENT  — we connect OUT to upstream SMPP suppliers
#    • HTTP SERVER  — accept HTTP submit from tenant panels
#    • HTTP CLIENT  — forward to HTTP API suppliers
# ═══════════════════════════════════════════════════════════════════

group = core
admin-port = 13000
admin-password = CHANGE_ADMIN_PASSWORD
status-password = CHANGE_STATUS_PASSWORD
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

group = smsc
smsc = http
smsc-id = "supplier_http"
system-type = "kannel"
send-url = "https://api.yoursupplier.com/send"
smsc-username = "api_user"
smsc-password = "api_pass"
throughput = 100`,

  kannel_tenants: `# ════════════════════════════════════════════════════════════════
#  TENANT SMPP SERVER BLOCKS — Clients connect TO these ports
#  Add this section for each tenant created in Net2app dashboard
# ════════════════════════════════════════════════════════════════

group = smpp-server
smpp-server-id = tenant1_acme
port = 9096
system-id = acme_user
password = SecurePass123!
system-type = ""
log-file = "/var/log/kannel/tenant1_acme_smpp.log"
log-level = 1

group = smpp-server
smpp-server-id = tenant2_xyz
port = 9097
system-id = xyz_user
password = AnotherPass!
system-type = ""
log-file = "/var/log/kannel/tenant2_xyz_smpp.log"
log-level = 1

# After creating tenants: copy auto-generated blocks from Tenant Management → Kannel Config tab
# Then reload: kill -HUP $(pidof bearerbox)`,

  kannel_http: `# HTTP Send API (smsbox sendsms endpoint)
# POST http://SERVER_IP:13013/cgi-bin/sendsms
# Params: username=smsgw  password=PASS  from=SENDER  to=880XXXXXXXX  text=Hello

# Tenant HTTP ports (4000-6000) — nginx reverse proxy
server {
    listen 4000;
    location / {
        proxy_pass http://127.0.0.1:13013;
        proxy_set_header Host $host;
    }
}

# DLR Callback (Kannel → Net2app backend)
# In kannel.conf smsbox group, add:
# dlr-url = "http://127.0.0.1:8080/dlr?msgid=%i&status=%d&to=%p"`,

  bearerbox_simbox: `# SIM Box / BearBox / GoIP Integration
# Each SIM card appears as an SMSC in Kannel bearerbox.

# Option A: AT Modem (serial/USB SIM box)
group = smsc
smsc = at
smsc-id = "simbox_slot1"
device = /dev/ttyUSB0
speed = 115200
sms-center = "+8801XXXXXXXXX"
throughput = 3

# Option B: SMPP SIM box (GoIP/BearBox sends SMPP to bearerbox)
group = smsc
smsc = smpp
smsc-id = "simbox_goip1"
host = "192.168.1.200"
port = 7777
smsc-username = "goip_user"
smsc-password = "goip_pass"
transceiver-mode = 1
throughput = 10

# Reload: killall -HUP bearerbox`,

  mariadb_master: `#!/bin/bash
# MariaDB — Master Database Setup
mysql -u root << 'EOF'
CREATE DATABASE IF NOT EXISTS net2app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'net2app'@'localhost' IDENTIFIED BY 'STRONG_PASSWORD_CHANGE_ME';
GRANT ALL PRIVILEGES ON net2app.* TO 'net2app'@'localhost';
USE net2app;

CREATE TABLE IF NOT EXISTS clients (
  id VARCHAR(64) PRIMARY KEY, tenant_id VARCHAR(64) NOT NULL,
  name VARCHAR(128), email VARCHAR(128),
  smpp_ip VARCHAR(64), smpp_port INT, smpp_username VARCHAR(64), smpp_password VARCHAR(128),
  connection_type ENUM('SMPP','HTTP') DEFAULT 'SMPP',
  status ENUM('active','inactive','blocked') DEFAULT 'active',
  balance DECIMAL(12,4) DEFAULT 0, currency VARCHAR(8) DEFAULT 'USD',
  billing_type ENUM('send','submit','delivery') DEFAULT 'submit',
  force_dlr TINYINT(1) DEFAULT 0, force_dlr_timeout INT DEFAULT 30,
  created_at DATETIME DEFAULT NOW(),
  INDEX(tenant_id), INDEX(status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS suppliers (
  id VARCHAR(64) PRIMARY KEY, tenant_id VARCHAR(64) NOT NULL,
  name VARCHAR(128), category ENUM('sms','voice_otp','whatsapp','telegram','device','android') DEFAULT 'sms',
  provider_type VARCHAR(128), connection_type ENUM('HTTP','SMPP','SIP','SDK','DEVICE','ANDROID') DEFAULT 'HTTP',
  http_url TEXT, http_method ENUM('GET','POST') DEFAULT 'POST', http_params TEXT,
  api_key VARCHAR(256), api_secret VARCHAR(256), account_sid VARCHAR(128), auth_token VARCHAR(256), dlr_url TEXT,
  smpp_ip VARCHAR(64), smpp_port INT DEFAULT 2775, smpp_username VARCHAR(64), smpp_password VARCHAR(128),
  sip_server VARCHAR(128), sip_port INT DEFAULT 5060, sip_username VARCHAR(64), sip_password VARCHAR(128),
  device_channel ENUM('whatsapp','telegram','imo','android') DEFAULT NULL,
  device_phone VARCHAR(32), device_session TEXT, device_status ENUM('pending','connected','disconnected','expired') DEFAULT 'pending', device_linked_at DATETIME,
  android_webhook_url TEXT, android_device_id VARCHAR(128), android_api_token VARCHAR(256),
  allowed_prefixes VARCHAR(512), allowed_mcc_mnc TEXT,
  reroute_on_fail TINYINT(1) DEFAULT 1, reroute_supplier_id VARCHAR(64), reroute_supplier_name VARCHAR(128),
  billing_type ENUM('send','submit','delivery') DEFAULT 'delivery',
  total_sent BIGINT DEFAULT 0, total_delivered BIGINT DEFAULT 0, total_failed BIGINT DEFAULT 0, total_rerouted BIGINT DEFAULT 0,
  otp_unicode_preset VARCHAR(128), otp_unicode_enabled TINYINT(1) DEFAULT 0,
  status ENUM('active','inactive','blocked') DEFAULT 'active', priority INT DEFAULT 1, tps_limit INT DEFAULT 100,
  contact_person VARCHAR(128), email VARCHAR(128), phone VARCHAR(32), notes TEXT,
  created_at DATETIME DEFAULT NOW(),
  INDEX(tenant_id), INDEX(category), INDEX(connection_type)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS device_sessions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY, tenant_id VARCHAR(64) NOT NULL,
  supplier_id VARCHAR(64), channel ENUM('whatsapp','telegram','imo') NOT NULL,
  session_name VARCHAR(128), phone VARCHAR(32), qr_token VARCHAR(256), session_data TEXT,
  status ENUM('pending','active','expired','disconnected') DEFAULT 'pending',
  connected_at DATETIME, disconnected_at DATETIME, last_activity DATETIME, notes TEXT, created_at DATETIME DEFAULT NOW(),
  INDEX(tenant_id, channel), INDEX(supplier_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS routes (
  id VARCHAR(64) PRIMARY KEY, tenant_id VARCHAR(64) NOT NULL,
  name VARCHAR(128), client_id VARCHAR(64), client_name VARCHAR(128),
  supplier_id VARCHAR(64), supplier_name VARCHAR(128),
  backup_supplier_id VARCHAR(64), backup_supplier_name VARCHAR(128),
  device_reroute_supplier_id VARCHAR(64), device_reroute_supplier_name VARCHAR(128),
  device_reroute_to ENUM('smpp','http','voice_otp','none') DEFAULT 'smpp', reroute_on_device_fail TINYINT(1) DEFAULT 1,
  mcc VARCHAR(8), mnc VARCHAR(8), country VARCHAR(64), network VARCHAR(128), prefix VARCHAR(32),
  routing_mode ENUM('LCR','ASR','Priority','Round Robin') DEFAULT 'Priority',
  status ENUM('active','inactive','blocked') DEFAULT 'active',
  fail_count INT DEFAULT 0, auto_block_threshold INT DEFAULT 10, is_auto_blocked TINYINT(1) DEFAULT 0,
  otp_unicode_preset_id VARCHAR(64), content_template_id VARCHAR(64),
  INDEX(tenant_id), INDEX(mcc, mnc), INDEX(supplier_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS rates (
  id VARCHAR(64) PRIMARY KEY, tenant_id VARCHAR(64) NOT NULL,
  type ENUM('client','supplier','voice') NOT NULL,
  entity_id VARCHAR(64), entity_name VARCHAR(128),
  mcc VARCHAR(8), mnc VARCHAR(8), country VARCHAR(64), network VARCHAR(128), prefix VARCHAR(32),
  rate DECIMAL(12,6) DEFAULT 0, currency VARCHAR(8) DEFAULT 'USD',
  status ENUM('active','inactive','scheduled') DEFAULT 'active',
  effective_from DATETIME, effective_until DATETIME, version INT DEFAULT 1,
  INDEX(tenant_id, type, entity_id, mcc, mnc)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sms_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY, tenant_id VARCHAR(64) NOT NULL,
  message_id VARCHAR(64), client_id VARCHAR(64), client_name VARCHAR(128),
  supplier_id VARCHAR(64), supplier_name VARCHAR(128),
  sender_id VARCHAR(32), destination VARCHAR(32),
  mcc VARCHAR(8), mnc VARCHAR(8), country VARCHAR(64), network VARCHAR(128),
  content TEXT, status ENUM('pending','sent','delivered','failed','rejected','blocked') DEFAULT 'pending',
  fail_reason VARCHAR(256), dest_msg_id VARCHAR(64),
  parts TINYINT DEFAULT 1, cost DECIMAL(12,6) DEFAULT 0, sell_rate DECIMAL(12,6) DEFAULT 0,
  submit_time DATETIME DEFAULT NOW(), delivery_time DATETIME,
  dlr_mode ENUM('real','fake_success') DEFAULT 'real',
  INDEX(tenant_id), INDEX(destination), INDEX(client_id), INDEX(status), INDEX(submit_time)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cdr (
  id BIGINT AUTO_INCREMENT PRIMARY KEY, tenant_id VARCHAR(64),
  calldate DATETIME NOT NULL DEFAULT NOW(),
  clid VARCHAR(80), src VARCHAR(80), dst VARCHAR(80), dcontext VARCHAR(80),
  channel VARCHAR(80), dstchannel VARCHAR(80), lastapp VARCHAR(80), lastdata VARCHAR(80),
  duration INT, billsec INT, disposition VARCHAR(45), amaflags INT,
  accountcode VARCHAR(20), uniqueid VARCHAR(32) NOT NULL,
  buy_rate DECIMAL(10,6) DEFAULT 0, sell_rate DECIMAL(10,6) DEFAULT 0, cost DECIMAL(12,6) DEFAULT 0,
  INDEX(tenant_id), INDEX(calldate), INDEX(src), INDEX(dst)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ip_access (
  id VARCHAR(64) PRIMARY KEY, tenant_id VARCHAR(64),
  ip_address VARCHAR(64), list_type ENUM('whitelist','blacklist','web_blacklist') DEFAULT 'whitelist',
  entity_type ENUM('client','supplier','admin','global') DEFAULT 'global',
  entity_id VARCHAR(64), is_active TINYINT(1) DEFAULT 1, hit_count INT DEFAULT 0, created_at DATETIME DEFAULT NOW(),
  INDEX(tenant_id, ip_address)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS invoices (
  id VARCHAR(64) PRIMARY KEY, tenant_id VARCHAR(64) NOT NULL,
  invoice_number VARCHAR(32), client_id VARCHAR(64), client_name VARCHAR(128),
  period_start DATE, period_end DATE,
  total_sms BIGINT DEFAULT 0, total_amount DECIMAL(14,4) DEFAULT 0,
  currency VARCHAR(8) DEFAULT 'USD', status ENUM('draft','sent','paid','overdue','cancelled') DEFAULT 'draft',
  breakdown JSON, created_at DATETIME DEFAULT NOW(),
  INDEX(tenant_id, client_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS billing_summary (
  id VARCHAR(64) PRIMARY KEY, tenant_id VARCHAR(64) NOT NULL,
  period DATE, total_sms BIGINT DEFAULT 0,
  total_cost DECIMAL(14,4) DEFAULT 0, total_revenue DECIMAL(14,4) DEFAULT 0, margin DECIMAL(14,4) DEFAULT 0,
  updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  INDEX(tenant_id, period)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tenants (
  id VARCHAR(64) PRIMARY KEY, name VARCHAR(128),
  plan VARCHAR(64) DEFAULT 'basic', status ENUM('active','suspended','expired') DEFAULT 'active',
  created_at DATETIME DEFAULT NOW()
) ENGINE=InnoDB;

FLUSH PRIVILEGES;
EOF
echo "Net2app master database created."`,

  tenant_db: `#!/bin/bash
# ============================================
# Net2app — Tenant Deploy / Quick Fix Script
# Run as root: sudo bash fix-tenant.sh <tenant_id> <db_name> <pass>
# Example:     bash fix-tenant.sh tenant_acme acme_db Telco1988
# ============================================

if [ "$EUID" -ne 0 ]; then exec sudo bash "$0" "$@"; fi

ROOT_PASS="Telco1988"
GLOBAL_DB="net2app"
GLOBAL_USER="net2app"
GLOBAL_PASS="Telco1988"
TENANT_ID="\${1:-tenant_acme}"
TENANT_NAME="\${2:-acme_db}"
TENANT_PASS="\${3:-Telco1988}"

GREEN='\\033[0;32m'; RED='\\033[0;31m'; YELLOW='\\033[1;33m'; NC='\\033[0m'
ok()   { echo -e "\${GREEN}[OK]\${NC} \$1"; }
fail() { echo -e "\${RED}[FAIL]\${NC} \$1"; }

MYSQL="mysql -u root -p\${ROOT_PASS}"

echo ""
echo "════════════════════════════════════════"
echo "  Running as: \$(whoami)"
echo "  Tenant ID:  \${TENANT_ID}"
echo "  Database:   \${TENANT_NAME}"
echo "════════════════════════════════════════"

# ── Start MySQL ──────────────────────────────────────────────────
echo ""; echo "── Starting MySQL ──"
systemctl start mysql 2>/dev/null || service mysql start 2>/dev/null; sleep 2
mysqladmin -u root -p"\${ROOT_PASS}" ping 2>/dev/null | grep -q "alive" && ok "MySQL running" || true

# ── Check / Create Global DB ─────────────────────────────────────
echo ""; echo "── Check Global DB ──"
\$MYSQL -e "USE \${GLOBAL_DB}; SELECT 'OK';" 2>/dev/null && ok "Global DB '\${GLOBAL_DB}' OK" || {
    fail "Global DB missing — creating..."
    \$MYSQL 2>/dev/null <<EOF
CREATE DATABASE IF NOT EXISTS \\\`\${GLOBAL_DB}\\\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '\${GLOBAL_USER}'@'localhost' IDENTIFIED BY '\${GLOBAL_PASS}';
GRANT ALL PRIVILEGES ON \\\`\${GLOBAL_DB}\\\`.* TO '\${GLOBAL_USER}'@'localhost';
FLUSH PRIVILEGES;
EOF
    ok "Global DB created — run setup-db.sh to create all tables!"
}

# ── Create Tenant DB & User ──────────────────────────────────────
echo ""; echo "── Creating Tenant DB & User ──"
\$MYSQL 2>/dev/null <<EOF
CREATE DATABASE IF NOT EXISTS \\\`\${TENANT_NAME}\\\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
DROP USER IF EXISTS '\${TENANT_ID}'@'localhost';
DROP USER IF EXISTS '\${TENANT_ID}'@'127.0.0.1';
CREATE USER '\${TENANT_ID}'@'localhost'  IDENTIFIED BY '\${TENANT_PASS}';
CREATE USER '\${TENANT_ID}'@'127.0.0.1' IDENTIFIED BY '\${TENANT_PASS}';
GRANT ALL PRIVILEGES ON \\\`\${TENANT_NAME}\\\`.* TO '\${TENANT_ID}'@'localhost';
GRANT ALL PRIVILEGES ON \\\`\${TENANT_NAME}\\\`.* TO '\${TENANT_ID}'@'127.0.0.1';
GRANT SELECT                       ON \${GLOBAL_DB}.clients         TO '\${TENANT_ID}'@'localhost';
GRANT SELECT                       ON \${GLOBAL_DB}.suppliers       TO '\${TENANT_ID}'@'localhost';
GRANT SELECT                       ON \${GLOBAL_DB}.routes          TO '\${TENANT_ID}'@'localhost';
GRANT SELECT                       ON \${GLOBAL_DB}.rates           TO '\${TENANT_ID}'@'localhost';
GRANT SELECT                       ON \${GLOBAL_DB}.sms_log         TO '\${TENANT_ID}'@'localhost';
GRANT SELECT                       ON \${GLOBAL_DB}.cdr             TO '\${TENANT_ID}'@'localhost';
GRANT SELECT                       ON \${GLOBAL_DB}.invoices        TO '\${TENANT_ID}'@'localhost';
GRANT SELECT                       ON \${GLOBAL_DB}.billing_summary TO '\${TENANT_ID}'@'localhost';
GRANT SELECT                       ON \${GLOBAL_DB}.device_sessions TO '\${TENANT_ID}'@'localhost';
GRANT INSERT, UPDATE, DELETE ON \${GLOBAL_DB}.clients         TO '\${TENANT_ID}'@'localhost';
GRANT INSERT, UPDATE, DELETE ON \${GLOBAL_DB}.suppliers       TO '\${TENANT_ID}'@'localhost';
GRANT INSERT, UPDATE, DELETE ON \${GLOBAL_DB}.routes          TO '\${TENANT_ID}'@'localhost';
GRANT INSERT, UPDATE, DELETE ON \${GLOBAL_DB}.rates           TO '\${TENANT_ID}'@'localhost';
GRANT INSERT, UPDATE         ON \${GLOBAL_DB}.sms_log         TO '\${TENANT_ID}'@'localhost';
GRANT INSERT, UPDATE         ON \${GLOBAL_DB}.device_sessions TO '\${TENANT_ID}'@'localhost';
FLUSH PRIVILEGES;
EOF
ok "Tenant DB '\${TENANT_NAME}' and user '\${TENANT_ID}' created"

# ── Create Views ─────────────────────────────────────────────────
echo ""; echo "── Creating Views ──"
\$MYSQL "\${TENANT_NAME}" 2>/dev/null <<EOF
CREATE OR REPLACE VIEW v_clients         AS SELECT * FROM \${GLOBAL_DB}.clients         WHERE tenant_id='\${TENANT_ID}';
CREATE OR REPLACE VIEW v_suppliers       AS SELECT * FROM \${GLOBAL_DB}.suppliers       WHERE tenant_id='\${TENANT_ID}';
CREATE OR REPLACE VIEW v_routes          AS SELECT * FROM \${GLOBAL_DB}.routes          WHERE tenant_id='\${TENANT_ID}';
CREATE OR REPLACE VIEW v_rates           AS SELECT * FROM \${GLOBAL_DB}.rates           WHERE tenant_id='\${TENANT_ID}';
CREATE OR REPLACE VIEW v_sms_log         AS SELECT * FROM \${GLOBAL_DB}.sms_log         WHERE tenant_id='\${TENANT_ID}';
CREATE OR REPLACE VIEW v_cdr             AS SELECT * FROM \${GLOBAL_DB}.cdr             WHERE tenant_id='\${TENANT_ID}';
CREATE OR REPLACE VIEW v_invoices        AS SELECT * FROM \${GLOBAL_DB}.invoices        WHERE tenant_id='\${TENANT_ID}';
CREATE OR REPLACE VIEW v_billing_summary AS SELECT * FROM \${GLOBAL_DB}.billing_summary WHERE tenant_id='\${TENANT_ID}';
CREATE OR REPLACE VIEW v_device_sessions AS SELECT * FROM \${GLOBAL_DB}.device_sessions WHERE tenant_id='\${TENANT_ID}';

CREATE OR REPLACE VIEW v_today_summary AS
    SELECT COUNT(*) AS total_sms,
           SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END) AS delivered,
           SUM(CASE WHEN status='failed'    THEN 1 ELSE 0 END) AS failed,
           SUM(CASE WHEN status='pending'   THEN 1 ELSE 0 END) AS pending,
           SUM(cost) AS total_cost, SUM(sell_rate) AS total_revenue,
           ROUND(AVG(CASE WHEN status='delivered' THEN 1.0 ELSE 0 END)*100,2) AS dlr_pct
    FROM \${GLOBAL_DB}.sms_log
    WHERE tenant_id='\${TENANT_ID}' AND DATE(submit_time)=CURDATE();

CREATE OR REPLACE VIEW v_supplier_stats AS
    SELECT supplier_id, supplier_name, COUNT(*) AS total,
           SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END) AS delivered,
           SUM(CASE WHEN status='failed'    THEN 1 ELSE 0 END) AS failed,
           ROUND(AVG(CASE WHEN status='delivered' THEN 1.0 ELSE 0 END)*100,2) AS dlr_pct,
           SUM(cost) AS total_cost
    FROM \${GLOBAL_DB}.sms_log WHERE tenant_id='\${TENANT_ID}'
    GROUP BY supplier_id, supplier_name;
EOF
ok "Views created"

# ── Create Local Tables ──────────────────────────────────────────
echo ""; echo "── Creating Local Tables ──"
\$MYSQL "\${TENANT_NAME}" 2>/dev/null <<'EOF'
CREATE TABLE IF NOT EXISTS tenant_settings (
  id INT NOT NULL AUTO_INCREMENT, setting_key VARCHAR(100) NOT NULL, setting_value TEXT, description VARCHAR(256),
  created_at DATETIME DEFAULT NOW(), updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  PRIMARY KEY (id), UNIQUE KEY uk_key (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS api_keys (
  id INT NOT NULL AUTO_INCREMENT, key_name VARCHAR(100) NOT NULL, api_key VARCHAR(255) NOT NULL,
  api_secret VARCHAR(255), permissions JSON, is_active TINYINT(1) DEFAULT 1, last_used DATETIME,
  created_at DATETIME DEFAULT NOW(), expires_at DATETIME DEFAULT NULL,
  PRIMARY KEY (id), UNIQUE KEY uk_key (api_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS wallet (
  id INT NOT NULL AUTO_INCREMENT, balance DECIMAL(15,4) DEFAULT 0.0000,
  currency VARCHAR(10) DEFAULT 'USD', credit_limit DECIMAL(15,4) DEFAULT 0.0000,
  updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id BIGINT NOT NULL AUTO_INCREMENT, type ENUM('credit','debit','refund','adjustment') NOT NULL,
  amount DECIMAL(15,4) NOT NULL, balance_after DECIMAL(15,4), reference VARCHAR(128), description TEXT,
  created_by VARCHAR(64), created_at DATETIME DEFAULT NOW(),
  PRIMARY KEY (id), INDEX idx_date (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tenant_users (
  id VARCHAR(64) NOT NULL, email VARCHAR(128) NOT NULL, name VARCHAR(128), password_hash VARCHAR(256),
  role ENUM('admin','operator','viewer','billing') DEFAULT 'operator', is_active TINYINT(1) DEFAULT 1,
  last_login DATETIME, permissions JSON, created_at DATETIME DEFAULT NOW(), updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  PRIMARY KEY (id), UNIQUE KEY uk_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT NOT NULL AUTO_INCREMENT, type ENUM('alert','info','warning','error') DEFAULT 'info',
  title VARCHAR(256), message TEXT, is_read TINYINT(1) DEFAULT 0, data JSON, created_at DATETIME DEFAULT NOW(),
  PRIMARY KEY (id), INDEX idx_read (is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO wallet (id, balance, currency) VALUES (1, 0.0000, 'USD');
EOF
ok "Local tables created"

# ── Insert Default Settings ──────────────────────────────────────
\$MYSQL "\${TENANT_NAME}" 2>/dev/null <<EOF
INSERT IGNORE INTO tenant_settings (setting_key, setting_value, description) VALUES
('tenant_id',       '\${TENANT_ID}',   'Tenant identifier'),
('tenant_db',       '\${TENANT_NAME}', 'Tenant database'),
('timezone',        'UTC',             'Default timezone'),
('currency',        'USD',             'Default currency'),
('max_tps',         '100',             'Max TPS'),
('reroute_enabled', '1',               'Auto reroute on fail'),
('setup_complete',  '1',               'Setup complete');
EOF
ok "Default settings inserted"

# ── Register in Global DB ────────────────────────────────────────
\$MYSQL \${GLOBAL_DB} -e "INSERT INTO tenants (id,name,plan,status) VALUES ('\${TENANT_ID}','\${TENANT_NAME}','basic','active') ON DUPLICATE KEY UPDATE name='\${TENANT_NAME}',status='active';" 2>/dev/null && ok "Registered in global DB" || true

# ── Save Credentials ─────────────────────────────────────────────
cat > /root/.tenant_\${TENANT_ID} <<EOF
TENANT_ID=\${TENANT_ID}
TENANT_DB=\${TENANT_NAME}
TENANT_PASS=\${TENANT_PASS}
MYSQL_URL=mysql://\${TENANT_ID}:\${TENANT_PASS}@localhost:3306/\${TENANT_NAME}
EOF
chmod 600 /root/.tenant_\${TENANT_ID}

# ── Verify ───────────────────────────────────────────────────────
echo ""; echo "════════════════════════════════════════"
echo "  VERIFICATION"
echo "════════════════════════════════════════"
echo ""; echo "── Views ──"
\$MYSQL "\${TENANT_NAME}" -e "SHOW FULL TABLES WHERE Table_type='VIEW';" 2>/dev/null
echo ""; echo "── Tables ──"
\$MYSQL "\${TENANT_NAME}" -e "SHOW FULL TABLES WHERE Table_type='BASE TABLE';" 2>/dev/null
echo ""; echo "── Grants ──"
\$MYSQL -e "SHOW GRANTS FOR '\${TENANT_ID}'@'localhost';" 2>/dev/null
echo ""; echo "── Tenant Login Test ──"
mysql -u "\${TENANT_ID}" -p"\${TENANT_PASS}" "\${TENANT_NAME}" \
    -e "SELECT COUNT(*) AS sms_count FROM v_sms_log; SELECT balance FROM wallet;" 2>/dev/null \
    && ok "Tenant login: OK" || fail "Tenant login FAILED"

echo ""
echo "════════════════════════════════════════"
echo -e "\${GREEN}  TENANT READY!\${NC}"
echo "════════════════════════════════════════"
echo "  DB:   \${TENANT_NAME}"
echo "  User: \${TENANT_ID} / \${TENANT_PASS}"
echo "  mysql -u \${TENANT_ID} -p\${TENANT_PASS} \${TENANT_NAME}"
echo "  Creds: cat /root/.tenant_\${TENANT_ID}"
echo "════════════════════════════════════════"`,

  billing_trigger: `-- ════════════════════════════════════════════════════════════════════
--  Net2app Real-Time Billing — Billing-Type Aware Trigger
--  CLIENT billing_type: send | submit | delivery
--  SUPPLIER always charged only on successful submit
-- ════════════════════════════════════════════════════════════════════

DELIMITER //
CREATE OR REPLACE TRIGGER trg_sms_billing_update
AFTER UPDATE ON net2app.sms_log FOR EACH ROW
BEGIN
  DECLARE v_period DATE;
  DECLARE v_billing_type VARCHAR(16);
  DECLARE v_force_dlr TINYINT(1);
  DECLARE v_do_client TINYINT(1) DEFAULT 0;
  DECLARE v_do_supplier TINYINT(1) DEFAULT 0;
  SET v_period = DATE(NEW.submit_time);
  SELECT billing_type, force_dlr INTO v_billing_type, v_force_dlr FROM net2app.clients WHERE id = NEW.client_id LIMIT 1;
  SET v_billing_type = IFNULL(v_billing_type, 'submit');
  IF v_billing_type = 'send' THEN
    IF NEW.status NOT IN ('blocked','pending') THEN SET v_do_client = 1; END IF;
  ELSEIF v_billing_type = 'submit' THEN
    IF NEW.status NOT IN ('failed','rejected','blocked','pending') THEN SET v_do_client = 1; END IF;
  ELSEIF v_billing_type = 'delivery' THEN
    IF NEW.status = 'delivered' THEN SET v_do_client = 1; END IF;
    IF v_force_dlr = 1 AND NEW.status NOT IN ('failed','rejected','blocked','pending') THEN SET v_do_client = 1; END IF;
  END IF;
  IF NEW.status NOT IN ('failed','rejected','blocked','pending') THEN SET v_do_supplier = 1; END IF;
  INSERT INTO net2app.billing_summary (id, tenant_id, period, total_sms, total_cost, total_revenue, margin)
  VALUES (CONCAT(NEW.tenant_id,'_', v_period), NEW.tenant_id, v_period,
    IF(v_do_client,1,0), IF(v_do_supplier, NEW.cost, 0),
    IF(v_do_client, NEW.sell_rate, 0), IF(v_do_client, NEW.sell_rate, 0) - IF(v_do_supplier, NEW.cost, 0))
  ON DUPLICATE KEY UPDATE
    total_sms     = total_sms     + IF(v_do_client,1,0),
    total_cost    = total_cost    + IF(v_do_supplier, NEW.cost, 0),
    total_revenue = total_revenue + IF(v_do_client, NEW.sell_rate, 0),
    margin        = margin        + IF(v_do_client, NEW.sell_rate, 0) - IF(v_do_supplier, NEW.cost, 0),
    updated_at    = NOW();
END //
DELIMITER ;

DELIMITER //
CREATE OR REPLACE TRIGGER trg_device_supplier_stats
AFTER UPDATE ON net2app.sms_log FOR EACH ROW
BEGIN
  DECLARE v_cat VARCHAR(32);
  SELECT category INTO v_cat FROM net2app.suppliers WHERE id = NEW.supplier_id LIMIT 1;
  IF v_cat IN ('device','android') THEN
    IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN UPDATE net2app.suppliers SET total_delivered = total_delivered + 1 WHERE id = NEW.supplier_id; END IF;
    IF NEW.status = 'failed' AND OLD.status != 'failed' THEN UPDATE net2app.suppliers SET total_failed = total_failed + 1 WHERE id = NEW.supplier_id; END IF;
    IF NEW.status IN ('sent','delivered') AND NEW.fail_reason LIKE '%rerouted%' THEN UPDATE net2app.suppliers SET total_rerouted = total_rerouted + 1 WHERE id = NEW.supplier_id; END IF;
  END IF;
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
allow=g729`,

  firewall: `#!/bin/bash
# Net2app UFW Firewall Setup — Debian 12 — Run as root: bash setup_ufw.sh
set -e
apt-get install -y ufw
echo "y" | ufw reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp      comment 'SSH'
ufw allow 80/tcp      comment 'HTTP'
ufw allow 443/tcp     comment 'HTTPS'
ufw allow 5060/udp    comment 'SIP UDP'
ufw allow 5060/tcp    comment 'SIP TCP'
ufw allow 5080/udp    comment 'SIP ALT UDP'
ufw allow 5080/tcp    comment 'SIP ALT TCP'
ufw allow 6060/udp    comment 'IPTSP ALT'
ufw allow 7074/udp    comment 'BD IIGW'
ufw allow 10000:20000/udp comment 'RTP Audio'
ufw allow from 127.0.0.1 to any port 13000 comment 'Kannel bearerbox admin'
ufw allow from 127.0.0.1 to any port 13001 comment 'Kannel smsbox port'
ufw allow from 127.0.0.1 to any port 13013 comment 'Kannel sendsms'
ufw allow 9095/tcp     comment 'SMPP base port'
ufw allow 9096:9200/tcp comment 'Tenant SMPP ports'
ufw allow 4000:6000/tcp comment 'Tenant HTTP panels'
ufw deny 3306          comment 'MariaDB localhost only'
ufw allow from 127.0.0.1 to any port 5038 comment 'Asterisk AMI'
echo "y" | ufw enable
ufw status verbose`,

  github_deploy: `#!/bin/bash
# Net2app — Initial GitHub Deploy to Debian 12 Server (run as root once)
GITHUB_USER="YOUR_GITHUB_USER"
REPO_NAME="YOUR_REPO_NAME"
DEPLOY_DIR="/opt/net2app"
NODE_VERSION="20"

curl -fsSL https://deb.nodesource.com/setup_\${NODE_VERSION}.x | bash -
apt-get install -y nodejs git build-essential
mkdir -p \$DEPLOY_DIR
git clone https://github.com/\${GITHUB_USER}/\${REPO_NAME}.git \$DEPLOY_DIR
cd \$DEPLOY_DIR
npm install && npm run build
cp -r dist/* /var/www/html/
npm install -g pm2

cat > /etc/nginx/sites-available/net2app << 'NGINX'
server {
    listen 80; server_name _;
    root /var/www/html; index index.html;
    location / { try_files $uri $uri/ /index.html; }
}
NGINX

ln -sf /etc/nginx/sites-available/net2app /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
echo "✅ Net2app deployed at http://\$(hostname -I | awk '{print \$1}')"`,

  github_update: `#!/bin/bash
# Net2app v2.1.0 — Master Deploy + Update Script
# Save as /opt/net2app/deploy.sh — Run: bash /opt/net2app/deploy.sh
set -e
DEPLOY_DIR="/opt/net2app"
WEBROOT="/var/www/html"
BRANCH="main"

echo ""; echo "════════════════════════════════════════════"
echo "  Net2app Master Deploy Script v2.1.0"
echo "  \$(date)"; echo "════════════════════════════════════════════"

echo ""; echo "[1/6] Pulling latest from GitHub (\$BRANCH)..."
cd \$DEPLOY_DIR
git fetch origin
git reset --hard origin/\$BRANCH
echo "    ✅ Code updated — \$(git log -1 --format='%h %s')"

echo ""; echo "[2/6] Installing dependencies..."
npm install --production=false
echo "    ✅ Dependencies installed"

echo ""; echo "[3/6] Building React frontend..."
npm run build
echo "    ✅ Build complete — \$(du -sh dist/ 2>/dev/null | cut -f1) output"

echo ""; echo "[4/6] Deploying to \$WEBROOT..."
mkdir -p \$WEBROOT
cp -r dist/* \$WEBROOT/
echo "    ✅ Files deployed"

echo ""; echo "[5/6] Reloading nginx..."
nginx -t && systemctl reload nginx
echo "    ✅ Nginx reloaded"

echo ""; echo "[6/6] Health check..."
systemctl is-active nginx       && echo "    ✅ Nginx:     RUNNING" || echo "    ❌ Nginx:     FAILED"
systemctl is-active mariadb     && echo "    ✅ MariaDB:   RUNNING" || echo "    ❌ MariaDB:   FAILED"
systemctl is-active kannel-bearerbox && echo "    ✅ Bearerbox: RUNNING" || echo "    ⚠️  Bearerbox: not running"
systemctl is-active asterisk    && echo "    ✅ Asterisk:  RUNNING" || echo "    ⚠️  Asterisk:  not running"

echo ""; echo "════════════════════════════════════════════"
echo "  ✅ Deploy complete — \$(date)"
echo "  App: http://\$(hostname -I | awk '{print \$1}')"
echo "════════════════════════════════════════════"`,

  github_actions: `# .github/workflows/deploy.yml
name: Deploy Net2app
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm install && npm run build
      - uses: appleboy/ssh-action@v1.0.3
        with:
          host: \${{ secrets.SERVER_HOST }}
          username: \${{ secrets.SERVER_USER }}
          key: \${{ secrets.SERVER_KEY }}
          script: |
            cd /opt/net2app
            git fetch origin && git reset --hard origin/main
            npm install && npm run build
            cp -r dist/* /var/www/html/
            nginx -t && systemctl reload nginx
            echo "Deployed at \$(date)"`,

  github_ssh: `# Setup SSH Key for GitHub → Server Auto Deploy
ssh-keygen -t ed25519 -C "net2app-deploy" -f ~/.ssh/deploy_key -N ""
cat ~/.ssh/deploy_key.pub   # Add to GitHub Repo → Settings → Deploy Keys
cat ~/.ssh/deploy_key        # Add to GitHub Actions secret SERVER_KEY

cat >> ~/.ssh/config << 'EOF'
Host github.com
  IdentityFile ~/.ssh/deploy_key
  StrictHostKeyChecking no
EOF

ssh -T git@github.com
cat ~/.ssh/deploy_key.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys`,

  android_apk: `# Net2app Android SMS Gateway — APK Integration Guide
# The APK turns any Android phone into a real SMS supplier using its SIM card.

# How it works:
# 1. Install Net2app Android APK on the phone
# 2. APK exposes a local HTTP server (port 8080)
# 3. Platform sends HTTP POST to APK webhook URL
# 4. APK sends real SMS via Android SIM telephony API
# 5. APK sends DLR callback on delivery/failure
# 6. Platform charges client only on DLR (billing_type = delivery)

# APK Webhook (POST http://DEVICE_IP:8080/send)
# Headers: Authorization: Bearer API_TOKEN
# Body: { "to": "+880...", "message": "OTP 1234", "message_id": "...", "dlr_url": "http://..." }

# DLR Callback: GET http://PLATFORM_IP/dlr?id=MSG_ID&status=DELIVERED|FAILED

# Key Rules:
# • Each Android device = one Supplier (category: android)
# • Set allowed_prefixes per device (e.g. "880,971") — strictly per device
# • Billing: DLR-only
# • Fail → auto-reroute to fallback SMPP/HTTP supplier
# • Multiple devices: Round Robin routing across SIM cards

# APK Permissions: SEND_SMS, READ_PHONE_STATE, RECEIVE_SMS, INTERNET, WAKE_LOCK, FOREGROUND_SERVICE`,

  setup_billing: `#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
#  Net2app — Billing Triggers + Stored Procedures + Frontend Sync
#  Run as root: bash setup-billing.sh
# ═══════════════════════════════════════════════════════════════════
set -e

GREEN='\\033[0;32m'; RED='\\033[0;31m'; YELLOW='\\033[1;33m'; BLUE='\\033[0;34m'; NC='\\033[0m'
ok()     { echo -e "\${GREEN}[OK]\${NC} \$1"; }
fail()   { echo -e "\${RED}[FAIL]\${NC} \$1"; exit 1; }
info()   { echo -e "\${YELLOW}[i]\${NC} \$1"; }
header() { echo -e "\\n\${BLUE}== \$1 ==\${NC}\\n"; }

ROOT_PASS="Telco1988"
DB_NAME="net2app"

if [ "\$EUID" -ne 0 ]; then exec sudo bash "\$0" "\$@"; fi

header "STEP 1: Verify MySQL"
systemctl start mysql 2>/dev/null || true; sleep 2
mysqladmin -u root -p"\${ROOT_PASS}" ping 2>/dev/null | grep -q "alive" && ok "MySQL running" || fail "MySQL not running"

header "STEP 2: Update Tables"
mysql -u root -p\${ROOT_PASS} \${DB_NAME} 2>/dev/null <<'EOF'
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS billing_type      ENUM('send','submit','delivery') DEFAULT 'submit',
  ADD COLUMN IF NOT EXISTS force_dlr         TINYINT(1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS force_dlr_timeout INT DEFAULT 30;
ALTER TABLE billing_summary
  ADD COLUMN IF NOT EXISTS margin DECIMAL(14,4) DEFAULT 0.0000;
ALTER TABLE sms_log
  MODIFY COLUMN status ENUM('pending','sent','delivered','failed','rejected','blocked','rerouted','submitted') DEFAULT 'pending';
SELECT 'Tables updated' AS result;
EOF
ok "Tables updated"

header "STEP 3: Drop Old Triggers"
mysql -u root -p\${ROOT_PASS} \${DB_NAME} 2>/dev/null <<'EOF'
DROP TRIGGER IF EXISTS trg_sms_billing_update;
DROP TRIGGER IF EXISTS trg_device_supplier_stats;
DROP TRIGGER IF EXISTS trg_device_supplier_sent;
DROP TRIGGER IF EXISTS trg_sms_billing_insert;
EOF

header "STEP 4: Create Triggers"
mysql -u root -p\${ROOT_PASS} \${DB_NAME} 2>/dev/null <<'EOTRIGGER'
CREATE TRIGGER trg_sms_billing_update
AFTER UPDATE ON sms_log FOR EACH ROW
BEGIN
  DECLARE v_period DATE; DECLARE v_billing_type VARCHAR(16); DECLARE v_force_dlr TINYINT(1);
  DECLARE v_do_client TINYINT(1) DEFAULT 0; DECLARE v_do_supplier TINYINT(1) DEFAULT 0;
  SET v_period = DATE(NEW.submit_time);
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
  IF NEW.status != OLD.status THEN
    INSERT INTO billing_summary (id, tenant_id, period, total_sms, total_cost, total_revenue, margin)
    VALUES (CONCAT(NEW.tenant_id,'_',DATE_FORMAT(v_period,'%Y%m%d')), NEW.tenant_id, v_period,
      IF(v_do_client,1,0), IF(v_do_supplier,NEW.cost,0), IF(v_do_client,NEW.sell_rate,0),
      IF(v_do_client,NEW.sell_rate,0)-IF(v_do_supplier,NEW.cost,0))
    ON DUPLICATE KEY UPDATE
      total_sms=total_sms+IF(v_do_client,1,0), total_cost=total_cost+IF(v_do_supplier,NEW.cost,0),
      total_revenue=total_revenue+IF(v_do_client,NEW.sell_rate,0),
      margin=margin+IF(v_do_client,NEW.sell_rate,0)-IF(v_do_supplier,NEW.cost,0), updated_at=NOW();
    IF v_do_client=1 THEN UPDATE clients SET balance=balance-NEW.sell_rate WHERE id=NEW.client_id; END IF;
  END IF;
END;
EOTRIGGER
ok "Trigger 1: trg_sms_billing_update"

mysql -u root -p\${ROOT_PASS} \${DB_NAME} 2>/dev/null <<'EOTRIGGER'
CREATE TRIGGER trg_device_supplier_stats
AFTER UPDATE ON sms_log FOR EACH ROW
BEGIN
  DECLARE v_cat VARCHAR(32);
  SELECT category INTO v_cat FROM suppliers WHERE id=NEW.supplier_id LIMIT 1;
  IF v_cat IN ('device','android','whatsapp','telegram','imo') THEN
    IF NEW.status='delivered' AND OLD.status!='delivered' THEN UPDATE suppliers SET total_delivered=total_delivered+1 WHERE id=NEW.supplier_id; END IF;
    IF NEW.status='failed' AND OLD.status!='failed' THEN UPDATE suppliers SET total_failed=total_failed+1 WHERE id=NEW.supplier_id; END IF;
    IF NEW.status IN ('sent','delivered','rerouted') AND NEW.fail_reason LIKE '%rerouted%' AND OLD.status!=NEW.status THEN UPDATE suppliers SET total_rerouted=total_rerouted+1 WHERE id=NEW.supplier_id; END IF;
  END IF;
END;
EOTRIGGER
ok "Trigger 2: trg_device_supplier_stats"

mysql -u root -p\${ROOT_PASS} \${DB_NAME} 2>/dev/null <<'EOTRIGGER'
CREATE TRIGGER trg_device_supplier_sent
AFTER INSERT ON sms_log FOR EACH ROW
BEGIN
  DECLARE v_cat VARCHAR(32);
  SELECT category INTO v_cat FROM suppliers WHERE id=NEW.supplier_id LIMIT 1;
  IF v_cat IN ('device','android','whatsapp','telegram','imo') THEN
    UPDATE suppliers SET total_sent=total_sent+1 WHERE id=NEW.supplier_id;
  END IF;
END;
EOTRIGGER
ok "Trigger 3: trg_device_supplier_sent"

mysql -u root -p\${ROOT_PASS} \${DB_NAME} 2>/dev/null <<'EOTRIGGER'
CREATE TRIGGER trg_sms_billing_insert
AFTER INSERT ON sms_log FOR EACH ROW
BEGIN
  DECLARE v_billing_type VARCHAR(16); DECLARE v_force_dlr TINYINT(1);
  SELECT IFNULL(billing_type,'submit'), IFNULL(force_dlr,0) INTO v_billing_type, v_force_dlr FROM clients WHERE id=NEW.client_id LIMIT 1;
  IF v_billing_type='send' AND NEW.status NOT IN ('blocked','pending') THEN
    INSERT INTO billing_summary (id, tenant_id, period, total_sms, total_cost, total_revenue, margin)
    VALUES (CONCAT(NEW.tenant_id,'_',DATE_FORMAT(DATE(NEW.submit_time),'%Y%m%d')), NEW.tenant_id, DATE(NEW.submit_time), 1, NEW.cost, NEW.sell_rate, NEW.sell_rate-NEW.cost)
    ON DUPLICATE KEY UPDATE total_sms=total_sms+1, total_cost=total_cost+NEW.cost, total_revenue=total_revenue+NEW.sell_rate, margin=margin+(NEW.sell_rate-NEW.cost), updated_at=NOW();
    UPDATE clients SET balance=balance-NEW.sell_rate WHERE id=NEW.client_id;
  END IF;
END;
EOTRIGGER
ok "Trigger 4: trg_sms_billing_insert"

header "STEP 5: Stored Procedures"
mysql -u root -p\${ROOT_PASS} \${DB_NAME} 2>/dev/null <<'EOPROC'
DROP PROCEDURE IF EXISTS sp_today_dashboard;
DROP PROCEDURE IF EXISTS sp_generate_invoice;
DROP PROCEDURE IF EXISTS sp_supplier_report;
DROP PROCEDURE IF EXISTS sp_client_report;

CREATE PROCEDURE sp_today_dashboard(IN p_tenant_id VARCHAR(64))
BEGIN
  SELECT COUNT(*) AS total_sms,
    SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END) AS delivered,
    SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed,
    SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending,
    ROUND(SUM(CASE WHEN status='delivered' THEN 1.0 ELSE 0 END)/NULLIF(COUNT(*),0)*100,2) AS dlr_rate,
    IFNULL(SUM(cost),0) AS total_cost, IFNULL(SUM(sell_rate),0) AS total_revenue,
    IFNULL(SUM(sell_rate)-SUM(cost),0) AS total_margin
  FROM sms_log WHERE tenant_id=p_tenant_id AND DATE(submit_time)=CURDATE();

  SELECT supplier_name, COUNT(*) AS total,
    SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END) AS delivered,
    ROUND(SUM(CASE WHEN status='delivered' THEN 1.0 ELSE 0 END)/NULLIF(COUNT(*),0)*100,2) AS dlr_pct,
    IFNULL(SUM(cost),0) AS cost
  FROM sms_log WHERE tenant_id=p_tenant_id AND DATE(submit_time)=CURDATE()
  GROUP BY supplier_name ORDER BY total DESC LIMIT 5;

  SELECT HOUR(submit_time) AS hour, COUNT(*) AS total,
    SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END) AS delivered,
    SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed
  FROM sms_log WHERE tenant_id=p_tenant_id AND DATE(submit_time)=CURDATE()
  GROUP BY HOUR(submit_time) ORDER BY hour;
END;

CREATE PROCEDURE sp_supplier_report(IN p_tenant_id VARCHAR(64), IN p_supplier_id VARCHAR(64), IN p_start DATE, IN p_end DATE)
BEGIN
  SELECT supplier_id, supplier_name, country, network, COUNT(*) AS total_sent,
    SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END) AS delivered,
    SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed,
    ROUND(SUM(CASE WHEN status='delivered' THEN 1.0 ELSE 0 END)/NULLIF(COUNT(*),0)*100,2) AS dlr_pct,
    IFNULL(SUM(cost),0) AS total_cost
  FROM sms_log
  WHERE tenant_id=p_tenant_id AND (p_supplier_id IS NULL OR supplier_id=p_supplier_id)
    AND submit_time BETWEEN p_start AND DATE_ADD(p_end, INTERVAL 1 DAY)
  GROUP BY supplier_id, supplier_name, country, network ORDER BY total_sent DESC;
END;

CREATE PROCEDURE sp_client_report(IN p_tenant_id VARCHAR(64), IN p_client_id VARCHAR(64), IN p_start DATE, IN p_end DATE)
BEGIN
  SELECT client_id, client_name, country, network, COUNT(*) AS total_sms,
    IFNULL(SUM(sell_rate),0) AS total_revenue, IFNULL(SUM(cost),0) AS total_cost,
    IFNULL(SUM(sell_rate)-SUM(cost),0) AS margin
  FROM sms_log
  WHERE tenant_id=p_tenant_id AND (p_client_id IS NULL OR client_id=p_client_id)
    AND submit_time BETWEEN p_start AND DATE_ADD(p_end, INTERVAL 1 DAY)
  GROUP BY client_id, client_name, country, network ORDER BY total_revenue DESC;
END;
EOPROC
ok "Stored procedures created"

header "STEP 6: Verify"
mysql -u root -p\${ROOT_PASS} \${DB_NAME} \
  -e "SELECT trigger_name, event_manipulation, action_timing FROM information_schema.triggers WHERE trigger_schema='\${DB_NAME}';" 2>/dev/null
mysql -u root -p\${ROOT_PASS} \${DB_NAME} \
  -e "SELECT routine_name, routine_type FROM information_schema.routines WHERE routine_schema='\${DB_NAME}';" 2>/dev/null

echo ""
echo "============================================"
echo "  BILLING SYSTEM READY"
echo "============================================"
echo "  Triggers: trg_sms_billing_insert, trg_sms_billing_update"
echo "            trg_device_supplier_stats, trg_device_supplier_sent"
echo "  SPs:      sp_today_dashboard, sp_supplier_report, sp_client_report"
echo "============================================"`,

  fix_asterisk_dirs: `#!/bin/bash
# ============================================
# FIX ASTERISK - Missing Dirs + Re-Install
# Run as root: bash fix-asterisk-dirs.sh
# ============================================

if [ "$EUID" -ne 0 ]; then exec sudo bash "$0" "$@"; fi

GREEN='\\033[0;32m'; RED='\\033[0;31m'; YELLOW='\\033[1;33m'; NC='\\033[0m'
ok()   { echo -e "\${GREEN}[OK]\${NC} \$1"; }
fail() { echo -e "\${RED}[FAIL]\${NC} \$1"; }
info() { echo -e "\${YELLOW}[i]\${NC} \$1"; }

ASTERISK_SRC=\$(find /usr/src -maxdepth 1 -name "asterisk-20*" -type d 2>/dev/null | head -1)
info "Source: \$ASTERISK_SRC"

echo ""; echo "════════════════════════════════════════"
echo "  FIX ASTERISK DIRECTORIES & INSTALL"
echo "════════════════════════════════════════"

echo ""; echo "── Creating All Required Directories ──"
for DIR in \\
    /var/lib/asterisk /var/lib/asterisk/phoneprov /var/lib/asterisk/sounds \\
    /var/lib/asterisk/sounds/en /var/lib/asterisk/moh /var/lib/asterisk/keys \\
    /var/lib/asterisk/agi-bin /var/lib/asterisk/documentation \\
    /var/lib/asterisk/firmware /var/lib/asterisk/images \\
    /var/lib/asterisk/static-http /var/lib/asterisk/res_parking \\
    /var/spool/asterisk /var/spool/asterisk/voicemail \\
    /var/spool/asterisk/voicemail/default \\
    /var/spool/asterisk/voicemail/default/1234 \\
    /var/spool/asterisk/voicemail/default/1234/INBOX \\
    /var/spool/asterisk/voicemail/default/1001 \\
    /var/spool/asterisk/voicemail/default/1001/INBOX \\
    /var/spool/asterisk/voicemail/default/1002 \\
    /var/spool/asterisk/voicemail/default/1002/INBOX \\
    /var/spool/asterisk/monitor /var/spool/asterisk/outgoing \\
    /var/spool/asterisk/outgoing_temp /var/spool/asterisk/tmp \\
    /var/spool/asterisk/meetme /var/spool/asterisk/recording \\
    /var/log/asterisk /var/log/asterisk/cdr-csv /var/log/asterisk/cdr-custom \\
    /run/asterisk /etc/asterisk; do
    mkdir -p "\$DIR" && ok "Created: \$DIR"
done

echo ""; echo "── Setting Permissions ──"
id asterisk &>/dev/null || useradd -r -d /var/lib/asterisk -s /usr/sbin/nologin -c "Asterisk PBX" asterisk
chown -R asterisk:asterisk /var/lib/asterisk /var/spool/asterisk /var/log/asterisk /run/asterisk /etc/asterisk 2>/dev/null
chmod -R 755 /var/lib/asterisk
ok "Permissions set"

echo ""; echo "── Running make install ──"
if [ -n "\$ASTERISK_SRC" ]; then
    cd "\$ASTERISK_SRC"
    info "Running: make install..."
    make install 2>&1 | grep -v "^$" | tail -10 && ok "make install done"
    info "Running: make samples..."
    make samples 2>&1 | grep -iE "^error" | head -5 || ok "make samples done"
    info "Running: make config..."
    make config  2>&1 | tail -5 && ok "make config done"
    ldconfig && ok "ldconfig updated"
else
    fail "No asterisk source found in /usr/src — run install_asterisk.sh first"
    exit 1
fi

echo ""; echo "── Verify Binary ──"
ASTERISK_BIN=\$(which asterisk 2>/dev/null || find /usr -name "asterisk" -type f -executable 2>/dev/null | head -1)
info "Binary: \$ASTERISK_BIN"
if [ -n "\$ASTERISK_BIN" ]; then
    \$ASTERISK_BIN -V && ok "Binary working"
    [ "\$ASTERISK_BIN" != "/usr/sbin/asterisk" ] && ln -sf "\$ASTERISK_BIN" /usr/sbin/asterisk && ok "Symlink created"
else
    fail "Binary not found after install"; exit 1
fi

echo ""; echo "── Writing Config Files ──"
cat > /etc/asterisk/asterisk.conf <<'EOF'
[options]
runuser  = asterisk
rungroup = asterisk
verbose  = 3
debug    = 0
alwaysfork = no
nofork = yes

[directories]
astetcdir    => /etc/asterisk
astmoddir    => /usr/lib/asterisk/modules
astvarlibdir => /var/lib/asterisk
astdbdir     => /var/lib/asterisk
astkeydir    => /var/lib/asterisk
astdatadir   => /var/lib/asterisk
astagidir    => /var/lib/asterisk/agi-bin
astspooldir  => /var/spool/asterisk
astrundir    => /run/asterisk
astlogdir    => /var/log/asterisk
astsbindir   => /usr/sbin
EOF
ok "asterisk.conf"

cat > /etc/asterisk/modules.conf <<'EOF'
[modules]
autoload = yes
noload => cdr_radius.so
noload => cel_radius.so
noload => cdr_tds.so
noload => cel_tds.so
noload => cdr_pgsql.so
noload => cel_pgsql.so
noload => cdr_sqlite3_custom.so
noload => cel_sqlite3_custom.so
noload => cel_custom.so
noload => cdr_custom.so
noload => res_snmp.so
noload => res_odbc.so
noload => cdr_odbc.so
noload => cel_odbc.so
noload => res_config_odbc.so
noload => res_phoneprov.so
EOF
ok "modules.conf"

cat > /etc/asterisk/manager.conf <<'EOF'
[general]
enabled     = yes
port        = 5038
bindaddr    = 127.0.0.1
displayconnects = yes

[admin]
secret      = Telco1988
deny        = 0.0.0.0/0.0.0.0
permit      = 127.0.0.1/255.255.255.0
read        = all
write       = all

[net2app]
secret      = Telco1988
deny        = 0.0.0.0/0.0.0.0
permit      = 127.0.0.1/255.255.255.0
read        = all
write       = all
EOF
ok "manager.conf"

cat > /etc/asterisk/sip.conf <<'EOF'
[general]
context         = default
bindport        = 5060
bindaddr        = 0.0.0.0
language        = en
disallow        = all
allow           = ulaw
allow           = alaw
allow           = gsm
nat             = force_rport,comedia
qualify         = yes
alwaysauthreject = yes

[1001]
type      = friend
context   = default
host      = dynamic
secret    = Telco1988
callerid  = "Extension 1001" <1001>
disallow  = all
allow     = ulaw
allow     = alaw

[1002]
type      = friend
context   = default
host      = dynamic
secret    = Telco1988
callerid  = "Extension 1002" <1002>
disallow  = all
allow     = ulaw
allow     = alaw
EOF
ok "sip.conf"

cat > /etc/asterisk/extensions.conf <<'EOF'
[general]
static       = yes
writeprotect = no

[default]
exten => 1001,1,Dial(SIP/1001,30)
 same => n,VoiceMail(1001@default)
 same => n,Hangup()

exten => 1002,1,Dial(SIP/1002,30)
 same => n,VoiceMail(1002@default)
 same => n,Hangup()

exten => 9999,1,Answer()
 same => n,Echo()
 same => n,Hangup()

exten => h,1,Hangup()
EOF
ok "extensions.conf"

cat > /etc/asterisk/logger.conf <<'EOF'
[general]
dateformat = %F %T

[logfiles]
console  => verbose,notice,warning,error
messages => notice,warning,error
full     => verbose,notice,warning,error,debug
EOF
ok "logger.conf"

cat > /etc/asterisk/cdr_mysql.conf <<'EOF'
[global]
hostname = localhost
port     = 3306
dbname   = net2app
password = Telco1988
user     = net2app
table    = cdr
charset  = utf8mb4
EOF
ok "cdr_mysql.conf"

chown -R asterisk:asterisk /etc/asterisk && chmod 640 /etc/asterisk/*.conf
ok "All configs written"

echo ""; echo "── Creating systemd Service ──"
cat > /etc/systemd/system/asterisk.service <<'EOF'
[Unit]
Description=Asterisk PBX
After=network.target

[Service]
Type=simple
User=asterisk
Group=asterisk
Environment=HOME=/var/lib/asterisk
WorkingDirectory=/var/lib/asterisk
ExecStartPre=/bin/mkdir -p /run/asterisk
ExecStartPre=/bin/chown -R asterisk:asterisk /run/asterisk
ExecStart=/usr/sbin/asterisk -C /etc/asterisk/asterisk.conf -f
ExecReload=/usr/sbin/asterisk -rx "core reload"
ExecStop=/usr/sbin/asterisk -rx "core stop now"
Restart=on-failure
RestartSec=5
TimeoutStartSec=60
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload && systemctl enable asterisk && ok "systemd service created"

echo ""; echo "── Starting Asterisk ──"
pkill -9 asterisk 2>/dev/null || true; sleep 2
systemctl start asterisk; sleep 5

if systemctl is-active --quiet asterisk; then
    ok "Asterisk: RUNNING via systemd"
else
    info "systemd failed - checking logs..."
    journalctl -u asterisk --no-pager -n 10
    info "Trying direct start..."
    nohup /usr/sbin/asterisk -C /etc/asterisk/asterisk.conf -f >> /var/log/asterisk/startup.log 2>&1 &
    sleep 5
    if pgrep -f "asterisk" > /dev/null; then
        ok "Asterisk running directly"
    else
        fail "Asterisk still failing — check /var/log/asterisk/startup.log"
    fi
fi

echo ""; echo "── PM2 Fallback ──"
pm2 delete asterisk 2>/dev/null || true
if ! systemctl is-active --quiet asterisk; then
    pm2 start /usr/sbin/asterisk --name asterisk --interpreter none -- -C /etc/asterisk/asterisk.conf -f
    pm2 save && ok "Asterisk managed by PM2"
else
    ok "Asterisk managed by systemd (no PM2 needed)"
fi

echo ""; echo "── Final Tests ──"
sleep 2
/usr/sbin/asterisk -rx "core show version" 2>/dev/null && ok "CLI working" || fail "CLI not working"
/usr/sbin/asterisk -rx "module show"       2>/dev/null | tail -1 && ok "Modules loaded" || true
/usr/sbin/asterisk -rx "sip show peers"    2>/dev/null && ok "SIP working" || true
echo ""; echo "── Ports ──"
ss -tlunp | grep -E "5060|5038"
echo ""; echo "── AMI Test ──"
sleep 1
echo -e "Action: Login\\r\\nUsername: admin\\r\\nSecret: Telco1988\\r\\n\\r\\n" | nc -w3 127.0.0.1 5038 2>/dev/null | head -5

echo ""; echo "════════════════════════════════════════"
echo "  ASTERISK FIX COMPLETE"
echo "════════════════════════════════════════"
echo "  Binary:  /usr/sbin/asterisk"
echo "  Version: \$(asterisk -V 2>/dev/null)"
echo ""
echo "  systemctl status asterisk"
echo "  asterisk -rvvv"
echo "  asterisk -rx 'core show version'"
echo "  asterisk -rx 'sip show peers'"
echo "  asterisk -rx 'core show channels'"
echo ""
echo "  AMI: echo -e 'Action: Login\\r\\nUsername: admin\\r\\nSecret: Telco1988\\r\\n\\r\\n' | nc 127.0.0.1 5038"
echo "  Log: tail -f /var/log/asterisk/messages"
echo "════════════════════════════════════════"`,

  fix_routes: `#!/bin/bash
# ============================================
# FIX — Register Billing Routes in Server
# Run: bash fix-routes.sh
# ============================================
APP_DIR="/var/www/net2app.com"
GREEN='\\033[0;32m'; RED='\\033[0;31m'; YELLOW='\\033[1;33m'; NC='\\033[0m'
ok()   { echo -e "\${GREEN}[OK]\${NC} \$1"; }
fail() { echo -e "\${RED}[FAIL]\${NC} \$1"; }
info() { echo -e "\${YELLOW}[i]\${NC} \$1"; }

echo ""; echo "== Checking Routes =="
grep -n "app.use\\|require\\|routes" \${APP_DIR}/server/index.js 2>/dev/null | head -20
ls -la \${APP_DIR}/server/routes/ 2>/dev/null || echo "routes dir not found"

info "Fixing MySQL pool..."
mkdir -p \${APP_DIR}/server/db

cat > \${APP_DIR}/server/db/mysql.js <<'EOF'
const mysql  = require('mysql2/promise');
const logger = require('../utils/logger');
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT) || 3306,
  database: process.env.MYSQL_DB || 'net2app',
  user: process.env.MYSQL_USER || 'net2app',
  password: process.env.MYSQL_PASS || 'Telco1988',
  connectionLimit: 20, charset: 'utf8mb4',
  timezone: '+00:00', multipleStatements: true
});
async function query(sql, params=[]) {
  try { const [rows] = await pool.execute(sql, params); return rows; }
  catch(err) { logger.error('MySQL: '+err.message); throw err; }
}
async function testConnection() {
  const conn = await pool.getConnection();
  await conn.execute('SELECT 1'); conn.release();
  logger.info('MariaDB connected');
}
module.exports = { pool, query, testConnection };
EOF
ok "MySQL pool created"

info "Registering billing route in index.js..."
if ! grep -q "routes/billing" \${APP_DIR}/server/index.js 2>/dev/null; then
  sed -i "s|app.use('/api/sync'|app.use('/api/billing', require('./routes/billing'));\\napp.use('/api/sync'|" \${APP_DIR}/server/index.js
  ok "Billing route registered"
else
  ok "Billing route already registered"
fi

info "Installing mysql2..."
cd \${APP_DIR}/server && npm install mysql2 2>&1 | tail -2

info "Restarting PM2..."
pm2 restart ecosystem.config.cjs 2>/dev/null || pm2 restart net2app-server 2>/dev/null || true
sleep 4

echo ""; echo "== Testing Routes =="
for ROUTE in "health" "api/billing/health" "api/billing/dashboard?tenant_id=default" "api/billing/sms-log?tenant_id=default&limit=5"; do
  CODE=\$(curl -so /dev/null -w "%{http_code}" --connect-timeout 5 "http://127.0.0.1:5000/\${ROUTE}" 2>/dev/null)
  [ "\$CODE" = "200" ] && ok "/\${ROUTE} -> \${CODE}" || fail "/\${ROUTE} -> \${CODE}"
done

echo ""; echo "  curl http://127.0.0.1:5000/api/billing/dashboard?tenant_id=default"
echo "  pm2 logs net2app-server --lines 20"`,

  tenant_smtp: `# Tenant SMTP + Logo Branding (per-tenant via dashboard)
# Stored in SystemSettings entity, used for rate card emails and invoices.

# setting_key = smtp_host_tenant_{id}  value = smtp.gmail.com
# setting_key = smtp_port_tenant_{id}  value = 587
# setting_key = smtp_user_tenant_{id}  value = admin@company.com
# setting_key = smtp_pass_tenant_{id}  value = APP_PASSWORD
# setting_key = smtp_from_tenant_{id}  value = "Company Name <admin@company.com>"
# setting_key = logo_url_tenant_{id}   value = https://cdn.../logo.png

# Rate Card Email:
# Subject: Rate Update — [Destination] — [Date]
# Body: HTML table — MCC | MNC | Country | Network | Rate | Currency | Effective Date
# Attached: CSV export`,
};

export const ARCH = `
  ┌─────────────────────────────────────────────────────────────────┐
  │               Net2app — Debian 12 Multi-Tenant Platform         │
  │                                                                 │
  │  ┌──────────────────────────────────────────────────────────┐  │
  │  │   KANNEL BEARERBOX (core) — port 13000 admin              │  │
  │  │   • SMPP SERVER mode: listens per-tenant ports 9096+      │  │
  │  │   • SMPP CLIENT mode: connects OUT to suppliers           │  │
  │  │   • HTTP CLIENT mode: forwards to HTTP API suppliers      │  │
  │  │   • SIM Box (BearBox/GoIP) via AT modem or SMPP          │  │
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
  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐   │
  │  │  Asterisk 20 │  │  Net2app API │  │  Nginx (tenant)    │   │
  │  │  PJSIP :5060 │  │  DLR handler │  │  4000–6000 panels  │   │
  │  │  AMI   :5038 │  │  CDR billing │  │  80/443 admin      │   │
  │  │  CDR → DB    │  └──────────────┘  └────────────────────┘   │
  │  └──────────────┘                                               │
  │                                                                 │
  │  Tenants → SMPP bind to port 9096+  (bearerbox SMPP server)    │
  │  Suppliers ← SMPP/HTTP connect out  (bearerbox client)         │
  │  SIM Boxes ← AT/SMPP devices        (bearerbox bearer)         │
  │  Android Suppliers ← APK HTTP webhook (real SIM SMS + DLR)     │
  └─────────────────────────────────────────────────────────────────┘
`;