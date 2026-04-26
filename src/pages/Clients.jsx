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
import { Plus, Pencil, Trash2, Mail } from "lucide-react";
import { toast } from "sonner";

const emptyClient = {
  name: "", contact_person: "", email: "", phone: "",
  connection_type: "SMPP", smpp_ip: "", smpp_port: 2775,
  smpp_username: "", smpp_password: "", http_url: "", http_method: "POST",
  http_params: "", dlr_url: "", query_url: "",
  billing_type: "submit", force_dlr: false, force_dlr_timeout: 30,
  status: "active", credit_limit: 0, currency: "USD", balance: 0,
  tps_limit: 100, allowed_senders: "", notes: ""
};

const BILLING_TYPE_INFO = {
  send:     {
    label: "Send Billing",
    color: "text-orange-600 bg-orange-50 border-orange-200",
    desc: "Client charged when message is accepted by the gateway (on send). If message fails to submit or returns a send error after this point, the charge still applies. Supplier is only charged on successful submit (Message ID received) — send errors are NOT charged to supplier.",
  },
  submit:   {
    label: "Submit Billing",
    color: "text-blue-600 bg-blue-50 border-blue-200",
    desc: "Client charged only when SMSC returns a Message ID (successful submit). If message fails to submit, errors on send, or is rejected — client is NOT charged. Supplier is also only charged on successful submit; any submit fail or send error means supplier is NOT charged.",
  },
  delivery: {
    label: "Delivery Billing",
    color: "text-green-600 bg-green-50 border-green-200",
    desc: "Client charged only on DELIVRD DLR. If message is undelivered, failed, or DLR is absent — client is NOT charged. Exception: if Force DLR is enabled, the synthetic DELIVRD sent to client counts as billable. Supplier is NOT charged on undelivered or failed DLR — only on successful submit.",
  },
};

export default function Clients() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [form, setForm] = useState(emptyClient);
  const qc = useQueryClient();

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list('-created_date'),
    initialData: [],
  });

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.Client.create(data),
    onSuccess: async (_, data) => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      setDialogOpen(false);
      toast.success("Client created");
      if (data.email) {
        await base44.integrations.Core.SendEmail({
          to: data.email,
          subject: "Welcome - SMS Gateway Account Created",
          body: `Dear ${data.contact_person || data.name},\n\nYour account has been created on our SMS Gateway platform.\n\nConnection Type: ${data.connection_type}\nUsername: ${data.smpp_username || 'N/A'}\n\nPlease contact support for your credentials.\n\nBest regards,\nSMS Gateway Admin`
        });
      }
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Client.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); setDialogOpen(false); toast.success("Client updated"); },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.Client.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); toast.success("Client deleted"); },
  });

  const handleSubmit = () => {
    if (editingClient) {
      updateMut.mutate({ id: editingClient.id, data: form });
    } else {
      createMut.mutate(form);
    }
  };

  const openEdit = (client) => {
    setEditingClient(client);
    setForm({ ...emptyClient, ...client });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditingClient(null);
    setForm(emptyClient);
    setDialogOpen(true);
  };

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  return (
    <div className="space-y-6">
      <PageHeader title="Clients" description="Manage client connections and accounts">
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Add Client</Button>
      </PageHeader>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Billing</TableHead>
                <TableHead>TPS</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-sm">{c.email}</TableCell>
                  <TableCell><span className="text-xs font-mono bg-muted px-2 py-1 rounded">{c.connection_type}</span></TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${BILLING_TYPE_INFO[c.billing_type || 'submit']?.color}`}>
                      {c.billing_type || 'submit'}
                      {c.force_dlr ? ' + FDLR' : ''}
                    </span>
                  </TableCell>
                  <TableCell>{c.tps_limit}</TableCell>
                  <TableCell className="font-mono">{c.currency} {c.balance?.toFixed(2)}</TableCell>
                  <TableCell><StatusBadge status={c.status} /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMut.mutate(c.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {clients.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-12">No clients yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingClient ? 'Edit Client' : 'Add New Client'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Company Name *</Label>
              <Input value={form.name} onChange={(e) => set('name', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Contact Person</Label>
              <Input value={form.contact_person} onChange={(e) => set('contact_person', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Connection Type *</Label>
              <Select value={form.connection_type} onValueChange={(v) => set('connection_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SMPP">SMPP</SelectItem>
                  <SelectItem value="HTTP">HTTP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.connection_type === 'SMPP' && (
              <>
                <div className="space-y-2"><Label>SMPP IP</Label><Input value={form.smpp_ip} onChange={(e) => set('smpp_ip', e.target.value)} placeholder="192.168.1.1" /></div>
                <div className="space-y-2"><Label>SMPP Port</Label><Input type="number" value={form.smpp_port} onChange={(e) => set('smpp_port', Number(e.target.value))} /></div>
                <div className="space-y-2"><Label>SMPP Username</Label><Input value={form.smpp_username} onChange={(e) => set('smpp_username', e.target.value)} /></div>
                <div className="space-y-2"><Label>SMPP Password</Label><Input type="password" value={form.smpp_password} onChange={(e) => set('smpp_password', e.target.value)} /></div>
              </>
            )}
            {form.connection_type === 'HTTP' && (
              <>
                <div className="space-y-2"><Label>HTTP URL</Label><Input value={form.http_url} onChange={(e) => set('http_url', e.target.value)} placeholder="https://api.example.com/sms" /></div>
                <div className="space-y-2">
                  <Label>HTTP Method</Label>
                  <Select value={form.http_method} onValueChange={(v) => set('http_method', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="GET">GET</SelectItem><SelectItem value="POST">POST</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-2"><Label>HTTP Params (JSON)</Label><Textarea value={form.http_params} onChange={(e) => set('http_params', e.target.value)} placeholder='{"to":"{{to}}","msg":"{{msg}}","from":"{{from}}"}' /></div>
                <div className="space-y-2"><Label>DLR URL</Label><Input value={form.dlr_url} onChange={(e) => set('dlr_url', e.target.value)} /></div>
                <div className="space-y-2"><Label>Query URL</Label><Input value={form.query_url} onChange={(e) => set('query_url', e.target.value)} /></div>
              </>
            )}
            <div className="space-y-2"><Label>TPS Limit</Label><Input type="number" value={form.tps_limit} onChange={(e) => set('tps_limit', Number(e.target.value))} /></div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={form.currency} onValueChange={(v) => set('currency', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["USD","EUR","GBP","INR","AED","BDT"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Credit Limit</Label><Input type="number" value={form.credit_limit} onChange={(e) => set('credit_limit', Number(e.target.value))} /></div>
            <div className="space-y-2"><Label>Balance</Label><Input type="number" value={form.balance} onChange={(e) => set('balance', Number(e.target.value))} /></div>
            <div className="col-span-2 space-y-2"><Label>Allowed Sender IDs</Label><Input value={form.allowed_senders} onChange={(e) => set('allowed_senders', e.target.value)} placeholder="SenderA, SenderB" /></div>

            {/* Billing Configuration */}
            <div className="col-span-2 space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">💰 Billing Configuration</p>
              <div className="space-y-2">
                <Label>Billing Type</Label>
                <Select value={form.billing_type || "submit"} onValueChange={(v) => set('billing_type', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="send">Send Billing — charged on gateway receipt</SelectItem>
                    <SelectItem value="submit">Submit Billing — charged on SMSC accept (Message ID)</SelectItem>
                    <SelectItem value="delivery">Delivery Billing — charged on DELIVRD DLR only</SelectItem>
                  </SelectContent>
                </Select>
                {form.billing_type && (
                  <div className={`text-xs px-3 py-2 rounded-lg border ${BILLING_TYPE_INFO[form.billing_type]?.color}`}>
                    {BILLING_TYPE_INFO[form.billing_type]?.desc}
                  </div>
                )}
              </div>

              {/* Force DLR */}
              <div className="grid grid-cols-2 gap-4 pt-1">
                <div className="space-y-2">
                  <Label>Force DLR</Label>
                  <Select value={form.force_dlr ? "yes" : "no"} onValueChange={(v) => set('force_dlr', v === "yes")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no">Disabled — send real DLR only</SelectItem>
                      <SelectItem value="yes">Enabled — force DLR to client</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Force DLR Timeout (seconds)</Label>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    disabled={!form.force_dlr}
                    value={form.force_dlr_timeout ?? 30}
                    onChange={(e) => set('force_dlr_timeout', Math.max(1, Number(e.target.value)))}
                    placeholder="e.g. 1, 5, 30, 120"
                  />
                  {form.force_dlr && (
                    <p className="text-xs text-muted-foreground">DLR sent to client <strong>{form.force_dlr_timeout}s</strong> after submission.</p>
                  )}
                </div>
              </div>
              {form.force_dlr && (
                <div className="text-xs px-3 py-2 rounded-lg border bg-yellow-50 border-yellow-200 text-yellow-700">
                  ⚠️ Force DLR is ON: a synthetic "Delivered" DLR will be sent to the client's DLR URL {form.force_dlr_timeout}s after submission, regardless of actual delivery. Client will be charged for this as a billable delivery.
                </div>
              )}

              {/* Billing Rules Summary */}
              <div className="mt-2 p-3 rounded-lg border border-slate-200 bg-white space-y-2">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">📋 Billing Rules Summary</p>
                <div className="grid grid-cols-1 gap-1.5 text-[11px]">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 text-green-600 font-bold shrink-0">CLIENT ✓</span>
                    <span className="text-slate-600">Charged on: <span className="font-semibold">{form.billing_type === 'send' ? 'gateway receive' : form.billing_type === 'submit' ? 'SMSC submit (Message ID)' : 'DELIVRD DLR received'}</span>{form.force_dlr && form.billing_type === 'delivery' ? ' or Force DLR timeout' : ''}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 text-red-500 font-bold shrink-0">CLIENT ✗</span>
                    <span className="text-slate-600">NOT charged on: <span className="font-semibold">{form.billing_type === 'send' ? 'none (always charged on send)' : form.billing_type === 'submit' ? 'submit fail, send error, rejection' : 'undelivered, failed DLR, missing DLR, submit fail'}</span></span>
                  </div>
                  <div className="border-t border-slate-100 pt-1.5 flex items-start gap-2">
                    <span className="mt-0.5 text-green-600 font-bold shrink-0">SUPPLIER ✓</span>
                    <span className="text-slate-600">Charged on: <span className="font-semibold">successful submit only (Message ID received)</span></span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 text-red-500 font-bold shrink-0">SUPPLIER ✗</span>
                    <span className="text-slate-600">NOT charged on: <span className="font-semibold">submit fail, send error, undelivered DLR, Force DLR (client-side only)</span></span>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-span-2 space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending}>
              {editingClient ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}