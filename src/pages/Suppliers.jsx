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
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const emptySupplier = {
  name: "", contact_person: "", email: "", phone: "",
  connection_type: "SMPP", smpp_ip: "", smpp_port: 2775,
  smpp_username: "", smpp_password: "", http_url: "", http_method: "POST",
  http_params: "", dlr_url: "", status: "active", priority: 1, tps_limit: 100, notes: ""
};

export default function Suppliers() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptySupplier);
  const qc = useQueryClient();

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => base44.entities.Supplier.list('-created_date'),
    initialData: [],
  });

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.Supplier.create(data),
    onSuccess: async (_, data) => {
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      setDialogOpen(false);
      toast.success("Supplier created");
      if (data.email) {
        await base44.integrations.Core.SendEmail({
          to: data.email, subject: "SMS Gateway - Supplier Account Created",
          body: `Dear ${data.contact_person || data.name},\n\nYour supplier account has been created.\nConnection: ${data.connection_type}\n\nRegards,\nSMS Gateway Admin`
        });
      }
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Supplier.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); setDialogOpen(false); toast.success("Supplier updated"); },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.Supplier.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); toast.success("Supplier deleted"); },
  });

  const handleSubmit = () => {
    if (editing) updateMut.mutate({ id: editing.id, data: form });
    else createMut.mutate(form);
  };

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-6">
      <PageHeader title="Suppliers" description="Manage upstream SMS suppliers">
        <Button onClick={() => { setEditing(null); setForm(emptySupplier); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />Add Supplier
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>TPS</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-sm">{s.email}</TableCell>
                  <TableCell><span className="text-xs font-mono bg-muted px-2 py-1 rounded">{s.connection_type}</span></TableCell>
                  <TableCell>{s.priority}</TableCell>
                  <TableCell>{s.tps_limit}</TableCell>
                  <TableCell><StatusBadge status={s.status} /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(s); setForm({ ...emptySupplier, ...s }); setDialogOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMut.mutate(s.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {suppliers.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-12">No suppliers yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Supplier' : 'Add New Supplier'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => set('name', e.target.value)} /></div>
            <div className="space-y-2"><Label>Contact Person</Label><Input value={form.contact_person} onChange={(e) => set('contact_person', e.target.value)} /></div>
            <div className="space-y-2"><Label>Email *</Label><Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></div>
            <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => set('phone', e.target.value)} /></div>
            <div className="space-y-2">
              <Label>Connection Type</Label>
              <Select value={form.connection_type} onValueChange={(v) => set('connection_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="SMPP">SMPP</SelectItem><SelectItem value="HTTP">HTTP</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="blocked">Blocked</SelectItem></SelectContent>
              </Select>
            </div>
            {form.connection_type === 'SMPP' && (
              <>
                <div className="space-y-2"><Label>SMPP IP</Label><Input value={form.smpp_ip} onChange={(e) => set('smpp_ip', e.target.value)} /></div>
                <div className="space-y-2"><Label>SMPP Port</Label><Input type="number" value={form.smpp_port} onChange={(e) => set('smpp_port', Number(e.target.value))} /></div>
                <div className="space-y-2"><Label>Username</Label><Input value={form.smpp_username} onChange={(e) => set('smpp_username', e.target.value)} /></div>
                <div className="space-y-2"><Label>Password</Label><Input type="password" value={form.smpp_password} onChange={(e) => set('smpp_password', e.target.value)} /></div>
              </>
            )}
            {form.connection_type === 'HTTP' && (
              <>
                <div className="space-y-2"><Label>HTTP URL</Label><Input value={form.http_url} onChange={(e) => set('http_url', e.target.value)} /></div>
                <div className="space-y-2"><Label>Method</Label><Select value={form.http_method} onValueChange={(v) => set('http_method', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="GET">GET</SelectItem><SelectItem value="POST">POST</SelectItem></SelectContent></Select></div>
                <div className="col-span-2 space-y-2"><Label>HTTP Params</Label><Textarea value={form.http_params} onChange={(e) => set('http_params', e.target.value)} /></div>
                <div className="col-span-2 space-y-2"><Label>DLR URL</Label><Input value={form.dlr_url} onChange={(e) => set('dlr_url', e.target.value)} /></div>
              </>
            )}
            <div className="space-y-2"><Label>Priority</Label><Input type="number" value={form.priority} onChange={(e) => set('priority', Number(e.target.value))} /></div>
            <div className="space-y-2"><Label>TPS Limit</Label><Input type="number" value={form.tps_limit} onChange={(e) => set('tps_limit', Number(e.target.value))} /></div>
            <div className="col-span-2 space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit}>{editing ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}