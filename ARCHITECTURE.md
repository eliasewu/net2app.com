# Net2app Architecture — Permanent Fix

## The Problem
When deployed to Debian, the old Nginx config had `/api/` proxy forwarding browser requests directly to `server.js:5000` WITHOUT an auth token → `401 Unauthorized`.

## The Solution

```
Browser → React SPA → api.base44.com (auth + entities + functions)
Base44 Functions → server.js:5000 (Bearer token, server-to-server)
Kannel → server.js:5000/api/dlr (localhost only)
```

## Key Points
- **Nginx**: NO `/api/` proxy. Serves React SPA only.
- **server.js:5000**: Token-protected. Only Base44 cloud functions call it.
- **Port 5000**: Open to internet but requires `Authorization: Bearer <token>`.
- **Token**: Lives in Base44 Secrets (SERVER_API_TOKEN) — never in browser, never expires.
- **Result**: http://192.95.36.154/ works EXACTLY like https://net2app06660.base44.app/

## Manual Fix for Existing Server
```bash
# Fix Nginx
cat > /etc/nginx/sites-available/net2app << 'EOF'
server {
    listen 80 default_server;
    server_name _;
    root /var/www/html;
    index index.html;
    location = /server-health { proxy_pass http://127.0.0.1:5000/health; }
    location / { try_files $uri $uri/ /index.html; }
}
EOF
nginx -t && systemctl reload nginx

# Open port 5000
ufw allow 5000/tcp comment "Net2app API"

# Verify
curl -s http://192.95.36.154:5000/health
```
