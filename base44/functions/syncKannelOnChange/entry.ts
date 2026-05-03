/**
 * Net2app — Auto-sync Kannel config when a Client or Supplier is created/updated.
 * Triggered by entity automation on Client (SMPP) and Supplier (SMPP) create/update.
 * Generates full kannel.conf from Base44 DB and pushes + reloads on the Debian server.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const SERVER_API_URL = Deno.env.get("SERVER_API_URL") || "http://127.0.0.1:5000";
const SERVER_API_TOKEN = Deno.env.get("SERVER_API_TOKEN") || "";
const KANNEL_ADMIN_PASS = Deno.env.get("KANNEL_ADMIN_PASS") || "CHANGE_ADMIN_PASSWORD";

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
  ].filter(Boolean).join('\n');
}

function clientToSmppServerBlock(c, port) {
  if (!c.smpp_username || !c.smpp_password) return null;
  const id = (c.name || c.id).replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
  return [
    `group = smpp-server`,
    `smpp-server-id = client_${id}`,
    `port = ${port}`,
    `system-id = "${c.smpp_username}"`,
    `password = "${c.smpp_password}"`,
    `system-type = ""`,
    `log-file = "/var/log/kannel/client_${id}.log"`,
    `log-level = 1`,
  ].join('\n');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    console.log('[syncKannelOnChange] triggered:', body?.event?.type, body?.event?.entity_name);

    const [suppliers, clients] = await Promise.all([
      base44.asServiceRole.entities.Supplier.list(),
      base44.asServiceRole.entities.Client.list(),
    ]);

    const smppSuppliers = suppliers.filter(s => s.connection_type === 'SMPP' && s.status !== 'blocked');
    const smppClients = clients.filter(c => c.connection_type === 'SMPP' && c.smpp_username && c.smpp_password && c.status !== 'blocked');

    const supplierBlocks = smppSuppliers.map(supplierToKannelBlock).filter(Boolean);

    let clientPort = 9096;
    const clientBlocks = smppClients.map(c => {
      const port = c.smpp_port || clientPort;
      clientPort = Math.max(clientPort + 1, port + 1);
      return clientToSmppServerBlock(c, port);
    }).filter(Boolean);

    const config = [
      '# Net2app Kannel Config — Auto-generated ' + new Date().toISOString(),
      '# Generated from Base44 database — DO NOT EDIT MANUALLY',
      '',
      'group = core',
      'admin-port = 13000',
      'admin-password = ' + KANNEL_ADMIN_PASS,
      'status-password = ' + KANNEL_ADMIN_PASS,
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
      '',
      '# ── SUPPLIER SMSC BLOCKS (outbound) ──────────────────',
      ...supplierBlocks.map(b => b + '\n'),
      '',
      '# ── CLIENT SMPP SERVER BLOCKS (inbound) ──────────────',
      ...clientBlocks.map(b => b + '\n'),
    ].join('\n');

    // Push config to Debian server via /api/kannel/sync (triggers gen-kannel-conf.sh on server)
    // Also try writing the config directly via /api/smpp/apply-config if available
    let applyData = {};
    let reloaded = false;

    // Try direct config apply first
    try {
      const applyRes = await fetch(`${SERVER_API_URL}/api/smpp/apply-config`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${SERVER_API_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
        signal: AbortSignal.timeout(10000),
      });
      if (applyRes.ok) {
        applyData = await applyRes.json().catch(() => ({}));
        reloaded = applyData.reloaded ?? false;
      }
    } catch (_) {}

    // Always trigger /api/kannel/sync as well (runs gen-kannel-conf.sh from MariaDB)
    try {
      const syncRes = await fetch(`${SERVER_API_URL}/api/kannel/sync`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${SERVER_API_TOKEN}`, 'Content-Type': 'application/json' },
        body: '{}',
        signal: AbortSignal.timeout(15000),
      });
      if (syncRes.ok) {
        const syncData = await syncRes.json().catch(() => ({}));
        applyData = { ...applyData, ...syncData };
        reloaded = reloaded || syncData.reloaded || syncData.ok;
      }
    } catch (_) {}

    console.log('[syncKannelOnChange] result:', { ...applyData, reloaded });

    return Response.json({
      ok: true,
      supplier_count: supplierBlocks.length,
      client_count: clientBlocks.length,
      reloaded,
      backup: applyData.backup || null,
      message: `Kannel synced: ${supplierBlocks.length} SMSC suppliers + ${clientBlocks.length} SMPP clients${reloaded ? ' — reloaded' : ' — backup saved, reload pending'}`,
    });

  } catch (error) {
    console.error('[syncKannelOnChange]', error.message);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});