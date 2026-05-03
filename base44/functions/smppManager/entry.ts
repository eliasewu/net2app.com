/**
 * Net2app — Real SMPP Manager Backend Function
 * Communicates with Kannel bearerbox admin API on the Debian server.
 * Also manages smpp_users table in MariaDB and generates/reloads kannel.conf blocks.
 *
 * Actions:
 *   status          — get kannel bearerbox admin status
 *   bind_status     — check if a specific smsc-id is bound (from bearerbox status XML)
 *   bind_all        — check all supplier bind statuses
 *   generate_config — generate full kannel.conf text for all suppliers + clients
 *   reload_kannel   — send HUP to bearerbox (reload config without downtime)
 *   add_smpp_user   — add client SMPP user to kannel smpp-server block + DB
 *   remove_smpp_user — remove client SMPP user
 *   test_smpp       — real TCP connect test to supplier SMPP host:port
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const KANNEL_ADMIN_URL = Deno.env.get("KANNEL_ADMIN_URL") || "http://127.0.0.1:13000";
const KANNEL_ADMIN_PASS = Deno.env.get("KANNEL_ADMIN_PASS") || "CHANGE_ADMIN_PASSWORD";
const SERVER_API_URL = Deno.env.get("SERVER_API_URL") || "http://127.0.0.1:5000";
const SERVER_API_TOKEN = Deno.env.get("SERVER_API_TOKEN") || "";

async function kannelRequest(path) {
  const url = `${KANNEL_ADMIN_URL}${path}&password=${encodeURIComponent(KANNEL_ADMIN_PASS)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  return res.text();
}

async function serverApiRequest(path, method = "GET", body = null) {
  const opts = {
    method,
    headers: {
      "Authorization": `Bearer ${SERVER_API_TOKEN}`,
      "Content-Type": "application/json"
    },
    signal: AbortSignal.timeout(10000)
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${SERVER_API_URL}${path}`, opts);
  return res.json();
}

// Parse bound smsc IDs from Kannel XML status output
function parseBoundSmsc(xmlText) {
  const bound = [];
  const regex = /smsc id="([^"]+)"[^>]*>.*?connected/gis;
  let m;
  while ((m = regex.exec(xmlText)) !== null) {
    bound.push(m[1]);
  }
  // Also try simpler pattern
  const regex2 = /smsc-id[:\s]+"?([a-zA-Z0-9_-]+)"?.*?(?:connected|bind)/gi;
  while ((m = regex2.exec(xmlText)) !== null) {
    if (!bound.includes(m[1])) bound.push(m[1]);
  }
  return bound;
}

// Parse bound SMPP client users from Kannel status
function parseBoundClients(xmlText) {
  const bound = [];
  const regex = /system-id[:\s]+"?([a-zA-Z0-9_@.-]+)"?.*?bound/gi;
  let m;
  while ((m = regex.exec(xmlText)) !== null) {
    bound.push(m[1].toLowerCase());
  }
  return bound;
}

// Generate Kannel smsc group block for a supplier
function supplierToKannelBlock(s) {
  if (!s.smpp_ip || !s.smpp_username) return null;
  const id = (s.name || s.id).replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
  const bindMode = s.bind_type === 'transmitter' ? 2 : s.bind_type === 'receiver' ? 1 : 3;
  return [
    `group = smsc`,
    `smsc = smpp`,
    `smsc-id = "${id}"`,
    `host = "${s.smpp_ip}"`,
    `port = ${s.smpp_port || 2775}`,
    `smsc-username = "${s.smpp_username}"`,
    `smsc-password = "${s.smpp_password || ''}"`,
    `system-type = "${s.system_type || 'SMPP'}"`,
    `transceiver-mode = ${bindMode}`,
    `max-pending-submits = ${Math.min(s.tps_limit || 20, 100)}`,
    `throughput = ${s.tps_limit || 100}`,
    `reconnect-delay = 10`,
    `log-file = "/var/log/kannel/${id}.log"`,
    s.dlr_url ? `dlr-url = "${s.dlr_url}"` : '',
  ].filter(l => l !== '').join('\n');
}

// Generate smpp-server block for a client (Kannel listens on this port for client binds)
function clientToKannelSmppServer(c, port) {
  const id = (c.name || c.id).replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
  return [
    `group = smpp-server`,
    `port = ${port}`,
    `smpp-server-id = "${id}"`,
    `system-id = "${c.smpp_username}"`,
    `password = "${c.smpp_password}"`,
    `system-type = ""`,
    `interface-version = 34`,
    `max-binds = 10`,
    `allow-ip = "*.*.*.*"`,
    `throughput = ${c.tps_limit || 100}`,
  ].join('\n');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let user = null;
    try { user = await base44.auth.me(); } catch {}
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // ── STATUS: ping kannel admin ─────────────────────────────────
    if (action === 'status') {
      try {
        const xml = await kannelRequest("/status?");
        const isUp = xml.includes('bearerbox') || xml.includes('uptime') || xml.includes('smscs');
        return Response.json({ ok: true, up: isUp, raw: xml.substring(0, 500) });
      } catch (e) {
        return Response.json({ ok: false, up: false, error: e.message });
      }
    }

    // ── BIND STATUS: check which suppliers are bound ──────────────
    if (action === 'bind_all' || action === 'bind_status') {
      try {
        const xml = await kannelRequest("/status?");
        const boundSmsc = parseBoundSmsc(xml);
        const boundClients = parseBoundClients(xml);
        return Response.json({ ok: true, bound_suppliers: boundSmsc, bound_clients: boundClients, raw: xml.substring(0, 1000) });
      } catch (e) {
        return Response.json({ ok: false, bound_suppliers: [], bound_clients: [], error: e.message });
      }
    }

    // ── GENERATE CONFIG: build full kannel.conf from DB ──────────
    if (action === 'generate_config') {
      const suppliers = await base44.asServiceRole.entities.Supplier.list();
      const clients = await base44.asServiceRole.entities.Client.filter({ connection_type: 'SMPP' });

      const supplierBlocks = suppliers
        .filter(s => s.connection_type === 'SMPP' && s.status !== 'blocked')
        .map(supplierToKannelBlock)
        .filter(Boolean);

      let clientPort = 9096;
      const clientBlocks = clients
        .filter(c => c.smpp_username && c.smpp_password)
        .map(c => {
          const block = clientToKannelSmppServer(c, clientPort);
          clientPort++;
          return block;
        });

      const config = `# ═══════════════════════════════════════════════════
# Net2app Kannel Config — Auto-generated
# Apply: cp kannel.conf /etc/kannel/kannel.conf
# Reload: kill -HUP $(pidof bearerbox)
# ═══════════════════════════════════════════════════

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

# ── SUPPLIER SMSC BLOCKS (outbound) ──────────────────
${supplierBlocks.join('\n\n')}

# ── CLIENT SMPP SERVER BLOCKS (inbound) ──────────────
${clientBlocks.join('\n\n')}
`;
      return Response.json({ ok: true, config, supplier_count: supplierBlocks.length, client_count: clientBlocks.length });
    }

    // ── RELOAD KANNEL: send HUP signal ───────────────────────────
    if (action === 'reload_kannel') {
      try {
        const result = await serverApiRequest('/api/smpp/reload', 'POST', {});
        return Response.json({ ok: true, result });
      } catch (e) {
        return Response.json({ ok: false, error: `Server API error: ${e.message}. Run manually: kill -HUP $(pidof bearerbox)` });
      }
    }

    // ── TEST SMPP: real TCP connect to supplier ───────────────────
    if (action === 'test_smpp') {
      const { smpp_ip, smpp_port, supplier_id } = body;
      try {
        const result = await serverApiRequest('/api/smpp/test', 'POST', { host: smpp_ip, port: smpp_port || 2775 });
        if (supplier_id) {
          await base44.asServiceRole.entities.Supplier.update(supplier_id, {
            bind_status: result.connected ? 'connected' : 'failed',
            bind_reason: result.reason || (result.connected ? 'TCP OK' : 'Connection failed'),
            status: result.connected ? 'active' : 'inactive'
          });
        }
        return Response.json({ ok: true, ...result });
      } catch (e) {
        if (supplier_id) {
          await base44.asServiceRole.entities.Supplier.update(supplier_id, {
            bind_status: 'failed',
            bind_reason: `Server unreachable: ${e.message}`
          });
        }
        return Response.json({ ok: false, connected: false, reason: e.message });
      }
    }

    // ── ADD SMPP USER: provision client SMPP access ──────────────
    if (action === 'add_smpp_user') {
      const { client_id, smpp_username, smpp_password, smpp_port } = body;
      await base44.asServiceRole.entities.Client.update(client_id, { smpp_username, smpp_password, smpp_port: smpp_port || 9096, connection_type: 'SMPP' });
      try {
        await serverApiRequest('/api/smpp/user/add', 'POST', { client_id, smpp_username, smpp_password, smpp_port: smpp_port || 9096 });
      } catch {}
      return Response.json({ ok: true, message: `Client SMPP user ${smpp_username}:${smpp_port || 9096} provisioned` });
    }

    // ── REMOVE SMPP USER ─────────────────────────────────────────
    if (action === 'remove_smpp_user') {
      const { client_id, smpp_username } = body;
      try {
        await serverApiRequest('/api/smpp/user/remove', 'POST', { client_id, smpp_username });
      } catch {}
      return Response.json({ ok: true, message: `Client SMPP user ${smpp_username} removed` });
    }

    // ── SYNC CLIENT to Debian server DB ─────────────────────────
    if (action === 'sync_client') {
      const { client } = body;
      if (!client) return Response.json({ error: 'client required' }, { status: 400 });
      try {
        const result = await serverApiRequest('/api/clients', 'POST', client);
        return Response.json({ ok: true, result });
      } catch (e) {
        return Response.json({ ok: false, error: e.message });
      }
    }

    // ── SYNC SUPPLIER to Debian server DB ────────────────────────
    if (action === 'sync_supplier') {
      const { supplier } = body;
      if (!supplier) return Response.json({ error: 'supplier required' }, { status: 400 });
      try {
        const result = await serverApiRequest('/api/suppliers', 'POST', supplier);
        return Response.json({ ok: true, result });
      } catch (e) {
        return Response.json({ ok: false, error: e.message });
      }
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    console.error('[smppManager]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});