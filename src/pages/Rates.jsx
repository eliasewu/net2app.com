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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function Rates() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [tab, setTab] = useState("client");
  const qc = useQueryClient();

  const { data: rates = [] } = useQuery({ queryKey: ['rates'], queryFn: () => base44.entities.Rate.list('-created_date'), initialData: [] });
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list(), initialData: [] });
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: () => base44.entities.Supplier.list(), initialData: [] });
  const { data: mccmncs = [] } = useQuery({ queryKey: ['mccmnc'], queryFn: () => base44.entities.MccMnc.list(), initialData: [] });

  const createMut = useMutation({
    mutationFn: (d) => base44.entities.Rate.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rates'] }); setDialogOpen(false); toast.success("Rate added"); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Rate.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rates'] }); setDialogOpen(false); toast.success("Rate updated"); },
  });
  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.Rate.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rates'] }); toast.success("Rate deleted"); },
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleMccChange = (mcc) => {
    const m = mccmncs.find(x => x.mcc === mcc);
    set('mcc', mcc);
    setForm(p => ({ ...p, mcc, country: m?.country || '', mnc: '', network: '' }));
  };

  const handleMncChange = (mnc) => {
    const m = mccmncs.find(x => x.mcc === form.mcc && x.mnc === mnc);
    setForm(p => ({ ...p, mnc, network: m?.network || '', prefix: m?.prefix || '' }));
  };

  const handleSubmit = () => {
    const entityList = form.type === 'client' ? clients : suppliers;
    const entity = entityList.find(e => e.id === form.entity_id);
    const data = { ...form, entity_name: entity?.name || '' };
    if (editing) updateMut.mutate({ id: editing.id, data });
    else createMut.mutate(data);
  };

  const emptyForm = (type) => ({ type, entity_id: '', mcc: '', mnc: '', country: '', network: '', prefix: '', rate: 0, currency: 'USD', status: 'active' });

  const filteredRates = rates.filter(r => r.type === tab);

  return (
    <div className="space-y-6">
      <PageHeader title="Rates" description="Manage MCC/MNC based rates for clients and suppliers">
        <Button onClick={() => { setEditing(null); setForm(emptyForm(tab)); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />Add Rate
        </Button>
      </PageHeader>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="client">Client Rates</TabsTrigger>
          <TabsTrigger value="supplier">Supplier Rates</TabsTrigger>
        </TabsList>

        <TabsContent value={tab}>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tab === 'client' ? 'Client' : 'Supplier'}</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Network</TableHead>
                    <TableHead>MCC/MNC</TableHead>
                    <TableHead>Prefix</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRates.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.entity_name}</TableCell>
                      <TableCell>{r.country}</TableCell>
                      <TableCell>{r.network}</TableCell>
                      <TableCell className="font-mono text-sm">{r.mcc}/{r.mnc}</TableCell>
                      <TableCell className="font-mono text-sm">{r.prefix}</TableCell>
                      <TableCell className="font-mono font-medium">{r.currency} {r.rate?.toFixed(4)}</TableCell>
                      <TableCell><StatusBadge status={r.status} /></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => { setEditing(r); setForm({ ...emptyForm(r.type), ...r }); setDialogOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteMut.mutate(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredRates.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-12">No rates configured</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Edit Rate' : 'Add Rate'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.type || 'client'} onValueChange={(v) => set('type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="client">Client</SelectItem><SelectItem value="supplier">Supplier</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{form.type === 'client' ? 'Client' : 'Supplier'}</Label>
              <Select value={form.entity_id || ''} onValueChange={(v) => set('entity_id', v)}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>{(form.type === 'client' ? clients : suppliers).map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>MCC (Country)</Label>
              <Select value={form.mcc || ''} onValueChange={handleMccChange}>
                <SelectTrigger><SelectValue placeholder="Select MCC" /></SelectTrigger>
                <SelectContent>{[...new Map(mccmncs.map(m => [m.mcc, m])).values()].map(m => <SelectItem key={m.mcc} value={m.mcc}>{m.mcc} - {m.country}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>MNC (Network)</Label>
              <Select value={form.mnc || ''} onValueChange={handleMncChange}>
                <SelectTrigger><SelectValue placeholder="Select MNC" /></SelectTrigger>
                <SelectContent>{mccmncs.filter(m => m.mcc === form.mcc).map(m => <SelectItem key={m.mnc} value={m.mnc}>{m.mnc} - {m.network}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Rate</Label><Input type="number" step="0.0001" value={form.rate || ''} onChange={(e) => set('rate', parseFloat(e.target.value))} /></div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={form.currency || 'USD'} onValueChange={(v) => set('currency', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["USD","EUR","GBP","INR","AED","BDT"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
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