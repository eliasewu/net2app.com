/**
 * smppBindAlert — fires when a Supplier's bind_status changes to 'failed'
 * Creates a Notification record visible in the dashboard Notifications page.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const { event, data, old_data } = body;

    const entityName = event?.entity_name;
    const entityId = event?.entity_id;

    // Determine entity type and get relevant info
    let name = data?.name || entityId;
    let oldStatus = old_data?.bind_status;
    let newStatus = data?.bind_status;

    // Only act when bind_status changed to failed/unknown from connected
    if (!newStatus || newStatus === oldStatus) {
      return Response.json({ ok: true, skipped: 'no bind_status change' });
    }
    if (newStatus !== 'failed' && newStatus !== 'unknown') {
      return Response.json({ ok: true, skipped: 'not an offline transition' });
    }
    if (oldStatus === 'failed' || oldStatus === 'unknown') {
      return Response.json({ ok: true, skipped: 'already offline' });
    }

    const type = entityName === 'Client' ? 'Client' : 'Supplier';
    const title = `${type} SMPP Offline: ${name}`;
    const message = `${type} "${name}" bind status changed from "${oldStatus || 'connected'}" to "${newStatus}". Check SMPP Gateway for details.`;

    await base44.asServiceRole.entities.Notification.create({
      type: 'alert',
      title,
      message,
      is_read: false,
      data: JSON.stringify({ entity_type: type, entity_id: entityId, old_status: oldStatus, new_status: newStatus })
    });

    return Response.json({ ok: true, notification: title });
  } catch (error) {
    console.error('[smppBindAlert]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});