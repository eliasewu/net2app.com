import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Send, FileText } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function Invoices() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ client_id: '', period_start: '', period_end: '', period_type: 'monthly', currency: 'USD', notes: '' });
  const qc = useQueryClient();

  const { data: invoices = [] } = useQuery({ queryKey: ['invoices'], queryFn: () => base44.entities.Invoice.list('-created_date'), initialData: [] });
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list(), initialData: [] });
  const { data: logs = [] } = useQuery({ queryKey: ['invoice-logs'], queryFn: () => base44.entities.SmsLog.list('-created_date', 200), initialData: [] });

  const createMut = useMutation({
    mutationFn: (d) => {
      const client = clients.find(c => c.id === d.client_id);
      const clientLogs = logs.filter(l => l.client_id === d.client_id && l.created_date >= d.period_start && l.created_date <= d.period_end);
      const totalSms = clientLogs.length;
      const totalAmount = clientLogs.reduce((sum, l) => sum + (l.sell_rate || 0), 0);
      const invNum = `INV-${Date.now().toString(36).toUpperCase()}`;
      return base44.entities.Invoice.create({
        ...d, client_name: client?.name || '', invoice_number: invNum,
        total_sms: totalSms, total_amount: totalAmount, status: 'draft'
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); setDialogOpen(false); toast.success("Invoice created"); },
  });

  const sendInvoice = async (inv) => {
    const client = clients.find(c => c.id === inv.client_id);
    if (client?.email) {
      await base44.integrations.Core.SendEmail({
        to: client.email,
        subject: `Invoice ${inv.invoice_number}`,
        body: `Dear ${client.name},\n\nPlease find your invoice details:\n\nInvoice: ${inv.invoice_number}\nPeriod: ${inv.period_start} to ${inv.period_end}\nTotal SMS: ${inv.total_sms}\nTotal Amount: ${inv.currency} ${inv.total_amount?.toFixed(2)}\n\nPlease arrange payment at your earliest convenience.\n\nBest regards,\nSMS Gateway Admin`
      });
      await base44.entities.Invoice.update(inv.id, { status: 'sent' });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      toast.success("Invoice sent to " + client.email);
    } else {
      toast.error("Client email not found");
    }
  };

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-6">
      <PageHeader title="Invoices" description="Generate and manage client invoices">
        <Button onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4 mr-2" />Generate Invoice</Button>
      </PageHeader>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>SMS Count</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono font-medium">{inv.invoice_number}</TableCell>
                  <TableCell>{inv.client_name}</TableCell>
                  <TableCell className="text-sm">{inv.period_start} — {inv.period_end}</TableCell>
                  <TableCell className="capitalize">{inv.period_type}</TableCell>
                  <TableCell>{inv.total_sms}</TableCell>
                  <TableCell className="font-mono font-medium">{inv.currency} {inv.total_amount?.toFixed(2)}</TableCell>
                  <TableCell><StatusBadge status={inv.status} /></TableCell>
                  <TableCell className="text-right">
                    {inv.status === 'draft' && (
                      <Button variant="ghost" size="sm" onClick={() => sendInvoice(inv)}>
                        <Send className="w-4 h-4 mr-1" />Send
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {invoices.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-12">No invoices yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Generate Invoice</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Client</Label>
              <Select value={form.client_id} onValueChange={(v) => set('client_id', v)}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Period Type</Label>
              <Select value={form.period_type} onValueChange={(v) => set('period_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Start Date</Label><Input type="date" value={form.period_start} onChange={(e) => set('period_start', e.target.value)} /></div>
              <div className="space-y-2"><Label>End Date</Label><Input type="date" value={form.period_end} onChange={(e) => set('period_end', e.target.value)} /></div>
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={form.currency} onValueChange={(v) => set('currency', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["USD","EUR","GBP","INR","AED","BDT"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => createMut.mutate(form)}><FileText className="w-4 h-4 mr-2" />Generate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}