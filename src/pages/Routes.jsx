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
import { Plus, Pencil, Trash2, RotateCcw, ArrowRightLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function Routes() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const qc = useQueryClient();

  const { data: routes = [] } = useQuery({ queryKey: ['routes'], queryFn: () => base44.entities.Route.list('-created_date'), initialData: [] });
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list(), initialData: [] });
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: () => base44.entities.Supplier.list(), initialData: [] });
  const { data: mccmncs = [] } = useQuery({ queryKey: ['mccmnc'], queryFn: () => base44.entities.MccMnc.list(), initialData: [] });
  const { data: otpPresets = [] } = useQuery({ queryKey: ['otp-presets'], queryFn: () => base44.entities.OtpUnicodePreset.list(), initialData: [] });
  const { data: contentTemplates = [] } = useQuery({ queryKey: ['content-templates'], queryFn: () => base44.entities.ContentTemplate.list(), initialData: [] });

  const createMut = useMutation({
    mutationFn: (d) => base44.entities.Route.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['routes'] }); setDialogOpen(false); toast.success("Route created"); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Route.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['routes'] }); setDialogOpen(false); toast.success("Route updated"); },
  });
  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.Route.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['routes'] }); toast.success("Route deleted"); },
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = () => {
    const clientObj = clients.find(c => c.id === form.client_id);
    const supplierObj = suppliers.find(s => s.id === form.supplier_id);
    const backupObj = suppliers.find(s => s.id === form.backup_supplier_id);
    const deviceRerouteObj = suppliers.find(s => s.id === form.device_reroute_supplier_id);
    const mccObj = mccmncs.find(m => m.mcc === form.mcc && m.mnc === form.mnc);
    const data = {
      ...form,
      client_name: clientObj?.name || '',
      supplier_name: supplierObj?.name || '',
      backup_supplier_name: backupObj?.name || '',
      device_reroute_supplier_name: deviceRerouteObj?.name || '',
      country: mccObj?.country || form.country || '',
      network: mccObj?.network || form.network || '',
    };
    if (editing) updateMut.mutate({ id: editing.id, data });
    else createMut.mutate(data);
  };

  const unblock = (route) => {
    updateMut.mutate({ id: route.id, data: { ...route, is_auto_blocked: false, fail_count: 0, status: 'active' } });
  };

  const emptyForm = { name: '', client_id: '', supplier_id: '', backup_supplier_id: '', device_reroute_supplier_id: '', device_reroute_to: 'smpp', reroute_on_device_fail: true, mcc: '', mnc: '', prefix: '', routing_mode: 'Priority', status: 'active', auto_block_threshold: 10, otp_unicode_preset_id: '', content_template_id: '' };

  return (
    <div className="space-y-6">
      <PageHeader title="Routes" description="Manage SMS routing rules — LCR/ASR/Priority">
        <Button onClick={() => { setEditing(null); setForm(emptyForm); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />Add Route
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>MCC/MNC</TableHead>
                <TableHead>Mode</TableHead>
                    <TableHead>OTP Preset</TableHead>
                    <TableHead>Fails</TableHead>
                    <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {routes.map((r) => (
                <TableRow key={r.id} className={r.is_auto_blocked ? 'bg-red-50/50' : ''}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.client_name}</TableCell>
                  <TableCell>
                    <span>{r.supplier_name}</span>
                    {r.device_reroute_supplier_name && (
                      <p className="text-xs text-orange-600 flex items-center gap-0.5 mt-0.5">
                        <ArrowRightLeft className="w-2.5 h-2.5" />{r.device_reroute_supplier_name}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{r.mcc}/{r.mnc}</TableCell>
                  <TableCell><span className="text-xs bg-muted px-2 py-1 rounded">{r.routing_mode}</span></TableCell>
                  <TableCell>
                    {r.otp_unicode_preset_id ? (
                      <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
                        {otpPresets.find(p => p.id === r.otp_unicode_preset_id)?.name || '—'}
                      </span>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className={r.fail_count >= (r.auto_block_threshold || 10) ? 'text-red-600 font-bold' : ''}>{r.fail_count || 0}</TableCell>
                  <TableCell><StatusBadge status={r.is_auto_blocked ? 'blocked' : r.status} /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {r.is_auto_blocked && (
                        <Button variant="ghost" size="icon" onClick={() => unblock(r)} title="Unblock"><RotateCcw className="w-4 h-4 text-green-600" /></Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(r); setForm({ ...emptyForm, ...r }); setDialogOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMut.mutate(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {routes.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-12">No routes configured</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Route' : 'Add New Route'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Route Name *</Label><Input value={form.name || ''} onChange={(e) => set('name', e.target.value)} /></div>
            <div className="space-y-2">
              <Label>Routing Mode</Label>
              <Select value={form.routing_mode || 'Priority'} onValueChange={(v) => set('routing_mode', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="LCR">LCR (Least Cost)</SelectItem>
                  <SelectItem value="ASR">ASR (Answer Seizure)</SelectItem>
                  <SelectItem value="Priority">Priority</SelectItem>
                  <SelectItem value="Round Robin">Round Robin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Client *</Label>
              <Select value={form.client_id || ''} onValueChange={(v) => set('client_id', v)}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Primary Supplier *</Label>
              <Select value={form.supplier_id || ''} onValueChange={(v) => set('supplier_id', v)}>
                <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Backup Supplier</Label>
              <Select value={form.backup_supplier_id || ''} onValueChange={(v) => set('backup_supplier_id', v)}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>MCC</Label>
              <Select value={form.mcc || ''} onValueChange={(v) => set('mcc', v)}>
                <SelectTrigger><SelectValue placeholder="Select MCC" /></SelectTrigger>
                <SelectContent>{[...new Set(mccmncs.map(m => m.mcc))].map(mcc => <SelectItem key={mcc} value={mcc}>{mcc} - {mccmncs.find(m => m.mcc === mcc)?.country}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>MNC</Label>
              <Select value={form.mnc || ''} onValueChange={(v) => set('mnc', v)}>
                <SelectTrigger><SelectValue placeholder="Select MNC" /></SelectTrigger>
                <SelectContent>{mccmncs.filter(m => m.mcc === form.mcc).map(m => <SelectItem key={m.mnc} value={m.mnc}>{m.mnc} - {m.network}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Prefix</Label><Input value={form.prefix || ''} onChange={(e) => set('prefix', e.target.value)} placeholder="880,91,44" /></div>
            <div className="space-y-2"><Label>Auto Block Threshold</Label><Input type="number" value={form.auto_block_threshold || 10} onChange={(e) => set('auto_block_threshold', Number(e.target.value))} /></div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status || 'active'} onValueChange={(v) => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>OTP Unicode Preset</Label>
              <Select value={form.otp_unicode_preset_id || ''} onValueChange={(v) => set('otp_unicode_preset_id', v)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>None</SelectItem>
                  {otpPresets.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Content Template</Label>
              <Select value={form.content_template_id || ''} onValueChange={(v) => set('content_template_id', v)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>None</SelectItem>
                  {contentTemplates.filter(t => t.destination_prefix !== '__body_trans__').map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Device Reroute — shown when primary supplier is a device/android type */}
          {(() => {
            const primarySupplier = suppliers.find(s => s.id === form.supplier_id);
            const isDevice = primarySupplier && (primarySupplier.category === 'device' || primarySupplier.category === 'android');
            if (!isDevice) return null;
            return (
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg space-y-3">
                <p className="text-xs font-semibold text-orange-800 flex items-center gap-1">
                  <ArrowRightLeft className="w-3.5 h-3.5" />Device Reroute Settings — {primarySupplier.name}
                </p>
                <p className="text-xs text-orange-700">When device fails (number not on {primarySupplier.provider_type}, unregistered, or offline), automatically reroute to a fallback SMPP/HTTP/VoiceOTP supplier. Billing is DLR-only for device routes.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Reroute on Device Fail</Label>
                    <Select value={form.reroute_on_device_fail ? 'yes' : 'no'} onValueChange={v => set('reroute_on_device_fail', v === 'yes')}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes — reroute to fallback</SelectItem>
                        <SelectItem value="no">No — mark as failed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Fallback Type</Label>
                    <Select value={form.device_reroute_to || 'smpp'} onValueChange={v => set('device_reroute_to', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="smpp">SMPP Supplier</SelectItem>
                        <SelectItem value="http">HTTP API Supplier</SelectItem>
                        <SelectItem value="voice_otp">Voice OTP</SelectItem>
                        <SelectItem value="none">None</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.reroute_on_device_fail && form.device_reroute_to !== 'none' && (
                    <div className="col-span-2 space-y-1.5">
                      <Label className="text-xs">Fallback Supplier</Label>
                      <Select value={form.device_reroute_supplier_id || ''} onValueChange={v => set('device_reroute_supplier_id', v)}>
                        <SelectTrigger><SelectValue placeholder="Select fallback supplier..." /></SelectTrigger>
                        <SelectContent>
                          {suppliers.filter(s => s.category === 'sms' || s.category === 'voice_otp').map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.name} ({s.connection_type})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit}>{editing ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}