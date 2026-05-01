#!/bin/bash
# ════════════════════════════════════════════════════════════════════
# NET2APP - Full Debian 12 Server Deployment Script
# Usage: bash <(curl -s https://raw.githubusercontent.com/eliasewu/net2app.com/main/deploy.sh)
# ════════════════════════════════════════════════════════════════════
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
ok()     { echo -e "${GREEN}[OK]${NC} $1"; }
fail()   { echo -e "${RED}[FAIL]${NC} $1"; exit 1; }
info()   { echo -e "${YELLOW}[i]${NC} $1"; }
header() { echo -e "\n${BLUE}== $1 ==${NC}\n"; }

if [ "$EUID" -ne 0 ]; then exec sudo bash "$0" "$@"; fi

DEPLOY_DIR="/opt/net2app"
WEBROOT="/var/www/html"
BRANCH="main"
GITHUB_REPO="https://github.com/eliasewu/net2app.com.git"

echo ""
echo "================================================"
echo "  NET2APP - Full Debian 12 Deployment"
echo "  SMS Routing + VoIP + Kannel + Asterisk + DB"
echo "================================================"
echo ""

header "STEP 1: System Update"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y git curl wget vim net-tools ufw fail2ban nginx
ok "Base packages installed"

header "STEP 2: Node.js 20 LTS"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
npm install -g pm2
ok "Node.js $(node -v) + PM2 installed"

header "STEP 3: Clone / Update App"
if [ -d "$DEPLOY_DIR/.git" ]; then
  cd $DEPLOY_DIR
  git fetch origin
  git reset --hard origin/$BRANCH
  ok "Updated: $(git log -1 --format='%h %s')"
else
  git clone $GITHUB_REPO $DEPLOY_DIR
  cd $DEPLOY_DIR
  ok "Cloned to $DEPLOY_DIR"
fi

header "STEP 4: Install NPM Dependencies"
cd $DEPLOY_DIR
npm install --production=false
ok "Dependencies installed"

header "STEP 5: Build React Frontend"
npm run build
ok "Build complete - $(du -sh dist/ 2>/dev/null | cut -f1)"

header "STEP 6: Deploy to Webroot"
mkdir -p $WEBROOT
cp -r dist/* $WEBROOT/
ok "Files deployed to $WEBROOT"

header "STEP 7: Configure Nginx"
cat > /etc/nginx/sites-available/net2app << 'NGINX'
server {
    listen 80;
    server_name _;
    root /var/www/html;
    index index.html;
    location / { try_files $uri $uri/ /index.html; }
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
NGINX
ln -sf /etc/nginx/sites-available/net2app /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl enable nginx && systemctl reload nginx
ok "Nginx configured"

header "STEP 8: UFW Firewall"
ufw allow 22/tcp   comment 'SSH'
ufw allow 80/tcp   comment 'HTTP'
ufw allow 443/tcp  comment 'HTTPS'
ufw allow 5060/udp comment 'SIP'
ufw allow 5060/tcp comment 'SIP'
ufw allow 10000:20000/udp comment 'RTP'
ufw allow 9095:9200/tcp   comment 'SMPP'
ufw allow 4000:6000/tcp   comment 'Tenant panels'
ufw allow from 127.0.0.1 to any port 13000 comment 'Kannel admin'
ufw allow from 127.0.0.1 to any port 13013 comment 'Kannel smsbox'
echo "y" | ufw enable 2>/dev/null || true
ok "Firewall configured"

header "STEP 9: Health Check"
systemctl is-active nginx && ok "Nginx:   RUNNING" || fail "Nginx FAILED"
node -v && ok "Node.js: OK" || fail "Node.js NOT FOUND"
pm2 list 2>/dev/null

echo ""
echo "================================================"
echo "  Net2app Deploy Complete - $(date)"
echo "  App:     http://$(hostname -I | awk '{print $1}')"
echo "  Repo:    $DEPLOY_DIR"
echo "================================================"
echo ""
echo "  Next steps:"
echo "  1. bash $DEPLOY_DIR/setup-smpp-api.sh YOUR_TOKEN"
echo "  2. bash $DEPLOY_DIR/fix-tenant.sh tenant_name db_name password"
echo "  3. Edit /etc/kannel/kannel.conf with supplier credentials"
echo "================================================"
