/**
 * Net2app — Real-time Billing Deduction
 * Triggered by entity automation on SmsLog create + update.
 *
 * Logic mirrors the MariaDB trigger (BILLING_TRIGGER_SQL):
 *   - CLIENT billing_type:
 *       send     → charge on any non-blocked status (including 'sent', 'pending', 'delivered', 'failed')
 *       submit   → charge on non-failed/rejected/blocked/pending (has been accepted by SMSC)
 *       delivery → charge only on 'delivered' (+ force_dlr counts when status != blocked/pending/failed/rejected)
 *   - SUPPLIER billing_type:
 *       send     → record cost on any non-blocked status
 *       submit   → record cost on successful submit only
 *       delivery → record cost only on 'delivered'
 *
 * To avoid double-charging on updates, we track a `client_billed` / `supplier_billed`
 * flag on the SmsLog record itself. Deduction only fires once per log.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const { event, data, old_data } = body;
    if (!data) {
      return Response.json({ ok: false, reason: 'no data' });
    }

    const log = data;
    const status = log.status;
    const clientId = log.client_id;
    const supplierId = log.supplier_id;

    if (!clientId || !status) {
      return Response.json({ ok: false, reason: 'missing client_id or status' });
    }

    // Skip if nothing changed (same status on update)
    if (event?.type === 'update' && old_data?.status === status) {
      return Response.json({ ok: true, reason: 'status unchanged, skip' });
    }

    // Load client + supplier in parallel
    const [clients, suppliers] = await Promise.all([
      base44.asServiceRole.entities.Client.filter({ id: clientId }),
      supplierId ? base44.asServiceRole.entities.Supplier.filter({ id: supplierId }) : Promise.resolve([]),
    ]);

    const client = clients[0];
    const supplier = suppliers[0] || null;

    if (!client) {
      return Response.json({ ok: false, reason: 'client not found' });
    }

    const clientBillingType = client.billing_type || 'submit';
    const supplierBillingType = supplier?.billing_type || 'submit';
    const sellRate = log.sell_rate || 0;
    const cost = log.cost || 0;

    // ── Determine if client should be charged ──────────────────────────────
    let doClientCharge = false;
    // Only charge once — check if already billed on a previous status
    const alreadyClientBilled = log.client_billed === true;

    const isCreate = event?.type === 'create';
    const isUpdate = event?.type === 'update';
    const oldStatus = old_data?.status;

    if (!alreadyClientBilled) {
      if (clientBillingType === 'send') {
        // Charge on CREATE (gateway received) — anything except blocked
        if (isCreate && !['blocked'].includes(status)) doClientCharge = true;
        // Also fire on update if was previously pending (e.g. send fires on first status change)
        if (isUpdate && oldStatus === 'pending' && !['blocked', 'pending'].includes(status)) doClientCharge = true;
      } else if (clientBillingType === 'submit') {
        // Charge once SMSC accepts — status moves to sent/delivered (not failed/rejected/blocked/pending)
        if (!['failed', 'rejected', 'blocked', 'pending'].includes(status)) {
          // Only on status change from pending/sent (avoids duplicate on delivered)
          if (isCreate && !['failed', 'rejected', 'blocked', 'pending'].includes(status)) doClientCharge = true;
          if (isUpdate && ['pending', 'sent'].includes(oldStatus) && !['failed', 'rejected', 'blocked', 'pending'].includes(status)) doClientCharge = true;
        }
      } else if (clientBillingType === 'delivery') {
        // Charge only on delivered
        if (status === 'delivered') {
          doClientCharge = true;
        } else if (client.force_dlr && isUpdate && ['pending', 'sent'].includes(oldStatus) && !['failed', 'rejected', 'blocked', 'pending'].includes(status)) {
          // force_dlr: synthetic delivered was sent to client
          doClientCharge = true;
        }
      }
    }

    // ── Determine if supplier should be tracked as cost ────────────────────
    let doSupplierCost = false;
    const alreadySupplierBilled = log.supplier_billed === true;

    if (!alreadySupplierBilled && supplier) {
      if (supplierBillingType === 'send') {
        if (isCreate && !['blocked'].includes(status)) doSupplierCost = true;
        if (isUpdate && oldStatus === 'pending' && !['blocked', 'pending'].includes(status)) doSupplierCost = true;
      } else if (supplierBillingType === 'submit') {
        if (isCreate && !['failed', 'rejected', 'blocked', 'pending'].includes(status)) doSupplierCost = true;
        if (isUpdate && ['pending', 'sent'].includes(oldStatus) && !['failed', 'rejected', 'blocked', 'pending'].includes(status)) doSupplierCost = true;
      } else if (supplierBillingType === 'delivery') {
        doSupplierCost = status === 'delivered';
      }
    }

    // ── Apply charges ──────────────────────────────────────────────────────
    const updates = {};
    const clientUpdates = {};

    if (doClientCharge && sellRate > 0) {
      const newBalance = (client.balance || 0) - sellRate;
      clientUpdates.balance = newBalance;
      updates.client_billed = true;
      console.log(`[billingDeduct] Client ${client.name}: deducting ${sellRate} → new balance ${newBalance.toFixed(4)} (billing_type=${clientBillingType}, status=${status})`);
    }

    if (doSupplierCost) {
      updates.supplier_billed = true;
      console.log(`[billingDeduct] Supplier ${supplier.name}: cost ${cost} recorded (billing_type=${supplierBillingType}, status=${status})`);
    }

    const ops = [];

    if (Object.keys(clientUpdates).length > 0) {
      ops.push(base44.asServiceRole.entities.Client.update(clientId, clientUpdates));
    }

    if (Object.keys(updates).length > 0) {
      ops.push(base44.asServiceRole.entities.SmsLog.update(log.id, updates));
    }

    if (ops.length > 0) {
      await Promise.all(ops);
    }

    return Response.json({
      ok: true,
      client_charged: doClientCharge,
      supplier_cost_recorded: doSupplierCost,
      sell_rate: sellRate,
      cost,
      status,
      client_billing_type: clientBillingType,
      supplier_billing_type: supplierBillingType,
    });

  } catch (error) {
    console.error('[billingDeduct]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});