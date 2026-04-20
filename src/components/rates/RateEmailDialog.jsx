import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Send, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

function buildRateTableHtml(rates, entityName) {
  const rows = rates.map(r => `
    <tr>
      <td style="padding:6px 10px;border:1px solid #e2e8f0;">${r.country || '-'}</td>
      <td style="padding:6px 10px;border:1px solid #e2e8f0;">${r.network || '-'}</td>
      <td style="padding:6px 10px;border:1px solid #e2e8f0;font-family:monospace;">${r.mcc || '-'}</td>
      <td style="padding:6px 10px;border:1px solid #e2e8f0;font-family:monospace;">${r.mnc || '-'}</td>
      <td style="padding:6px 10px;border:1px solid #e2e8f0;font-family:monospace;">${r.prefix || '-'}</td>
      <td style="padding:6px 10px;border:1px solid #e2e8f0;font-weight:bold;color:#16a34a;">${r.rate?.toFixed(5) || '0.00000'}</td>
      <td style="padding:6px 10px;border:1px solid #e2e8f0;">${r.currency || 'USD'}</td>
      <td style="padding:6px 10px;border:1px solid #e2e8f0;">${r.status || 'active'}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Inter,Arial,sans-serif;color:#1e293b;max-width:900px;margin:0 auto;padding:20px;">
  <h2 style="color:#1d4ed8;margin-bottom:4px;">Rate Card Update</h2>
  <p style="color:#64748b;font-size:14px;">For: <strong>${entityName}</strong> &mdash; Generated: ${new Date().toLocaleDateString()}</p>
  <p style="color:#64748b;font-size:13px;">This rate card supersedes all previous versions. Please update your systems accordingly.</p>
  <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:16px;">
    <thead>
      <tr style="background:#1d4ed8;color:white;">
        <th style="padding:8px 10px;text-align:left;">Country</th>
        <th style="padding:8px 10px;text-align:left;">Network</th>
        <th style="padding:8px 10px;text-align:left;">MCC</th>
        <th style="padding:8px 10px;text-align:left;">MNC</th>
        <th style="padding:8px 10px;text-align:left;">Prefix</th>
        <th style="padding:8px 10px;text-align:left;">Rate</th>
        <th style="padding:8px 10px;text-align:left;">Currency</th>
        <th style="padding:8px 10px;text-align:left;">Status</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <p style="margin-top:20px;font-size:12px;color:#94a3b8;">This is an automated rate notification from Net2app platform.</p>
</body>
</html>`;
}

export default function RateEmailDialog({ open, onClose, entityName, entityEmail, rates, entityType }) {
  const [toEmail, setToEmail] = useState(entityEmail || '');
  const [subject, setSubject] = useState(`Rate Card Update — ${entityName} — ${new Date().toLocaleDateString()}`);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!toEmail) { toast.error("Recipient email required"); return; }
    setLoading(true);
    const htmlBody = buildRateTableHtml(rates, entityName);
    const emailBody = `${note ? note + '\n\n' : ''}${htmlBody}\n\n---\nTotal destinations: ${rates.length} | Rate type: ${entityType}`;
    await base44.integrations.Core.SendEmail({
      to: toEmail,
      subject,
      body: emailBody,
    });
    toast.success(`Rate card sent to ${toEmail}`);
    setLoading(false);
    onClose();
  };

  const activeRates = rates.filter(r => r.status === 'active');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-4 h-4" />Send Rate Card — {entityName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
            <Badge variant="outline" className="bg-blue-100 text-blue-700">{activeRates.length} active rates</Badge>
            <span>({entityType === 'client' ? 'Client' : entityType === 'supplier' ? 'Supplier' : 'VoIP'} rate card)</span>
          </div>
          <div className="space-y-1.5">
            <Label>Recipient Email *</Label>
            <Input type="email" value={toEmail} onChange={e => setToEmail(e.target.value)} placeholder="client@company.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Optional Note (prepended to email)</Label>
            <Textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Please review the updated rates effective from..." />
          </div>
          <div className="p-2 bg-muted/40 rounded text-xs text-muted-foreground">
            An HTML rate table with Country, Network, MCC/MNC, Prefix, Rate, Currency will be sent as email body.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSend} disabled={loading} className="gap-1">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send Rate Card
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}