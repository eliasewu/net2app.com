import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow both scheduled (no user) and manual (admin) calls
    let isAdmin = false;
    try {
      const user = await base44.auth.me();
      isAdmin = user?.role === 'admin';
    } catch (_) {
      // Called from scheduler — treat as trusted
      isAdmin = true;
    }

    if (!isAdmin) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const now = new Date();

    // Fetch all active alert rules
    const rules = await base44.asServiceRole.entities.AlertRule.filter({ is_active: true });
    if (!rules.length) {
      return Response.json({ message: 'No active rules', evaluated: 0 });
    }

    // Fetch recent SMS logs — last 24h window should cover all rules
    const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const allLogs = await base44.asServiceRole.entities.SmsLog.list('-created_date', 5000);

    const results = [];

    for (const rule of rules) {
      // Cooldown check — skip if fired recently
      if (rule.last_triggered_at) {
        const lastFired = new Date(rule.last_triggered_at);
        const cooldownMs = (rule.cooldown_minutes || 60) * 60 * 1000;
        if (now - lastFired < cooldownMs) {
          results.push({ rule: rule.name, skipped: 'cooldown' });
          continue;
        }
      }

      // Determine window cutoff
      const windowMs = (rule.window_minutes || 60) * 60 * 1000;
      const cutoff = new Date(now.getTime() - windowMs);

      // Filter logs to window + optional client/supplier filter
      let logs = allLogs.filter(l => {
        if (!l.created_date) return false;
        if (new Date(l.created_date) < cutoff) return false;
        if (rule.client_id && l.client_id !== rule.client_id) return false;
        if (rule.supplier_id && l.supplier_id !== rule.supplier_id) return false;
        return true;
      });

      const total = logs.length;
      const delivered = logs.filter(l => l.status === 'delivered').length;
      const failed = logs.filter(l => l.status === 'failed' || l.status === 'rejected').length;
      const deliveryRate = total > 0 ? (delivered / total) * 100 : 100;
      const failureRate = total > 0 ? (failed / total) * 100 : 0;

      const minMsgs = rule.min_messages || 10;
      let shouldFire = false;
      let alertTitle = '';
      let alertMessage = '';

      switch (rule.alert_type) {
        case 'delivery_rate_below':
          if (total >= minMsgs && deliveryRate < rule.threshold) {
            shouldFire = true;
            alertTitle = `⚠️ Low Delivery Rate: ${rule.name}`;
            alertMessage = `Delivery rate dropped to ${deliveryRate.toFixed(1)}% (threshold: ${rule.threshold}%) over the last ${rule.window_minutes} minutes. Total: ${total}, Delivered: ${delivered}, Failed: ${failed}.${rule.client_name ? ` Client: ${rule.client_name}.` : ''}${rule.supplier_name ? ` Supplier: ${rule.supplier_name}.` : ''}`;
          }
          break;

        case 'failure_rate_above':
          if (total >= minMsgs && failureRate > rule.threshold) {
            shouldFire = true;
            alertTitle = `🚨 High Failure Rate: ${rule.name}`;
            alertMessage = `Failure rate spiked to ${failureRate.toFixed(1)}% (threshold: ${rule.threshold}%) over the last ${rule.window_minutes} minutes. Total: ${total}, Failed: ${failed}.${rule.client_name ? ` Client: ${rule.client_name}.` : ''}`;
          }
          break;

        case 'volume_drop':
          if (total < rule.threshold) {
            shouldFire = true;
            alertTitle = `📉 Low Traffic Volume: ${rule.name}`;
            alertMessage = `Only ${total} messages sent in the last ${rule.window_minutes} minutes (threshold: ${rule.threshold} messages).${rule.client_name ? ` Client: ${rule.client_name}.` : ''}`;
          }
          break;

        case 'no_traffic':
          if (total === 0) {
            shouldFire = true;
            alertTitle = `🔇 No Traffic Detected: ${rule.name}`;
            alertMessage = `No SMS traffic detected in the last ${rule.window_minutes} minutes.${rule.client_name ? ` Client: ${rule.client_name}.` : ''}${rule.supplier_name ? ` Supplier: ${rule.supplier_name}.` : ''}`;
          }
          break;

        case 'balance_below': {
          // Check client balance from Client entity
          if (rule.client_id) {
            const clients = await base44.asServiceRole.entities.Client.filter({ id: rule.client_id });
            const client = clients[0];
            if (client && (client.balance || 0) < rule.threshold) {
              shouldFire = true;
              alertTitle = `💰 Low Balance: ${rule.name}`;
              alertMessage = `Client "${client.name}" balance is ${client.currency || 'USD'} ${(client.balance || 0).toFixed(2)}, below threshold of ${rule.threshold}. Please top up.`;
            }
          } else {
            // Check all clients
            const clients = await base44.asServiceRole.entities.Client.filter({ status: 'active' });
            const lowClients = clients.filter(c => (c.balance || 0) < rule.threshold);
            if (lowClients.length > 0) {
              shouldFire = true;
              alertTitle = `💰 Low Balance Alert: ${rule.name}`;
              alertMessage = `${lowClients.length} client(s) have balance below ${rule.threshold}: ${lowClients.map(c => `${c.name} (${c.currency || 'USD'} ${(c.balance || 0).toFixed(2)})`).join(', ')}.`;
            }
          }
          break;
        }
      }

      if (shouldFire) {
        // Create in-app notification
        await base44.asServiceRole.entities.Notification.create({
          type: 'system_alert',
          title: alertTitle,
          message: alertMessage,
          severity: rule.severity || 'warning',
          channel: 'email',
          is_read: false,
          target_user: rule.notify_email,
        });

        // Send email notification
        const emails = (rule.notify_email || '').split(',').map(e => e.trim()).filter(Boolean);
        for (const email of emails) {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: email,
            subject: alertTitle,
            body: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: #1e293b; color: white; padding: 16px 20px; border-radius: 8px 8px 0 0;">
                  <h2 style="margin: 0; font-size: 16px;">Net2app SMS Alert</h2>
                </div>
                <div style="border: 1px solid #e2e8f0; border-top: none; padding: 20px; border-radius: 0 0 8px 8px;">
                  <h3 style="color: #1e293b; margin-top: 0;">${alertTitle}</h3>
                  <p style="color: #475569; line-height: 1.6;">${alertMessage}</p>
                  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                  <p style="color: #94a3b8; font-size: 12px;">Rule: <strong>${rule.name}</strong> | Window: ${rule.window_minutes} min | Cooldown: ${rule.cooldown_minutes} min</p>
                  <p style="color: #94a3b8; font-size: 12px;">Triggered at: ${now.toISOString()}</p>
                </div>
              </div>
            `,
          });
        }

        // Update rule's last_triggered_at
        await base44.asServiceRole.entities.AlertRule.update(rule.id, {
          last_triggered_at: now.toISOString(),
        });

        results.push({ rule: rule.name, fired: true, emails: emails.length });
        console.log(`Alert fired: ${rule.name}`);
      } else {
        results.push({ rule: rule.name, fired: false });
      }
    }

    return Response.json({ evaluated: rules.length, results });
  } catch (error) {
    console.error('evaluateAlerts error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});