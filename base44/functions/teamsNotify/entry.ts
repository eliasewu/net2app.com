import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const TEAM_ID = Deno.env.get("TEAMS_TEAM_ID");
const CHANNEL_ID = Deno.env.get("TEAMS_CHANNEL_ID");
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

async function sendTeamsMessage(accessToken, htmlContent) {
  const url = `${GRAPH_BASE}/teams/${TEAM_ID}/channels/${CHANNEL_ID}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      body: { contentType: "html", content: htmlContent },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || "Teams API error");
  return data;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow admin users or scheduled service-role calls
    let client = base44.asServiceRole;
    try {
      const user = await base44.auth.me();
      if (user && user.role !== 'admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    } catch {
      // scheduled / service role call — continue
    }

    const { type } = await req.json().catch(() => ({}));

    const { accessToken } = await base44.asServiceRole.connectors.getConnection("microsoft_teams");

    // ── Daily Summary ─────────────────────────────────────────────
    if (!type || type === "daily_summary") {
      const logs = await client.entities.SmsLog.list('-created_date', 500);
      const healthRecords = await client.entities.SupplierHealth.list();

      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recent = logs.filter(l => l.created_date && new Date(l.created_date) >= since24h);

      const total = recent.length;
      const delivered = recent.filter(l => l.status === 'delivered').length;
      const failed = recent.filter(l => l.status === 'failed' || l.status === 'rejected').length;
      const deliveryRate = total > 0 ? Math.round((delivered / total) * 100) : 0;
      const totalCost = recent.reduce((s, l) => s + (l.cost || 0), 0).toFixed(4);

      const criticalSuppliers = healthRecords.filter(h => h.status === 'critical' || h.auto_disabled);
      const autoDisabled = healthRecords.filter(h => h.auto_disabled);

      const now = new Date().toUTCString();

      let html = `
<h2>📊 Daily SMS Summary — ${now}</h2>
<table>
  <tr><td><b>Total Messages (24h)</b></td><td>${total.toLocaleString()}</td></tr>
  <tr><td><b>Delivered</b></td><td style="color:green">${delivered.toLocaleString()}</td></tr>
  <tr><td><b>Failed/Rejected</b></td><td style="color:red">${failed.toLocaleString()}</td></tr>
  <tr><td><b>Delivery Rate</b></td><td>${deliveryRate}%</td></tr>
  <tr><td><b>Total Cost</b></td><td>$${totalCost}</td></tr>
</table>`;

      if (criticalSuppliers.length > 0) {
        html += `<br><h3>⚠️ Supplier Alerts</h3><ul>`;
        for (const s of criticalSuppliers) {
          html += `<li><b>${s.supplier_name}</b> — ${s.auto_disabled ? '🚫 Auto-Disabled' : '🔴 Critical'} | Error Rate: ${s.error_rate?.toFixed(1)}%</li>`;
        }
        html += `</ul>`;
      }

      if (autoDisabled.length > 0) {
        html += `<br><p>🚫 <b>${autoDisabled.length} supplier(s) were auto-disabled due to high error rates.</b></p>`;
      }

      await sendTeamsMessage(accessToken, html);
      return Response.json({ ok: true, type: "daily_summary", total, deliveryRate });
    }

    // ── Supplier Failure Alert ────────────────────────────────────
    if (type === "supplier_alert") {
      const { supplier_name, error_rate, status, auto_disabled } = await req.json().catch(() => ({}));
      const icon = auto_disabled ? '🚫' : status === 'critical' ? '🔴' : '🟡';
      const html = `
<h3>${icon} Supplier Alert: ${supplier_name || 'Unknown'}</h3>
<table>
  <tr><td><b>Status</b></td><td>${auto_disabled ? 'Auto-Disabled' : status}</td></tr>
  <tr><td><b>Error Rate</b></td><td>${error_rate?.toFixed ? error_rate.toFixed(1) : error_rate}%</td></tr>
  <tr><td><b>Time</b></td><td>${new Date().toUTCString()}</td></tr>
</table>`;
      await sendTeamsMessage(accessToken, html);
      return Response.json({ ok: true, type: "supplier_alert" });
    }

    return Response.json({ error: "Unknown type. Use 'daily_summary' or 'supplier_alert'" }, { status: 400 });

  } catch (error) {
    console.error('[teamsNotify]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});