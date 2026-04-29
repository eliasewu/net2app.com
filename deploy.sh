#!/bin/bash
# ============================================================
# NET2APP - Full Debian 12 Server Deployment Script
# Usage: bash <(curl -s https://raw.githubusercontent.com/eliasewu/net2app.com/main/deploy.sh)
# ============================================================
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✔] $1${NC}"; }
warn() { echo -e "${YELLOW}[⚠] $1${NC}"; }
err()  { echo -e "${RED}[✘] $1${NC}"; exit 1; }
info() { echo -e "${BLUE}[ℹ] $1${NC}"; }

echo ""
echo "============================================================"
echo "   NET2APP - Full Debian 12 Deployment"
echo "   SMS Routing + VoIP + Kannel + Asterisk + MariaDB"
echo "============================================================"
echo ""

# ── STEP 1: System Update ────────────────────────────────────
info "STEP 1: Updating system packages..."
apt-get update -y && apt-get upgrade -y
apt-get install -y curl wget git unzip software-properties-common gnupg2 \
  build-essential libssl-dev libffi-dev python3 python3-pip \
  ufw fail2ban htop net-tools lsof nano vim sudo ca-certificates \
  apt-transport-https lsb-release
log "System updated"

# ── STEP 2: MariaDB ──────────────────────────────────────────
info "STEP 2: Installing MariaDB..."
apt-get install -y mariadb-server mariadb-client
systemctl enable mariadb && systemctl start mariadb
# Secure MariaDB
mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED BY 'Net2app@2024!';"
mysql -uroot -pNet2app@2024! -e "DELETE FROM mysql.user WHERE User='';"
mysql -uroot -pNet2app@2024! -e "DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost','127.0.0.1','::1');"
mysql -uroot -pNet2app@2024! -e "DROP DATABASE IF EXISTS test;"
mysql -uroot -pNet2app@2024! -e "FLUSH PRIVILEGES;"
# Create net2app database
mysql -uroot -pNet2app@2024! -e "CREATE DATABASE IF NOT EXISTS net2app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -uroot -pNet2app@2024! -e "CREATE USER IF NOT EXISTS 'net2app'@'localhost' IDENTIFIED BY 'Net2app@2024!';"
mysql -uroot -pNet2app@2024! -e "GRANT ALL PRIVILEGES ON net2app.* TO 'net2app'@'localhost'; FLUSH PRIVILEGES;"
log "MariaDB installed — DB: net2app, User: net2app, Pass: Net2app@2024!"

# ── STEP 3: Asterisk (VoIP) ──────────────────────────────────
info "STEP 3: Installing Asterisk 20 LTS..."
apt-get install -y asterisk
systemctl enable asterisk && systemctl start asterisk
log "Asterisk installed"

# ── STEP 4: Kannel (SMS Gateway) ─────────────────────────────
info "STEP 4: Installing Kannel SMS Gateway..."
apt-get install -y kannel
cat > /etc/kannel/kannel.conf << 'KANNEL_EOF'
group = core
log-file = "/var/log/kannel/bearerbox.log"
log-level = 0
smpp-loopback = true
admin-port = 13000
admin-password = net2app123
wdp-interface-name = "*"

group = smsbox
smsbox-id = "net2app-smsbox"
smsc-connections = loopback
log-file = "/var/log/kannel/smsbox.log"
log-level = 0
sendsmsc-port = 13001
sendsms-port = 13013
sendsms-url = "http://127.0.0.1:13013/cgi-bin/sendsms"
sendsms-chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ +"
KANNEL_EOF
mkdir -p /var/log/kannel
systemctl enable kannel || true
log "Kannel installed"

# ── STEP 5: Node.js ──────────────────────────────────────────
info "STEP 5: Installing Node.js 20 LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
log "Node.js $(node -v) installed"

# ── STEP 6: PM2 Process Manager ──────────────────────────────
info "STEP 6: Installing PM2..."
npm install -g pm2
pm2 startup systemd -u root --hp /root
log "PM2 installed"

# ── STEP 7: Nginx ─────────────────────────────────────────────
info "STEP 7: Installing Nginx..."
apt-get install -y nginx
systemctl enable nginx && systemctl start nginx
# Basic reverse proxy config
cat > /etc/nginx/sites-available/net2app << 'NGINX_EOF'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }

    location /kannel/ {
        proxy_pass http://127.0.0.1:13013/;
    }

    location /kannel-admin/ {
        proxy_pass http://127.0.0.1:13000/;
    }
}
NGINX_EOF
ln -sf /etc/nginx/sites-available/net2app /etc/nginx/sites-enabled/net2app
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
log "Nginx configured"

# ── STEP 8: UFW Firewall ──────────────────────────────────────
info "STEP 8: Configuring UFW Firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 2775/tcp  # SMPP
ufw allow 13013/tcp # Kannel SendSMS
ufw allow 13000/tcp # Kannel Admin
ufw allow 5060/udp  # SIP
ufw allow 5060/tcp  # SIP
ufw allow 10000:20000/udp # RTP Media
ufw --force enable
log "Firewall configured"

# ── STEP 9: Fail2Ban ──────────────────────────────────────────
info "STEP 9: Configuring Fail2Ban..."
systemctl enable fail2ban && systemctl start fail2ban
log "Fail2Ban active"

# ── STEP 10: SMPP Server (OpenSMPPD) ─────────────────────────
info "STEP 10: Setting up SMPP listener directory..."
mkdir -p /opt/net2app/smpp
mkdir -p /opt/net2app/logs
mkdir -p /opt/net2app/config
log "Net2app directories created at /opt/net2app"

# ── STEP 11: Create .env config ───────────────────────────────
info "STEP 11: Creating default config..."
cat > /opt/net2app/config/.env << 'ENV_EOF'
APP_PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=net2app
DB_USER=net2app
DB_PASS=Net2app@2024!
KANNEL_HOST=127.0.0.1
KANNEL_PORT=13013
KANNEL_ADMIN_PORT=13000
KANNEL_ADMIN_PASS=net2app123
SMPP_HOST=0.0.0.0
SMPP_PORT=2775
ASTERISK_AMI_HOST=127.0.0.1
ASTERISK_AMI_PORT=5038
ENV_EOF
log "Config created at /opt/net2app/config/.env"

# ── DONE ─────────────────────────────────────────────────────
echo ""
echo "============================================================"
echo -e "${GREEN}   ✅ NET2APP DEPLOYMENT COMPLETE!${NC}"
echo "============================================================"
echo ""
echo "📦 Services Status:"
systemctl is-active --quiet mariadb  && echo "  ✔ MariaDB    — running" || echo "  ✘ MariaDB    — stopped"
systemctl is-active --quiet asterisk && echo "  ✔ Asterisk   — running" || echo "  ✘ Asterisk   — stopped"
systemctl is-active --quiet nginx    && echo "  ✔ Nginx      — running" || echo "  ✘ Nginx      — stopped"
systemctl is-active --quiet kannel   && echo "  ✔ Kannel     — running" || echo "  ✘ Kannel     — stopped"
echo ""
echo "🔧 Ports Open: 22, 80, 443, 2775 (SMPP), 5060 (SIP), 13013 (Kannel)"
echo "🗄️  Database: net2app | User: net2app | Pass: Net2app@2024!"
echo "📁 App Dir: /opt/net2app"
echo ""
echo "🚀 One-line deploy command:"
echo "   bash <(curl -s https://raw.githubusercontent.com/eliasewu/net2app.com/main/deploy.sh)"
echo ""
