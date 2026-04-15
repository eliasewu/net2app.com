import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Search, Upload } from "lucide-react";
import { toast } from "sonner";

export default function MccMncPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ mcc: '', mnc: '', country: '', network: '', prefix: '', iso: '' });
  const [search, setSearch] = useState('');
  const qc = useQueryClient();

  const { data: mccmncs = [] } = useQuery({
    queryKey: ['mccmnc'],
    queryFn: () => base44.entities.MccMnc.list('-country', 200),
    initialData: [],
  });

  const createMut = useMutation({
    mutationFn: (d) => base44.entities.MccMnc.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['mccmnc'] }); setDialogOpen(false); toast.success("MCC/MNC added"); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.MccMnc.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['mccmnc'] }); setDialogOpen(false); toast.success("Updated"); },
  });
  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.MccMnc.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['mccmnc'] }); toast.success("Deleted"); },
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const filtered = mccmncs.filter(m =>
    m.country?.toLowerCase().includes(search.toLowerCase()) ||
    m.network?.toLowerCase().includes(search.toLowerCase()) ||
    m.mcc?.includes(search) || m.mnc?.includes(search)
  );

  const preloadMccMnc = async () => {
    toast.info("Loading common MCC/MNC data...");
    const commonData = [
      { mcc: "310", mnc: "410", country: "United States", network: "AT&T", prefix: "1", iso: "US" },
      { mcc: "310", mnc: "260", country: "United States", network: "T-Mobile", prefix: "1", iso: "US" },
      { mcc: "311", mnc: "480", country: "United States", network: "Verizon", prefix: "1", iso: "US" },
      { mcc: "234", mnc: "10", country: "United Kingdom", network: "O2", prefix: "44", iso: "GB" },
      { mcc: "234", mnc: "15", country: "United Kingdom", network: "Vodafone", prefix: "44", iso: "GB" },
      { mcc: "234", mnc: "30", country: "United Kingdom", network: "EE", prefix: "44", iso: "GB" },
      { mcc: "262", mnc: "01", country: "Germany", network: "T-Mobile", prefix: "49", iso: "DE" },
      { mcc: "262", mnc: "02", country: "Germany", network: "Vodafone", prefix: "49", iso: "DE" },
      { mcc: "208", mnc: "01", country: "France", network: "Orange", prefix: "33", iso: "FR" },
      { mcc: "208", mnc: "10", country: "France", network: "SFR", prefix: "33", iso: "FR" },
      { mcc: "404", mnc: "10", country: "India", network: "AirTel", prefix: "91", iso: "IN" },
      { mcc: "404", mnc: "45", country: "India", network: "AirTel", prefix: "91", iso: "IN" },
      { mcc: "404", mnc: "86", country: "India", network: "Vodafone", prefix: "91", iso: "IN" },
      { mcc: "405", mnc: "854", country: "India", network: "Jio", prefix: "91", iso: "IN" },
      { mcc: "470", mnc: "01", country: "Bangladesh", network: "Grameenphone", prefix: "880", iso: "BD" },
      { mcc: "470", mnc: "02", country: "Bangladesh", network: "Robi", prefix: "880", iso: "BD" },
      { mcc: "470", mnc: "03", country: "Bangladesh", network: "Banglalink", prefix: "880", iso: "BD" },
      { mcc: "424", mnc: "02", country: "UAE", network: "Etisalat", prefix: "971", iso: "AE" },
      { mcc: "424", mnc: "03", country: "UAE", network: "Du", prefix: "971", iso: "AE" },
      { mcc: "502", mnc: "12", country: "Malaysia", network: "Maxis", prefix: "60", iso: "MY" },
      { mcc: "520", mnc: "01", country: "Thailand", network: "AIS", prefix: "66", iso: "TH" },
      { mcc: "515", mnc: "02", country: "Philippines", network: "Globe", prefix: "63", iso: "PH" },
      { mcc: "525", mnc: "01", country: "Singapore", network: "SingTel", prefix: "65", iso: "SG" },
      { mcc: "460", mnc: "00", country: "China", network: "China Mobile", prefix: "86", iso: "CN" },
      { mcc: "440", mnc: "10", country: "Japan", network: "NTT Docomo", prefix: "81", iso: "JP" },
    ];
    await base44.entities.MccMnc.bulkCreate(commonData);
    qc.invalidateQueries({ queryKey: ['mccmnc'] });
    toast.success(`Loaded ${commonData.length} MCC/MNC records`);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="MCC/MNC Database" description="Mobile country and network codes">
        <Button variant="outline" onClick={preloadMccMnc}><Upload className="w-4 h-4 mr-2" />Preload Common</Button>
        <Button onClick={() => { setEditing(null); setForm({ mcc: '', mnc: '', country: '', network: '', prefix: '', iso: '' }); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />Add Entry
        </Button>
      </PageHeader>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search country, network, MCC..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>MCC</TableHead>
                <TableHead>MNC</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Network</TableHead>
                <TableHead>Prefix</TableHead>
                <TableHead>ISO</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono">{m.mcc}</TableCell>
                  <TableCell className="font-mono">{m.mnc}</TableCell>
                  <TableCell>{m.country}</TableCell>
                  <TableCell>{m.network}</TableCell>
                  <TableCell className="font-mono">{m.prefix}</TableCell>
                  <TableCell>{m.iso}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(m); setForm(m); setDialogOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMut.mutate(m.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-12">{mccmncs.length === 0 ? 'No data. Click "Preload Common" to load default MCC/MNC data.' : 'No matching results'}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit MCC/MNC' : 'Add MCC/MNC'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>MCC *</Label><Input value={form.mcc} onChange={(e) => set('mcc', e.target.value)} /></div>
            <div className="space-y-2"><Label>MNC *</Label><Input value={form.mnc} onChange={(e) => set('mnc', e.target.value)} /></div>
            <div className="space-y-2"><Label>Country *</Label><Input value={form.country} onChange={(e) => set('country', e.target.value)} /></div>
            <div className="space-y-2"><Label>Network *</Label><Input value={form.network} onChange={(e) => set('network', e.target.value)} /></div>
            <div className="space-y-2"><Label>Prefix</Label><Input value={form.prefix} onChange={(e) => set('prefix', e.target.value)} /></div>
            <div className="space-y-2"><Label>ISO Code</Label><Input value={form.iso} onChange={(e) => set('iso', e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => { if (editing) updateMut.mutate({ id: editing.id, data: form }); else createMut.mutate(form); }}>
              {editing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}