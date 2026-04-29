import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Supplier Health Monitor
 * - Reads recent SmsLog records (last 1 hour) per supplier
 * - Computes error rate, success rate, and avg latency
 * - Updates SupplierHealth entity
 * - Auto-disables supplier if error_rate > threshold AND total_checked >= min_messages
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow scheduled (service role) and admin calls
    let isScheduled = false;
    try {
      const user = await base44.auth.me();
      if (user && user.role !== 'admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    } catch {
      // Called from automation (no user token) — use service role
      isScheduled = true;
    }

    const client = isScheduled ? base44.asServiceRole : base44;

    // Fetch last 500 SMS logs to get recent data
    const logs = await client.entities.SmsLog.list('-created_date', 500);
    const suppliers = await client.entities.Supplier.list();
    const healthRecords = await client.entities.SupplierHealth.list();

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Group recent logs by supplier
    const supplierLogs = {};
    for (const log of logs) {
      if (!log.supplier_id) continue;
      const created = log.created_date ? new Date(log.created_date) : null;
      if (!created || created < oneHourAgo) continue;

      if (!supplierLogs[log.supplier_id]) {
        supplierLogs[log.supplier_id] = { name: log.supplier_name || log.supplier_id, logs: [] };
      }
      supplierLogs[log.supplier_id].logs.push(log);
    }

    const results = [];

    for (const supplier of suppliers) {
      const entry = supplierLogs[supplier.id] || { name: supplier.name, logs: [] };
      const allLogs = entry.logs;
      const total = allLogs.length;
      const failed = allLogs.filter(l => l.status === 'failed' || l.status === 'rejected').length;
      const delivered = allLogs.filter(l => l.status === 'delivered').length;

      const errorRate = total > 0 ? parseFloat(((failed / total) * 100).toFixed(2)) : 0;
      const successRate = total > 0 ? parseFloat(((delivered / total) * 100).toFixed(2)) : 0;

      // Estimate latency from submit_time → delivery_time where available
      const withDelivery = allLogs.filter(l => l.submit_time && l.delivery_time);
      let avgLatency = null;
      if (withDelivery.length > 0) {
        const totalMs = withDelivery.reduce((sum, l) => {
          const diff = new Date(l.delivery_time) - new Date(l.submit_time);
          return sum + (diff > 0 ? diff : 0);
        }, 0);
        avgLatency = Math.round(totalMs / withDelivery.length);
      }

      // Determine health status
      let status = 'unknown';
      if (total >= 5) {
        if (errorRate >= 50) status = 'critical';
        else if (errorRate >= 25) status = 'degraded';
        else status = 'healthy';
      }

      // Find existing health record
      const existing = healthRecords.find(h => h.supplier_id === supplier.id);
      const threshold = existing?.threshold_error_rate ?? 30;
      const minMsgs = existing?.threshold_min_messages ?? 10;

      // Auto-disable logic
      let autoDisabled = existing?.auto_disabled || false;
      if (total >= minMsgs && errorRate >= threshold && supplier.status === 'active') {
        console.log(`[HealthCheck] Auto-disabling supplier ${supplier.name} — error rate ${errorRate}% >= threshold ${threshold}%`);
        await client.entities.Supplier.update(supplier.id, { status: 'inactive' });
        autoDisabled = true;
      }

      const healthData = {
        supplier_id: supplier.id,
        supplier_name: supplier.name,
        latency_ms: avgLatency,
        error_rate: errorRate,
        success_rate: successRate,
        total_checked: total,
        total_failed: failed,
        status,
        auto_disabled: autoDisabled,
        last_checked_at: new Date().toISOString(),
      };

      if (existing) {
        await client.entities.SupplierHealth.update(existing.id, healthData);
      } else {
        await client.entities.SupplierHealth.create(healthData);
      }

      results.push({ supplier: supplier.name, status, errorRate, total });
    }

    console.log(`[HealthCheck] Checked ${results.length} suppliers`);
    return Response.json({ ok: true, checked: results.length, results });
  } catch (error) {
    console.error('[HealthCheck] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});