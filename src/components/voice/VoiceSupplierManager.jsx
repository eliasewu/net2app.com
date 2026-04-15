import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import StatusBadge from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Globe, Clock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function VoiceSupplierManager() {
  const [tab, setTab] = useState("suppliers");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [rateDialogOpen, setRateDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", sip_host: "", sip_port: 5060, sip_username: "", sip_password: "", caller_id: "", primary_language_folder_id: "", secondary_language_folder_id: "", play_count: 2, mcc: "", mnc: "", country: "", network: "", tps_limit: 10, status: "active", priority: 1, notes: "" });
  const [rateForm, setRateForm] = useState({ entity_id: "", mcc: "", mnc: "", country: "", network: "", prefix: "", rate: "", currency: "USD", active_from: "", active_until: "" });
  const qc = useQueryClient();

  const { data: suppliers = [] } = useQuery({ queryKey: ["voice-suppliers"], queryFn: () => base44.entities.VoiceSupplier.list("-created_date"), initialData: [] });
  const { data: folders = [] } = useQuery({ queryKey: ["voice-folders"], queryFn: () => base44.entities.VoiceAudioFolder.list(), initialData: [] });
  const { data: mccmncs = [] } = useQuery({ queryKey: ["mccmnc"], queryFn: () => base44.entities.MccMnc.list("-country", 500), initialData: [] });
  const { data: rates = [] } = useQuery({ queryKey: ["rates"], queryFn: () => base44.entities.Rate.list("-created_date", 200), initialData: [] });

  const createMut = useMutation({ mutationFn: d => base44.entities.VoiceSupplier.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["voice-suppliers"] }); setDialogOpen(false); toast.success("Voice supplier added"); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }) => base44.entities.VoiceSupplier.update(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ["voice-suppliers"] }); setDialogOpen(false); toast.success("Updated"); } });
  const deleteMut = useMutation({ mutationFn: id => base44.entities.VoiceSupplier.delete(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ["voice-suppliers"] }); toast.success("Deleted"); } });

  const createRate = useMutation({
    mutationFn: async (d) => {
      // Deactivate existing rates for same entity+mcc+mnc
      const existing = rates.filter(r => r.type === "voice" && r.entity_id === d.entity_id && r.mcc === d.mcc && r.mnc === d.mnc && r.status === "active");
      for (const old of existing) {
        await base44.entities.Rate.update(old.id, { status: "inactive", superseded_by: "pending" });
      }
      const newRate = await base44.entities.Rate.create({ ...d, type: "voice", status: d.active_from ? "scheduled" : "active", version: (existing[0]?.version || 0) + 1 });
      // update superseded_by references
      for (const old of existing) {
        await base44.entities.Rate.update(old.id, { superseded_by: newRate.id });
      }
      return newRate;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rates"] }); setRateDialogOpen(false); toast.success("Rate added — old rate deactivated"); }
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const setRF = (k, v) => setRateForm(p => ({ ...p, [k]: v }));

  const voiceRates = rates.filter(r => r.type === "voice");
  const englishFolder = folders.find(f => f.is_default_english);

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="suppliers">Voice Suppliers (SIP)</TabsTrigger>
            <TabsTrigger value="rates">Voice Rates</TabsTrigger>
          </TabsList>
          {tab === "suppliers" ? (
            <Button size="sm" onClick={() => { setEditing(null); setForm({ name: "", sip_host: "", sip_port: 5060, sip_username: "", sip_password: "", caller_id: "", primary_language_folder_id: "", secondary_language_folder_id: englishFolder?.id || "", play_count: 2, mcc: "", mnc: "", country: "", network: "", tps_limit: 10, status: "active", priority: 1, notes: "" }); setDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" />Add Voice Supplier
            </Button>
          ) : (
            <Button size="sm" onClick={() => { setRateForm({ entity_id: "", entity_name: "", mcc: "", mnc: "", country: "", network: "", prefix: "", rate: "", currency: "USD", active_from: "", active_until: "" }); setRateDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" />Add Rate
            </Button>
          )}
        </div>

        <TabsContent value="suppliers" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>SIP Host</TableHead>
                    <TableHead>Caller ID</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Primary Lang</TableHead>
                    <TableHead>Secondary Lang</TableHead>
                    <TableHead>Play×</TableHead>
                    <TableHead>TPS</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map(s => {
                    const primaryFolder = folders.find(f => f.id === s.primary_language_folder_id);
                    const secondaryFolder = folders.find(f => f.id === s.secondary_language_folder_id);
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell className="font-mono text-sm">{s.sip_host}:{s.sip_port}</TableCell>
                        <TableCell className="font-mono text-sm">{s.caller_id}</TableCell>
                        <TableCell>{s.country || "—"}</TableCell>
                        <TableCell>
                          {primaryFolder ? <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">{primaryFolder.name}</Badge> : <span className="text-muted-foreground text-xs italic">not set</span>}
                        </TableCell>
                        <TableCell>
                          {secondaryFolder ? <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200"><Globe className="w-2.5 h-2.5 mr-1" />{secondaryFolder.name}</Badge> : <span className="text-muted-foreground text-xs italic">not set</span>}
                        </TableCell>
                        <TableCell>{s.play_count}×</TableCell>
                        <TableCell>{s.tps_limit}</TableCell>
                        <TableCell>{s.priority}</TableCell>
                        <TableCell><StatusBadge status={s.status} /></TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => { setEditing(s); setForm({ ...s }); setDialogOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteMut.mutate(s.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {suppliers.length === 0 && <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-12">No voice suppliers yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rates" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-muted border-b">
                    <th className="p-3 text-left font-semibold">Supplier</th>
                    <th className="p-3 text-left font-semibold">Country</th>
                    <th className="p-3 text-left font-semibold">Network</th>
                    <th className="p-3 text-left font-semibold">MCC/MNC</th>
                    <th className="p-3 text-left font-semibold">Rate</th>
                    <th className="p-3 text-left font-semibold">Active From</th>
                    <th className="p-3 text-left font-semibold">Active Until</th>
                    <th className="p-3 text-left font-semibold">Version</th>
                    <th className="p-3 text-left font-semibold">Status</th>
                    <th className="p-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {voiceRates.map((r, i) => (
                    <tr key={r.id} className={`border-b hover:bg-accent/30 ${i % 2 !== 0 ? "bg-muted/20" : ""} ${r.status === "inactive" ? "opacity-50" : ""}`}>
                      <td className="p-3 font-medium">{r.entity_name}</td>
                      <td className="p-3">{r.country}</td>
                      <td className="p-3">{r.network}</td>
                      <td className="p-3 font-mono text-xs">{r.mcc}/{r.mnc}</td>
                      <td className="p-3 font-mono font-bold text-green-700">{r.currency} {r.rate?.toFixed(5)}</td>
                      <td className="p-3 text-xs">{r.active_from ? format(new Date(r.active_from), "MMM d HH:mm") : <span className="text-muted-foreground">Immediate</span>}</td>
                      <td className="p-3 text-xs">{r.active_until ? format(new Date(r.active_until), "MMM d HH:mm") : <span className="text-muted-foreground">—</span>}</td>
                      <td className="p-3"><Badge variant="outline" className="text-xs">v{r.version || 1}</Badge></td>
                      <td className="p-3">
                        <StatusBadge status={r.status} />
                        {r.status === "scheduled" && <Clock className="w-3 h-3 inline ml-1 text-yellow-500" />}
                      </td>
                      <td className="p-3 text-right">
                        <Button variant="ghost" size="icon" onClick={() => deleteMut.mutate(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </td>
                    </tr>
                  ))}
                  {voiceRates.length === 0 && <tr><td colSpan={10} className="text-center text-muted-foreground py-12">No voice rates configured</td></tr>}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Voice Supplier Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Voice Supplier" : "Add Voice Supplier (SIP)"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1 col-span-2"><Label>Name *</Label><Input value={form.name} onChange={e => set("name", e.target.value)} /></div>
            <div className="space-y-1"><Label>SIP Host</Label><Input value={form.sip_host} onChange={e => set("sip_host", e.target.value)} placeholder="sip.provider.com" /></div>
            <div className="space-y-1"><Label>SIP Port</Label><Input type="number" value={form.sip_port} onChange={e => set("sip_port", Number(e.target.value))} /></div>
            <div className="space-y-1"><Label>SIP Username</Label><Input value={form.sip_username} onChange={e => set("sip_username", e.target.value)} /></div>
            <div className="space-y-1"><Label>SIP Password</Label><Input type="password" value={form.sip_password} onChange={e => set("sip_password", e.target.value)} /></div>
            <div className="space-y-1"><Label>Caller ID</Label><Input value={form.caller_id} onChange={e => set("caller_id", e.target.value)} placeholder="+12125551234" /></div>
            <div className="space-y-1"><Label>Play Count</Label><Input type="number" min={1} max={5} value={form.play_count} onChange={e => set("play_count", Number(e.target.value))} /></div>

            <div className="space-y-1 col-span-2 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="text-xs font-semibold text-yellow-800 mb-2">🔊 Language Audio Configuration</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Primary Language (local) Folder</Label>
                  <Select value={form.primary_language_folder_id} onValueChange={v => set("primary_language_folder_id", v)}>
                    <SelectTrigger><SelectValue placeholder="Select language folder" /></SelectTrigger>
                    <SelectContent>{folders.map(f => <SelectItem key={f.id} value={f.id}>{f.name} ({f.language_code})</SelectItem>)}</SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Played first in destination's local language</p>
                </div>
                <div className="space-y-1">
                  <Label>Secondary Language (English) Folder</Label>
                  <Select value={form.secondary_language_folder_id} onValueChange={v => set("secondary_language_folder_id", v)}>
                    <SelectTrigger><SelectValue placeholder="Select English folder" /></SelectTrigger>
                    <SelectContent>{folders.map(f => <SelectItem key={f.id} value={f.id}>{f.name} ({f.language_code}){f.is_default_english ? " ★" : ""}</SelectItem>)}</SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Played second in English for all destinations</p>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label>MCC (Country scope)</Label>
              <Select value={form.mcc} onValueChange={v => { const m = mccmncs.find(x => x.mcc === v); set("mcc", v); if (m) set("country", m.country); }}>
                <SelectTrigger><SelectValue placeholder="All (global)" /></SelectTrigger>
                <SelectContent>{[...new Map(mccmncs.map(m => [m.mcc, m])).values()].map(m => <SelectItem key={m.mcc} value={m.mcc}>{m.mcc} — {m.country}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>MNC</Label>
              <Select value={form.mnc} onValueChange={v => { const m = mccmncs.find(x => x.mcc === form.mcc && x.mnc === v); set("mnc", v); if (m) set("network", m.network); }}>
                <SelectTrigger><SelectValue placeholder="Any network" /></SelectTrigger>
                <SelectContent>{mccmncs.filter(m => m.mcc === form.mcc).map(m => <SelectItem key={m.mnc} value={m.mnc}>{m.mnc} — {m.network}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>TPS Limit</Label><Input type="number" value={form.tps_limit} onChange={e => set("tps_limit", Number(e.target.value))} /></div>
            <div className="space-y-1"><Label>Priority</Label><Input type="number" value={form.priority} onChange={e => set("priority", Number(e.target.value))} /></div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="blocked">Blocked</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => { if (editing) updateMut.mutate({ id: editing.id, data: form }); else createMut.mutate(form); }}>{editing ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rate Dialog */}
      <Dialog open={rateDialogOpen} onOpenChange={setRateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Voice Rate</DialogTitle></DialogHeader>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 mb-2">
            ⚠️ If a rate already exists for the same Supplier + MCC/MNC, the old rate will be automatically <strong>deactivated</strong> and the new rate will become active.
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1 col-span-2">
              <Label>Voice Supplier</Label>
              <Select value={rateForm.entity_id} onValueChange={v => { const s = suppliers.find(x => x.id === v); setRF("entity_id", v); if (s) setRF("entity_name", s.name); }}>
                <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>MCC</Label>
              <Select value={rateForm.mcc} onValueChange={v => { const m = mccmncs.find(x => x.mcc === v); setRF("mcc", v); if (m) setRF("country", m.country); }}>
                <SelectTrigger><SelectValue placeholder="Select MCC" /></SelectTrigger>
                <SelectContent>{[...new Map(mccmncs.map(m => [m.mcc, m])).values()].map(m => <SelectItem key={m.mcc} value={m.mcc}>{m.mcc} — {m.country}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>MNC</Label>
              <Select value={rateForm.mnc} onValueChange={v => { const m = mccmncs.find(x => x.mcc === rateForm.mcc && x.mnc === v); setRF("mnc", v); if (m) setRF("network", m.network); }}>
                <SelectTrigger><SelectValue placeholder="Select MNC" /></SelectTrigger>
                <SelectContent>{mccmncs.filter(m => m.mcc === rateForm.mcc).map(m => <SelectItem key={m.mnc} value={m.mnc}>{m.mnc} — {m.network}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Prefix</Label><Input value={rateForm.prefix} onChange={e => setRF("prefix", e.target.value)} /></div>
            <div className="space-y-1"><Label>Rate *</Label><Input type="number" step="0.00001" value={rateForm.rate} onChange={e => setRF("rate", e.target.value)} /></div>
            <div className="space-y-1">
              <Label>Currency</Label>
              <Select value={rateForm.currency} onValueChange={v => setRF("currency", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["USD","EUR","GBP","INR","AED","BDT"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1 col-span-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs font-semibold text-blue-800 mb-2"><Clock className="w-3 h-3 inline mr-1" />Schedule (optional — leave blank for immediate)</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Active From</Label><Input type="datetime-local" value={rateForm.active_from} onChange={e => setRF("active_from", e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs">Active Until</Label><Input type="datetime-local" value={rateForm.active_until} onChange={e => setRF("active_until", e.target.value)} /></div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRateDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => createRate.mutate(rateForm)} disabled={createRate.isPending}>Save Rate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}