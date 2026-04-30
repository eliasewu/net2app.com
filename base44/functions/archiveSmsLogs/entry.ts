import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * archiveSmsLogs
 * Moves SMS logs older than 30 days to SmsLogArchive entity, then deletes the originals.
 * Safe to run daily — only touches records older than cutoff.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow scheduled calls (no user) or admin calls
    try {
      const user = await base44.auth.me();
      if (user && user.role !== 'admin') {
        return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
      }
    } catch (_) {
      // Scheduled — proceed as service role
    }

    const client = base44.asServiceRole;

    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    console.log(`[ArchiveSmsLogs] Archiving logs older than ${cutoff.toISOString()}`);

    // Fetch up to 2000 old logs
    const allLogs = await client.entities.SmsLog.list('created_date', 2000);

    const oldLogs = allLogs.filter(log => {
      if (!log.created_date) return false;
      return new Date(log.created_date) < cutoff;
    });

    if (oldLogs.length === 0) {
      console.log('[ArchiveSmsLogs] No logs older than 30 days — nothing to archive.');
      return Response.json({ ok: true, archived: 0, message: 'Nothing to archive' });
    }

    console.log(`[ArchiveSmsLogs] Found ${oldLogs.length} logs to archive`);

    let archived = 0;
    let failed = 0;
    const BATCH = 50;

    for (let i = 0; i < oldLogs.length; i += BATCH) {
      const batch = oldLogs.slice(i, i + BATCH);

      // Determine archive month from created_date
      const archiveBatch = batch.map(log => {
        const d = new Date(log.created_date);
        const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return {
          archive_month: month,
          message_id: log.message_id,
          client_id: log.client_id,
          client_name: log.client_name,
          supplier_id: log.supplier_id,
          supplier_name: log.supplier_name,
          route_id: log.route_id,
          sender_id: log.sender_id,
          destination: log.destination,
          mcc: log.mcc,
          mnc: log.mnc,
          country: log.country,
          network: log.network,
          content: log.content,
          status: log.status,
          fail_reason: log.fail_reason,
          dest_message_id: log.dest_message_id,
          submit_time: log.submit_time,
          delivery_time: log.delivery_time,
          sms_type: log.sms_type,
          parts: log.parts,
          cost: log.cost,
          sell_rate: log.sell_rate,
          original_created_date: log.created_date,
        };
      });

      // Bulk create archive records
      for (const record of archiveBatch) {
        try {
          await client.entities.SmsLogArchive.create(record);
          archived++;
        } catch (e) {
          console.error(`[ArchiveSmsLogs] Failed to archive log: ${e.message}`);
          failed++;
        }
      }

      // Delete originals
      for (const log of batch) {
        try {
          await client.entities.SmsLog.delete(log.id);
        } catch (e) {
          console.error(`[ArchiveSmsLogs] Failed to delete log ${log.id}: ${e.message}`);
        }
      }
    }

    console.log(`[ArchiveSmsLogs] Done — archived: ${archived}, failed: ${failed}`);
    return Response.json({ ok: true, archived, failed, total_processed: oldLogs.length });
  } catch (error) {
    console.error('[ArchiveSmsLogs] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});