import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");
const DEFAULT_REPO = "eliasewu/net2app.com";
const API_BASE = "https://api.github.com";

const headers = {
  "Authorization": `Bearer ${GITHUB_TOKEN}`,
  "Accept": "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Forbidden: Admin only" }, { status: 403 });

  const body = await req.json();
  const { action, tag, name, body: releaseBody, draft, prerelease, release_id, repo, path, content, message, sha } = body;

  const REPO = repo || DEFAULT_REPO;

  // List releases
  if (action === "list") {
    const res = await fetch(`${API_BASE}/repos/${REPO}/releases?per_page=30`, { headers });
    const data = await res.json();
    return Response.json({ releases: data });
  }

  // Create release
  if (action === "create") {
    const res = await fetch(`${API_BASE}/repos/${REPO}/releases`, {
      method: "POST",
      headers,
      body: JSON.stringify({ tag_name: tag, name: name || tag, body: releaseBody || "", draft: draft || false, prerelease: prerelease || false }),
    });
    const data = await res.json();
    return Response.json({ release: data, status: res.status });
  }

  // Delete release
  if (action === "delete") {
    const res = await fetch(`${API_BASE}/repos/${REPO}/releases/${release_id}`, { method: "DELETE", headers });
    return Response.json({ ok: res.ok, status: res.status });
  }

  // List tags
  if (action === "tags") {
    const res = await fetch(`${API_BASE}/repos/${REPO}/tags?per_page=30`, { headers });
    const data = await res.json();
    return Response.json({ tags: data });
  }

  // Create repository
  if (action === "create_repo") {
    const res = await fetch(`${API_BASE}/user/repos`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: name,
        description: releaseBody || "",
        private: false,
        auto_init: true,
      }),
    });
    const data = await res.json();
    return Response.json({ repo: data, status: res.status });
  }

  // Get file (to retrieve SHA before updating)
  if (action === "get_file") {
    const res = await fetch(`${API_BASE}/repos/${REPO}/contents/${path}`, { headers });
    if (!res.ok) return Response.json({ sha: null, exists: false });
    const data = await res.json();
    return Response.json({ sha: data.sha, exists: true, name: data.name });
  }

  // Push (create or update) a file in the repo
  if (action === "push_file") {
    if (!path || !content) return Response.json({ error: "path and content required" }, { status: 400 });
    // btoa works for ASCII; use TextEncoder for unicode content
    const bytes = new TextEncoder().encode(content);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    const encoded = btoa(binary);
    const payload = { message: message || "Update file", content: encoded };
    if (sha) payload.sha = sha;
    const res = await fetch(`${API_BASE}/repos/${REPO}/contents/${path}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return Response.json({ ok: res.ok, status: res.status, data });
  }

  // Get release by tag
  if (action === "get_by_tag") {
    const res = await fetch(`${API_BASE}/repos/${REPO}/releases/tags/${tag}`, { headers });
    const data = await res.json();
    return Response.json({ release: data, status: res.status });
  }

  // Generate + upload deploy.sh to a release
  if (action === "upload_deploy_sh") {
    const { upload_url, config: cfg } = body;
    if (!upload_url) return Response.json({ error: "upload_url required" }, { status: 400 });

    const c = {
      dbRootPass: cfg?.dbRootPass || "RootPass@2025!",
      dbAppUser:  cfg?.dbAppUser  || "net2app",
      dbAppPass:  cfg?.dbAppPass  || "Net2App@2025!",
      dbName:     cfg?.dbName     || "net2app",
      kannelPass: cfg?.kannelPass || "kannel_admin_2025",
      apiToken:   cfg?.apiToken   || "net2app_api_token_2025",
      appId:      cfg?.appId      || "",
      appBaseUrl: cfg?.appBaseUrl || "https://api.base44.com",
      funcVersion:cfg?.funcVersion|| "v3",
    };

    // Inline minimal deploy.sh — header + instructions to pull from GitHub raw
    const deployContent = `#!/bin/bash
# ════════════════════════════════════════════════════════════════════
#  NET2APP v3.1.0 — DEBIAN 12 DEPLOYMENT SCRIPT
#  Full script: https://net2app.base44.app → Full Deploy page
#  Or generate from: Dashboard → Code → Full Deploy Script
# ════════════════════════════════════════════════════════════════════
# USAGE: Edit the variables below, then run:  sudo bash deploy.sh
#
# Requirements:
#   - Fresh Debian 12 (bookworm) server
#   - Root or sudo access
#   - Internet connectivity
# ════════════════════════════════════════════════════════════════════
[ "$EUID" -ne 0 ] && exec sudo bash "$0" "$@"
export DEBIAN_FRONTEND=noninteractive

# ── CONFIGURATION ───────────────────────────────────────────────────
DB_ROOT_PASS="${c.dbRootPass}"
DB_APP_USER="${c.dbAppUser}"
DB_APP_PASS="${c.dbAppPass}"
DB_NAME="${c.dbName}"
KANNEL_ADMIN_PASS="${c.kannelPass}"
API_TOKEN="${c.apiToken}"
VITE_BASE44_APP_ID="${c.appId}"
VITE_BASE44_APP_BASE_URL="${c.appBaseUrl}"
VITE_BASE44_FUNCTIONS_VERSION="${c.funcVersion}"
GITHUB_REPO="https://github.com/eliasewu/net2app.com.git"
DEPLOY_DIR="/opt/net2app"
WEBROOT="/var/www/html"
API_DIR="/opt/net2app-api"
BRANCH="main"

GREEN="\\033[0;32m"; RED="\\033[0;31m"; YELLOW="\\033[1;33m"; BLUE="\\033[0;34m"; NC="\\033[0m"
ok()     { echo -e "\${GREEN}[OK]\${NC} $1"; }
fail()   { echo -e "\${RED}[FAIL]\${NC} $1"; }
info()   { echo -e "\${YELLOW}[i]\${NC} $1"; }
header() { echo -e "\\n\${BLUE}══ $1 ══\${NC}\\n"; }

echo "════════════════════════════════════════════════════════════"
echo "  NET2APP v3.1.0 — 22 TABLES — \$(date)"
echo "════════════════════════════════════════════════════════════"

header "STEP 1: System Update + Base Packages"
apt-get update -y && apt-get upgrade -y
apt-get install -y build-essential git curl wget vim net-tools ufw fail2ban \\
  lsb-release gnupg ca-certificates libssl-dev libxml2-dev uuid-dev pkg-config \\
  nginx mariadb-server mariadb-client kannel python3 unzip
ok "Base packages ready"

header "STEP 2: Node.js 20 + PM2"
which node &>/dev/null || { curl -fsSL https://deb.nodesource.com/setup_20.x | bash -; apt-get install -y nodejs; }
which pm2  &>/dev/null || npm install -g pm2
ok "Node \$(node -v) + PM2 ready"

header "STEP 3: MariaDB — Database + User"
systemctl enable mariadb && systemctl start mariadb && sleep 2
mysql -u root -p"\$DB_ROOT_PASS" -e "SELECT 1" 2>/dev/null || mysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '\$DB_ROOT_PASS'; FLUSH PRIVILEGES;"
mysql -u root -p"\$DB_ROOT_PASS" <<DBEOF
CREATE DATABASE IF NOT EXISTS \${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON \${DB_NAME}.* TO '\${DB_APP_USER}'@'localhost' IDENTIFIED BY '\${DB_APP_PASS}';
FLUSH PRIVILEGES;
DBEOF
ok "MariaDB: database + user ready"

header "STEP 4: Clone + Git Hard-Reset + Build Frontend"
if [ -d "\$DEPLOY_DIR/.git" ]; then
  cd \$DEPLOY_DIR && git fetch origin && git reset --hard origin/\$BRANCH && git clean -fd
  ok "Hard-reset to origin/\$BRANCH"
else
  git clone \$GITHUB_REPO \$DEPLOY_DIR && cd \$DEPLOY_DIR
  ok "Repository cloned"
fi
cd \$DEPLOY_DIR
cat > \$DEPLOY_DIR/.env << 'VITEEOF'
VITE_BASE44_APP_ID=${c.appId}
VITE_BASE44_APP_BASE_URL=${c.appBaseUrl}
VITE_BASE44_FUNCTIONS_VERSION=${c.funcVersion}
SERVER_API_URL=http://127.0.0.1:5000
SERVER_API_TOKEN=${c.apiToken}
VITEEOF
npm install --include=dev 2>&1 | tail -5
npm run build 2>&1 | tail -5
mkdir -p \$WEBROOT && rm -rf \$WEBROOT/* && cp -r \$DEPLOY_DIR/dist/* \$WEBROOT/
ok "Frontend built → \$WEBROOT"

header "STEP 5: API Server Setup"
mkdir -p \$API_DIR && cd \$API_DIR
npm init -y 2>/dev/null | tail -1
npm install express@4 mysql2 cors dotenv jsonwebtoken node-cron 2>&1 | tail -3
cat > \$API_DIR/.env << 'APIENVEOF'
PORT=5000
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DB=${c.dbName}
MYSQL_USER=${c.dbAppUser}
MYSQL_PASS=${c.dbAppPass}
JWT_SECRET=${c.apiToken}
API_TOKEN=${c.apiToken}
KANNEL_ADMIN_URL=http://127.0.0.1:13000
KANNEL_ADMIN_PASS=${c.kannelPass}
WEBROOT=/var/www/html
APIENVEOF
chmod 600 \$API_DIR/.env

# ── NOTE: server.js is generated by Net2app Dashboard ─────────────────
# Go to: Dashboard → Code → Full Deploy Script → Generate → Copy server.js
# Or the full deploy.sh includes the complete server.js inline.
# For the complete auto-generated deploy script with all 22 tables,
# billing triggers, Kannel config, and full server.js, visit:
#   https://net2app.base44.app → Full Deploy Script page
info "Visit Dashboard → Full Deploy Script for the complete server.js with all 22 tables"

header "STEP 6: Nginx"
cat > /etc/nginx/sites-available/net2app << 'NGINXEOF'
server {
    listen 80 default_server;
    server_name _;
    root /var/www/html;
    index index.html;
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        add_header Access-Control-Allow-Origin * always;
        if (\$request_method = OPTIONS) { return 204; }
    }
    location = /health { proxy_pass http://127.0.0.1:5000/health; }
    location / { try_files \$uri \$uri/ /index.html; }
}
NGINXEOF
ln -sf /etc/nginx/sites-available/net2app /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl enable nginx && systemctl reload nginx && ok "Nginx ready"

header "STEP 7: UFW Firewall"
ufw allow 22/tcp; ufw allow 80/tcp; ufw allow 443/tcp; ufw allow 5000/tcp
ufw allow 9095:9200/tcp
echo "y" | ufw enable 2>/dev/null || true
ok "UFW configured"

header "STEP 8: Health Check"
SERVER_IP=\$(hostname -I | awk '{print \$1}')
systemctl is-active nginx   && ok "Nginx:   RUNNING" || fail "Nginx: DOWN"
systemctl is-active mariadb && ok "MariaDB: RUNNING" || fail "MariaDB: DOWN"

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  NET2APP v3.1.0 — PARTIAL DEPLOY COMPLETE                    ║"
echo "╠═══════════════════════════════════════════════════════════════╣"
echo "║  For FULL deploy with server.js + 22 tables:                 ║"
echo "║  Dashboard → Code → Full Deploy Script → Download deploy.sh  ║"
echo "╠═══════════════════════════════════════════════════════════════╣"
echo "║  Dashboard: http://\$SERVER_IP/                               ║"
echo "║  API:       http://\$SERVER_IP:5000 (after server.js added)   ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
`;

    const cleanUrl = upload_url.replace(/\{[^}]+\}/, '') + `?name=deploy.sh`;
    const fileBytes = new TextEncoder().encode(deployContent);
    const uploadRes = await fetch(cleanUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GITHUB_TOKEN}`,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/octet-stream",
      },
      body: fileBytes,
    });
    const data = await uploadRes.json();
    return Response.json({ ok: uploadRes.ok, status: uploadRes.status, asset: data, download_url: data.browser_download_url });
  }

  // Upload asset to a release
  if (action === "upload_asset") {
    const { upload_url, filename, file_content } = body;
    if (!upload_url || !filename || !file_content) return Response.json({ error: "upload_url, filename, file_content required" }, { status: 400 });
    // upload_url from GitHub is like: https://uploads.github.com/repos/.../assets{?name,label}
    const cleanUrl = upload_url.replace(/\{[^}]+\}/, '') + `?name=${encodeURIComponent(filename)}`;
    const fileBytes = new TextEncoder().encode(file_content);
    const uploadRes = await fetch(cleanUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GITHUB_TOKEN}`,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/octet-stream",
        "Content-Length": String(fileBytes.byteLength),
      },
      body: fileBytes,
    });
    const data = await uploadRes.json();
    return Response.json({ ok: uploadRes.ok, status: uploadRes.status, asset: data });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
});