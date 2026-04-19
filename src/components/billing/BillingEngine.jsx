import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle, Send, FileText, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function BillingEngine() {
  const [tab, setTab] = useState("overview");
  const [invoiceDialog, setInvoiceDialog] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [genLoading, setGenLoading] = useState(false);
  const [invForm, setInvForm] = useState({ period_type: 'monthly', period_start: '', period_end: '', currency: 'USD', notes: '', include_voice: false, include_sms: true });
  const qc = useQueryClient();

  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list(), initialData: [] });
  const { data: smsLogs = [] } = useQuery({ queryKey: ['sms-logs-billing'], queryFn: () => base44.entities.SmsLog.list('-created_date', 500), initialData: [] });
  const { data: invoices = [] } = useQuery({ queryKey: ['invoices'], queryFn: () => base44.entities.Invoice.list('-created_date'), initialData: [] });
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: () => base44.entities.Supplier.list(), initialData: [] });

  const createInvoiceMut = useMutation({
    mutationFn: d => base44.entities.Invoice.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); setInvoiceDialog(false); toast.success("Invoice generated!"); }
  });

  const updateClientMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Client.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); toast.success("Balance updated"); }
  });

  const setInv = (k, v) => setInvForm(p => ({ ...p, [k]: v }));

  // ── Financial calculations ────────────────────────────────────────────────
  const clientStats = clients.map(c => {
    const logs = smsLogs.filter(l => l.client_id === c.id);
    const revenue = logs.reduce((s, l) => s + (l.sell_rate || 0), 0);
    const cost = logs.reduce((s, l) => s + (l.cost || 0), 0);
    const margin = revenue - cost;
    const delivered = logs.filter(l => l.status === 'delivered').length;
    const failed = logs.filter(l => l.status === 'failed').length;
    const balance = c.balance || 0;
    const creditLimit = c.credit_limit || 0;
    const isLow = creditLimit > 0 && balance < creditLimit * 0.1;
    const isExceeded = creditLimit > 0 && balance < 0;
    return { ...c, logs: logs.length, revenue, cost, margin, delivered, failed, isLow, isExceeded };
  });

  const totalRevenue = clientStats.reduce((s, c) => s + c.revenue, 0);
  const totalCost = clientStats.reduce((s, c) => s + c.cost, 0);

  const supplierStats = suppliers.map(s => {
    const logs = smsLogs.filter(l => l.supplier_id === s.id);
    const cost = logs.reduce((sum, l) => sum + (l.cost || 0), 0);
    return { ...s, sent: logs.length, cost };
  });

  const openInvoice = (client) => {
    setSelectedClient(client);
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const end = now.toISOString().split('T')[0];
    setInvForm(p => ({ ...p, period_start: start, period_end: end }));
    setInvoiceDialog(true);
  };

  const generateInvoice = async () => {
    if (!selectedClient) return;
    setGenLoading(true);
    const periodLogs = smsLogs.filter(l => l.client_id === selectedClient.id &&
      l.created_date >= invForm.period_start && l.created_date <= invForm.period_end);
    const totalSms = periodLogs.length;
    const totalAmount = periodLogs.reduce((s, l) => s + (l.sell_rate || 0), 0);
    const destBreakdown = {};
    periodLogs.forEach(l => {
      const key = l.country || 'Unknown';
      if (!destBreakdown[key]) destBreakdown[key] = { count: 0, amount: 0 };
      destBreakdown[key].count++;
      destBreakdown[key].amount += (l.sell_rate || 0);
    });
    const invNum = `INV-${Date.now().toString(36).toUpperCase()}`;
    await createInvoiceMut.mutateAsync({
      invoice_number: invNum,
      client_id: selectedClient.id,
      client_name: selectedClient.name,
      period_start: invForm.period_start,
      period_end: invForm.period_end,
      period_type: invForm.period_type,
      currency: invForm.currency,
      total_sms: totalSms,
      total_amount: totalAmount,
      notes: invForm.notes,
      status: 'draft',
      breakdown: JSON.stringify(destBreakdown)
    });
    setGenLoading(false);
  };

  const sendInvoice = async (inv) => {
    const client = clients.find(c => c.id === inv.client_id);
    if (!client?.email) { toast.error("Client email not set"); return; }
    let breakdown = '';
    try {
      const bd = JSON.parse(inv.breakdown || '{}');
      breakdown = Object.entries(bd).map(([dest, d]) => `  ${dest}: ${d.count} SMS — ${inv.currency} ${d.amount.toFixed(4)}`).join('\n');
    } catch {}
    await base44.integrations.Core.SendEmail({
      to: client.email,
      subject: `Invoice ${inv.invoice_number} — ${inv.period_start} to ${inv.period_end}`,
      body: `Dear ${client.name},\n\nPlease find your invoice details below:\n\nInvoice Number: ${inv.invoice_number}\nPeriod: ${inv.period_start} to ${inv.period_end}\nTotal SMS: ${inv.total_sms}\nTotal Amount: ${inv.currency} ${inv.total_amount?.toFixed(2)}\n\nBreakdown by Destination:\n${breakdown}\n\nPlease arrange payment at your earliest convenience.\n\nBest regards,\nNet2app Gateway Admin`
    });
    await base44.entities.Invoice.update(inv.id, { status: 'sent' });
    qc.invalidateQueries({ queryKey: ['invoices'] });
    toast.success(`Invoice sent to ${client.email}`);
  };

  const adjustBalance = (client, amount) => {
    updateClientMut.mutate({ id: client.id, data: { balance: (client.balance || 0) + amount } });
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Revenue", value: `$${totalRevenue.toFixed(2)}`, icon: TrendingUp, color: "text-green-600 bg-green-50 border-green-200" },
          { label: "Total Cost", value: `$${totalCost.toFixed(2)}`, icon: TrendingDown, color: "text-red-600 bg-red-50 border-red-200" },
          { label: "Net Margin", value: `$${(totalRevenue - totalCost).toFixed(2)}`, icon: DollarSign, color: "text-blue-600 bg-blue-50 border-blue-200" },
          { label: "Low Balance Alerts", value: clientStats.filter(c => c.isLow).length, icon: AlertTriangle, color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg border ${s.color}`}><s.icon className="w-4 h-4" /></div>
              <div><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-xl font-bold">{s.value}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Client Billing</TabsTrigger>
          <TabsTrigger value="suppliers">Supplier Costs</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>SMS Sent</TableHead>
                    <TableHead>Revenue</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Margin</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Credit Limit</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientStats.map(c => (
                    <TableRow key={c.id} className={c.isExceeded ? 'bg-red-50' : c.isLow ? 'bg-yellow-50' : ''}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{c.name}</p>
                          {c.isExceeded && <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300 text-[10px]">Credit Exceeded!</Badge>}
                          {c.isLow && !c.isExceeded && <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300 text-[10px]">Low Balance</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>{c.logs}</TableCell>
                      <TableCell className="font-mono text-green-700">{c.currency || 'USD'} {c.revenue.toFixed(4)}</TableCell>
                      <TableCell className="font-mono text-red-600">{c.currency || 'USD'} {c.cost.toFixed(4)}</TableCell>
                      <TableCell className={`font-mono font-bold ${c.margin >= 0 ? 'text-green-700' : 'text-red-600'}`}>{c.currency || 'USD'} {c.margin.toFixed(4)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className={`font-mono text-sm ${(c.balance || 0) < 0 ? 'text-red-600 font-bold' : ''}`}>{c.currency || 'USD'} {(c.balance || 0).toFixed(2)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{c.currency || 'USD'} {c.credit_limit || 0}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => adjustBalance(c, 100)}>+100</Button>
                          <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => openInvoice(c)}>
                            <FileText className="w-3 h-3 mr-1" />Invoice
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {clientStats.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No clients</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suppliers" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>SMS Routed</TableHead>
                    <TableHead>Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplierStats.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{s.connection_type || 'HTTP'}</Badge></TableCell>
                      <TableCell>{s.sent}</TableCell>
                      <TableCell className="font-mono text-red-600">USD {s.cost.toFixed(4)}</TableCell>
                    </TableRow>
                  ))}
                  {supplierStats.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No suppliers</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>SMS</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map(inv => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-xs font-bold">{inv.invoice_number}</TableCell>
                      <TableCell>{inv.client_name}</TableCell>
                      <TableCell className="text-xs">{inv.period_start} → {inv.period_end}</TableCell>
                      <TableCell>{inv.total_sms}</TableCell>
                      <TableCell className="font-mono font-semibold">{inv.currency} {inv.total_amount?.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          inv.status === 'paid' ? 'bg-green-50 text-green-700 border-green-200' :
                          inv.status === 'sent' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          inv.status === 'overdue' ? 'bg-red-50 text-red-700 border-red-200' :
                          'bg-gray-50 text-gray-700 border-gray-200'
                        }>{inv.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {inv.status === 'draft' && (
                          <Button size="sm" variant="ghost" onClick={() => sendInvoice(inv)} className="gap-1 text-xs">
                            <Send className="w-3 h-3" />Send Email
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {invoices.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No invoices yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Invoice Dialog */}
      <Dialog open={invoiceDialog} onOpenChange={setInvoiceDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Generate Invoice — {selectedClient?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Period Type</Label>
                <Select value={invForm.period_type} onValueChange={v => setInv('period_type', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Select value={invForm.currency} onValueChange={v => setInv('currency', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["USD","EUR","GBP","INR","AED","BDT"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Start Date</Label><Input type="date" value={invForm.period_start} onChange={e => setInv('period_start', e.target.value)} /></div>
              <div className="space-y-1.5"><Label>End Date</Label><Input type="date" value={invForm.period_end} onChange={e => setInv('period_end', e.target.value)} /></div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="inc_sms" checked={invForm.include_sms} onChange={e => setInv('include_sms', e.target.checked)} />
              <Label htmlFor="inc_sms">Include SMS Traffic</Label>
              <input type="checkbox" id="inc_voice" checked={invForm.include_voice} onChange={e => setInv('include_voice', e.target.checked)} className="ml-4" />
              <Label htmlFor="inc_voice">Include Voice Traffic</Label>
            </div>
            <div className="space-y-1.5"><Label>Notes</Label><Textarea value={invForm.notes} onChange={e => setInv('notes', e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInvoiceDialog(false)}>Cancel</Button>
            <Button onClick={generateInvoice} disabled={genLoading}>
              {genLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileText className="w-4 h-4 mr-2" />}
              Generate & Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}