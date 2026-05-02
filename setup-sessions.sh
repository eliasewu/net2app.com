#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
#  Net2app — Session Servers Setup
#  WhatsApp (WPPConnect) → port 5001
#  Telegram (GramJS)    → port 5002
#  Run AFTER deploy.sh on your Debian 12 server as root
# ═══════════════════════════════════════════════════════════════════

if [ "$EUID" -ne 0 ]; then exec sudo bash "$0" "$@"; fi

GREEN="\033[0;32m"; YELLOW="\033[1;33m"; BLUE="\033[0;34m"; NC="\033[0m"
ok()     { echo -e "${GREEN}[OK]${NC} $1"; }
info()   { echo -e "${YELLOW}[i]${NC} $1"; }
header() { echo -e "\n${BLUE}══ $1 ══${NC}\n"; }

SESSION_DIR="/opt/net2app-sessions"
API_TOKEN="Net2app@API2025!"

header "Installing Chromium (needed by WPPConnect)"
apt-get install -y chromium chromium-driver libgbm1 libasound2 libatk1.0-0 libcups2 libdbus-1-3 libgdk-pixbuf2.0-0 libnss3 libxss1
ok "Chromium installed"

header "Setting up session servers directory"
mkdir -p $SESSION_DIR && cd $SESSION_DIR
npm init -y 2>/dev/null | tail -1
npm install @wppconnect-team/wppconnect express cors qrcode 2>&1 | tail -3
npm install telegram input express cors qrcode 2>&1 | tail -3
ok "Packages installed"

header "Writing WhatsApp session server (WPPConnect) — :5001"
cat > $SESSION_DIR/wppconnect-server.js << 'WAEOF'
const wppconnect = require('@wppconnect-team/wppconnect');
const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors()); app.use(express.json());
const sessions = {};
const AUTH = process.env.API_TOKEN || 'Net2app@API2025!';

const authMw = (req, res, next) => {
  const t = (req.headers['authorization'] || '').replace('Bearer ', '');
  if (req.path === '/health' || t === AUTH) return next();
  res.status(401).json({ error: 'Unauthorized' });
};
app.use(authMw);
app.get('/health', (req, res) => res.json({ ok: true, service: 'wppconnect', sessions: Object.keys(sessions).length }));

app.post('/session/start', async (req, res) => {
  const { session_id } = req.body;
  if (!session_id) return res.status(400).json({ error: 'session_id required' });
  const existing = sessions[session_id];
  if (existing && existing.status === 'CONNECTED') return res.json({ status: 'CONNECTED', session_id });
  if (existing && existing.status === 'QR_READY') return res.json({ status: 'QR_READY', session_id });
  sessions[session_id] = { status: 'STARTING', qr: null, client: null };
  res.json({ status: 'STARTING', session_id });
  // Start async
  try {
    const client = await wppconnect.create({
      session: session_id,
      headless: true,
      useChrome: true,
      chromiumArgs: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      catchQR: (base64Qr, asciiQr, qrCode) => {
        sessions[session_id] = { ...sessions[session_id], qr: base64Qr, status: 'QR_READY' };
        console.log('[WA] QR ready for session:', session_id);
      },
      statusFind: (status, session) => {
        console.log('[WA] Status:', status, session);
        if (status === 'inChat' || status === 'isLogged') {
          sessions[session_id] = { ...sessions[session_id], status: 'CONNECTED' };
        }
      },
    });
    sessions[session_id].client = client;
    sessions[session_id].status = 'CONNECTED';
    console.log('[WA] Session connected:', session_id);
  } catch (e) {
    console.error('[WA] Session error:', e.message);
    sessions[session_id] = { status: 'ERROR', error: e.message, qr: null };
  }
});

app.get('/session/qr', (req, res) => {
  const s = sessions[req.query.session_id];
  if (!s) return res.json({ qr: null, status: 'NOT_STARTED' });
  res.json({ qr: s.qr, status: s.status });
});

app.get('/session/status', (req, res) => {
  const s = sessions[req.query.session_id];
  if (!s) return res.json({ status: 'NOT_STARTED', connected: false });
  res.json({ status: s.status, connected: s.status === 'CONNECTED' });
});

app.post('/session/logout', async (req, res) => {
  const s = sessions[req.body.session_id];
  if (s && s.client) {
    await s.client.logout().catch(() => {});
    await s.client.close().catch(() => {});
  }
  delete sessions[req.body.session_id];
  res.json({ ok: true });
});

app.post('/send', async (req, res) => {
  const { session_id, to, message } = req.body;
  const s = sessions[session_id];
  if (!s || !s.client) return res.status(400).json({ error: 'Session not connected' });
  try {
    const result = await s.client.sendText(to.replace('+', '') + '@c.us', message);
    res.json({ ok: true, id: result?.id?._serialized || result?.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = 5001;
app.listen(PORT, '0.0.0.0', () => console.log('[WA] WPPConnect session server on :' + PORT));
WAEOF
ok "wppconnect-server.js written"

header "Writing Telegram session server (GramJS) — :5002"
cat > $SESSION_DIR/gramjs-server.js << 'TGEOF'
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { functions: { auth: { ExportLoginTokenRequest, AcceptLoginTokenRequest } } } = require('telegram/tl');
const express = require('express');
const cors = require('cors');
const qrcode = require('qrcode');
const app = express();
app.use(cors()); app.use(express.json());
const sessions = {};
const API_ID = parseInt(process.env.TG_API_ID || '0');
const API_HASH = process.env.TG_API_HASH || '';
const AUTH_TOKEN = process.env.API_TOKEN || 'Net2app@API2025!';

const authMw = (req, res, next) => {
  const t = (req.headers['authorization'] || '').replace('Bearer ', '');
  if (req.path === '/health' || t === AUTH_TOKEN) return next();
  res.status(401).json({ error: 'Unauthorized' });
};
app.use(authMw);
app.get('/health', (req, res) => res.json({ ok: true, service: 'gramjs', has_api_creds: !!(API_ID && API_HASH) }));

app.post('/session/start', async (req, res) => {
  const { session_id } = req.body;
  if (!API_ID || !API_HASH) {
    return res.status(400).json({
      error: 'Telegram API credentials not set. Visit https://my.telegram.org to get api_id and api_hash, then set TG_API_ID and TG_API_HASH environment variables.',
      setup_url: 'https://my.telegram.org'
    });
  }
  try {
    const stringSession = new StringSession('');
    const client = new TelegramClient(stringSession, API_ID, API_HASH, {
      connectionRetries: 3,
      useWSS: false,
    });
    sessions[session_id] = { client, status: 'STARTING', qr: null };
    res.json({ status: 'STARTING', session_id });
    await client.connect();
    // QR login flow
    const loginToken = await client.invoke(new ExportLoginTokenRequest({
      apiId: API_ID, apiHash: API_HASH, exceptIds: [],
    }));
    if (loginToken.className === 'auth.LoginToken') {
      const tokenBase64 = Buffer.from(loginToken.token).toString('base64url');
      const qrUrl = 'tg://login?token=' + tokenBase64;
      const qrDataUrl = await qrcode.toDataURL(qrUrl, { width: 280, margin: 2 });
      sessions[session_id] = { ...sessions[session_id], status: 'QR_READY', qr: qrDataUrl, expires: loginToken.expires };
      // Poll for auth completion
      const pollAuth = setInterval(async () => {
        try {
          const s = sessions[session_id];
          if (!s || s.status === 'CONNECTED') { clearInterval(pollAuth); return; }
          const isAuth = await client.isUserAuthorized();
          if (isAuth) {
            sessions[session_id] = { ...sessions[session_id], status: 'CONNECTED' };
            clearInterval(pollAuth);
            console.log('[TG] Session authenticated:', session_id);
          }
        } catch (e) { clearInterval(pollAuth); }
      }, 2000);
    }
  } catch (e) {
    console.error('[TG] Session start error:', e.message);
    sessions[session_id] = { status: 'ERROR', error: e.message, qr: null };
  }
});

app.get('/session/qr', (req, res) => {
  const s = sessions[req.query.session_id];
  if (!s) return res.json({ qr: null, status: 'NOT_STARTED' });
  res.json({ qr: s.qr, status: s.status });
});

app.get('/session/status', async (req, res) => {
  const s = sessions[req.query.session_id];
  if (!s) return res.json({ status: 'NOT_STARTED', connected: false });
  try {
    const isAuth = await s.client?.isUserAuthorized();
    if (isAuth) sessions[session_id] = { ...s, status: 'CONNECTED' };
    res.json({ status: s.status, connected: s.status === 'CONNECTED' || !!isAuth });
  } catch {
    res.json({ status: s.status, connected: false });
  }
});

app.post('/session/logout', async (req, res) => {
  const s = sessions[req.body.session_id];
  if (s && s.client) await s.client.destroy().catch(() => {});
  delete sessions[req.body.session_id];
  res.json({ ok: true });
});

const PORT = 5002;
app.listen(PORT, '0.0.0.0', () => console.log('[TG] GramJS session server on :' + PORT));
TGEOF
ok "gramjs-server.js written"

header "Opening firewall ports"
ufw allow 5001/tcp comment "WA WPPConnect session"
ufw allow 5002/tcp comment "TG GramJS session"
ufw allow 5003/tcp comment "IMO session"
ok "Ports 5001, 5002, 5003 opened"

header "Starting session servers with PM2"
pm2 delete wa-session 2>/dev/null || true
pm2 delete tg-session 2>/dev/null || true
pm2 start $SESSION_DIR/wppconnect-server.js --name wa-session
pm2 start $SESSION_DIR/gramjs-server.js --name tg-session
pm2 save
sleep 3

pm2 list | grep -E 'wa-session|tg-session'

echo ""
echo "╔════════════════════════════════════════════════╗"
echo "║  Session Servers Started!                    ║"
echo "║                                              ║"
echo "║  WhatsApp (WPPConnect): :5001              ║"
echo "║  Telegram (GramJS):     :5002              ║"
echo "║                                              ║"
echo "║  FOR TELEGRAM — required setup:             ║"
echo "║  1. Go to https://my.telegram.org            ║"
echo "║  2. Create app → get api_id + api_hash        ║"
echo "║  3. Run:                                      ║"
echo "║     echo 'TG_API_ID=YOUR_ID' >> /opt/net2app-sessions/.env    ║"
echo "║     echo 'TG_API_HASH=YOUR_HASH' >> /opt/net2app-sessions/.env ║"
echo "║     pm2 restart tg-session                   ║"
echo "║                                              ║"
echo "║  Health check:                               ║"
echo "║   curl http://localhost:5001/health          ║"
echo "║   curl http://localhost:5002/health          ║"
echo "╚════════════════════════════════════════════════╝"
