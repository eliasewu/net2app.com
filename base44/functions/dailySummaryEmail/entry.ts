import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * dailySummaryEmail
 * Sends a daily traffic + supplier health summary email.
 * Triggered by scheduler or manually by admin.
 */

const CONTACT_EMAIL = Deno.env.get('SUMMARY_EMAIL') || '';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json().catch(() => ({}));
    const recipientEmail = payload.email || CONTACT_EMAIL;

    if (!recipientEmail) {
      return Response.json({ error: 'No recipient email configured. Set SUMMARY_EMAIL secret or pass email in payload.' }, { status: 400 });
    }

    // Allow scheduled (no user) or admin calls
    try {
      const user = await base44.auth.me();
      if (user && user.role !== 'admin') {
        return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
      }
    } catch (_) { /* scheduled */ }

    const client = base44.asServiceRole;
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Fetch last 24h of SMS logs
    const allLogs = await client.entities.SmsLog.list('-created_date', 5000);
    const logs24h = allLogs.filter(l => l.created_date && new Date(l.created_date) >= yesterday);

    const total = logs24h.length;
    const delivered = logs24h.filter(l => l.status === 'delivered').length;
    const failed = logs24h.filter(l => l.status === 'failed' || l.status === 'rejected').length;
    const pending = logs24h.filter(l => l.status === 'pending' || l.status === 'sent').length;
    const deliveryRate = total > 0 ? ((delivered / total) * 100).toFixed(1) : '0.0';

    // Top suppliers by volume
    const supplierMap = {};
    for (const log of logs24h) {
      if (!log.supplier_name) continue;
      if (!supplierMap[log.supplier_name]) supplierMap[log.supplier_name] = { total: 0, delivered: 0, failed: 0 };
      supplierMap[log.supplier_name].total++;
      if (log.status === 'delivered') supplierMap[log.supplier_name].delivered++;
      if (log.status === 'failed' || log.status === 'rejected') supplierMap[log.supplier_name].failed++;
    }
    const topSuppliers = Object.entries(supplierMap)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5);

    // Supplier health alerts
    const healthRecords = await client.entities.SupplierHealth.list();
    const criticalSuppliers = healthRecords.filter(h => h.status === 'critical' || h.auto_disabled);

    // Top clients by volume
    const clientMap = {};
    for (const log of logs24h) {
      if (!log.client_name) continue;
      if (!clientMap[log.client_name]) clientMap[log.client_name] = { total: 0, delivered: 0 };
      clientMap[log.client_name].total++;
      if (log.status === 'delivered') clientMap[log.client_name].delivered++;
    }
    const topClients = Object.entries(clientMap)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5);

    // Total cost
    const totalCost = logs24h.reduce((s, l) => s + (l.cost || 0), 0);

    // Build email HTML
    const dateStr = now.toLocaleDateString('en-AE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Dubai' });

    const supplierRows = topSuppliers.map(([name, s]) => {
      const rate = s.total > 0 ? ((s.delivered / s.total) * 100).toFixed(1) : '0.0';
      const color = parseFloat(rate) >= 80 ? '#16a34a' : parseFloat(rate) >= 60 ? '#d97706' : '#dc2626';
      return `<tr><td style="padding:8px 12px;border-bottom:1px solid #f1f5f9">${name}</td><td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center">${s.total}</td><td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center;color:${color};font-weight:600">${rate}%</td><td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center;color:#dc2626">${s.failed}</td></tr>`;
    }).join('');

    const clientRows = topClients.map(([name, c]) => {
      const rate = c.total > 0 ? ((c.delivered / c.total) * 100).toFixed(1) : '0.0';
      return `<tr><td style="padding:8px 12px;border-bottom:1px solid #f1f5f9">${name}</td><td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center">${c.total}</td><td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center">${rate}%</td></tr>`;
    }).join('');

    const alertSection = criticalSuppliers.length > 0
      ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:20px 0">
          <h3 style="margin:0 0 10px;color:#dc2626;font-size:15px">🚨 Supplier Health Alerts (${criticalSuppliers.length})</h3>
          ${criticalSuppliers.map(h => `<p style="margin:4px 0;color:#7f1d1d;font-size:13px">⚠ <strong>${h.supplier_name}</strong> — ${h.status}${h.auto_disabled ? ' (Auto-disabled)' : ''} | Error rate: ${h.error_rate?.toFixed(1) ?? '?'}%</p>`).join('')}
         </div>`
      : `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;margin:20px 0">
          <p style="margin:0;color:#15803d;font-size:13px">✅ All suppliers healthy — no critical alerts</p>
         </div>`;

    const rateColor = parseFloat(deliveryRate) >= 80 ? '#16a34a' : parseFloat(deliveryRate) >= 60 ? '#d97706' : '#dc2626';

    const htmlBody = `
<div style="font-family:Inter,sans-serif;max-width:640px;margin:0 auto;background:#f8fafc;padding:20px">
  <div style="background:#1e293b;color:white;padding:20px 24px;border-radius:12px 12px 0 0;display:flex;align-items:center;justify-content:space-between">
    <div>
      <h1 style="margin:0;font-size:20px;font-weight:700">Net2app</h1>
      <p style="margin:4px 0 0;font-size:13px;color:#94a3b8">Daily Traffic Summary</p>
    </div>
    <p style="margin:0;font-size:12px;color:#64748b">${dateStr}</p>
  </div>

  <div style="background:white;border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 12px 12px">
    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px">
      <div style="background:#eff6ff;border-radius:8px;padding:14px;text-align:center">
        <p style="margin:0;font-size:11px;color:#3b82f6;font-weight:600;text-transform:uppercase">Total</p>
        <p style="margin:6px 0 0;font-size:26px;font-weight:700;color:#1e40af">${total.toLocaleString()}</p>
      </div>
      <div style="background:#f0fdf4;border-radius:8px;padding:14px;text-align:center">
        <p style="margin:0;font-size:11px;color:#16a34a;font-weight:600;text-transform:uppercase">Delivered</p>
        <p style="margin:6px 0 0;font-size:26px;font-weight:700;color:#15803d">${delivered.toLocaleString()}</p>
      </div>
      <div style="background:#fef2f2;border-radius:8px;padding:14px;text-align:center">
        <p style="margin:0;font-size:11px;color:#dc2626;font-weight:600;text-transform:uppercase">Failed</p>
        <p style="margin:6px 0 0;font-size:26px;font-weight:700;color:#b91c1c">${failed.toLocaleString()}</p>
      </div>
      <div style="background:#f5f3ff;border-radius:8px;padding:14px;text-align:center">
        <p style="margin:0;font-size:11px;color:#7c3aed;font-weight:600;text-transform:uppercase">Rate</p>
        <p style="margin:6px 0 0;font-size:26px;font-weight:700;color:${rateColor}">${deliveryRate}%</p>
      </div>
    </div>

    <p style="margin:0 0 4px;font-size:12px;color:#94a3b8">Total Cost (24h): <strong style="color:#1e293b">$${totalCost.toFixed(4)}</strong></p>

    ${alertSection}

    <!-- Top Suppliers -->
    ${topSuppliers.length > 0 ? `
    <h3 style="font-size:14px;font-weight:600;color:#1e293b;margin:20px 0 10px">Top Suppliers (24h)</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:#f8fafc">
        <th style="padding:8px 12px;text-align:left;color:#64748b;font-weight:600;border-bottom:2px solid #e2e8f0">Supplier</th>
        <th style="padding:8px 12px;text-align:center;color:#64748b;font-weight:600;border-bottom:2px solid #e2e8f0">Volume</th>
        <th style="padding:8px 12px;text-align:center;color:#64748b;font-weight:600;border-bottom:2px solid #e2e8f0">Delivery Rate</th>
        <th style="padding:8px 12px;text-align:center;color:#64748b;font-weight:600;border-bottom:2px solid #e2e8f0">Failed</th>
      </tr></thead>
      <tbody>${supplierRows}</tbody>
    </table>` : ''}

    <!-- Top Clients -->
    ${topClients.length > 0 ? `
    <h3 style="font-size:14px;font-weight:600;color:#1e293b;margin:20px 0 10px">Top Clients (24h)</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:#f8fafc">
        <th style="padding:8px 12px;text-align:left;color:#64748b;font-weight:600;border-bottom:2px solid #e2e8f0">Client</th>
        <th style="padding:8px 12px;text-align:center;color:#64748b;font-weight:600;border-bottom:2px solid #e2e8f0">Volume</th>
        <th style="padding:8px 12px;text-align:center;color:#64748b;font-weight:600;border-bottom:2px solid #e2e8f0">Delivery Rate</th>
      </tr></thead>
      <tbody>${clientRows}</tbody>
    </table>` : ''}

    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
    <p style="color:#94a3b8;font-size:11px;text-align:center;margin:0">
      Net2app Automated Daily Report • Generated ${now.toISOString()} • net2app.com
    </p>
  </div>
</div>`;

    await client.integrations.Core.SendEmail({
      to: recipientEmail,
      subject: `📊 Net2app Daily Summary — ${dateStr} | ${total.toLocaleString()} msgs | ${deliveryRate}% delivery`,
      body: htmlBody,
    });

    console.log(`[DailySummary] Sent to ${recipientEmail} — Total: ${total}, Delivered: ${delivered}, Rate: ${deliveryRate}%`);
    return Response.json({ ok: true, sent_to: recipientEmail, total, delivered, delivery_rate: deliveryRate });
  } catch (error) {
    console.error('[DailySummary] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});