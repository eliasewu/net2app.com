import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, DollarSign, Plus, Pencil, Trash2, Download } from "lucide-react";
import { toast } from "sonner";

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "AED", "BDT"];

const emptyRate = {
  client_id: "", client_name: "", rate_type: "sell",
  destination: "", prefix: "", mcc: "", mnc: "",
  rate_per_min: 0, currency: "USD",
  billing_increment: 60, min_duration: 0,
  status: "active", notes: ""
};

export default function VoipRates({ voipClients }) {
  const [search, setSearch] = useState("");
  const [rateTab, setRateTab] = useState("sell");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...emptyRate });
  const qc = useQueryClient();

  const { data: rates = [] } = useQuery({
    queryKey: ['voice-rates'],
    queryFn: () => base44.entities.VoiceRate.list('-created_date', 500),
    initialData: [],
  });

  const createMut = useMutation({
    mutationFn: d => base44.entities.VoiceRate.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['voice-rates'] }); setDialogOpen(false); toast.success("Rate added"); }
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.VoiceRate.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['voice-rates'] }); setDialogOpen(false); toast.success("Rate updated"); }
  });
  const deleteMut = useMutation({
    mutationFn: id => base44.entities.VoiceRate.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['voice-rates'] }); toast.success("Deleted"); }
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = () => {
    const client = voipClients.find(c => c.id === form.client_id);
    const data = { ...form, client_name: client?.name || form.client_name };
    if (editing) updateMut.mutate({ id: editing.id, data });
    else createMut.mutate(data);
  };

  const openAdd = (type) => {
    setEditing(null);
    setForm({ ...emptyRate, rate_type: type });
    setDialogOpen(true);
  };

  const openEdit = (r) => {
    setEditing(r);
    setForm({ ...emptyRate, ...r });
    setDialogOpen(true);
  };

  const filteredRates = rates.filter(r =>
    r.rate_type === rateTab &&
    (!search || r.destination?.toLowerCase().includes(search.toLowerCase()) ||
      r.prefix?.includes(search) || r.client_name?.toLowerCase().includes(search.toLowerCase()))
  );

  const sellRates = rates.filter(r => r.rate_type === 'sell');
  const buyRates = rates.filter(r => r.rate_type === 'buy');

  const avgSell = sellRates.length ? (sellRates.reduce((s, r) => s + (r.rate_per_min || 0), 0) / sellRates.length) : 0;
  const avgBuy = buyRates.length ? (buyRates.reduce((s, r) => s + (r.rate_per_min || 0), 0) / buyRates.length) : 0;

  const exportCsv = () => {
    const rows = filteredRates.map(r =>
      `${r.client_name},${r.rate_type},${r.destination},${r.prefix},${r.mcc},${r.mnc},${r.rate_per_min},${r.currency},${r.billing_increment},${r.status}`
    );
    const blob = new Blob(["client,type,destination,prefix,mcc,mnc,rate_per_min,currency,billing_increment,status\n" + rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `voice_rates_${rateTab}.csv`; a.click();
  };

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-50 border border-red-200"><TrendingDown className="w-4 h-4 text-red-600" /></div>
          <div>
            <p className="text-xs text-muted-foreground">Avg Buy Rate/min</p>
            <p className="text-xl font-bold text-red-700">{avgBuy.toFixed(5)}</p>
            <p className="text-xs text-muted-foreground">{buyRates.length} destinations</p>
          </div>
        </div>
        <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-50 border border-blue-200"><TrendingUp className="w-4 h-4 text-blue-600" /></div>
          <div>
            <p className="text-xs text-muted-foreground">Avg Sell Rate/min</p>
            <p className="text-xl font-bold text-blue-700">{avgSell.toFixed(5)}</p>
            <p className="text-xs text-muted-foreground">{sellRates.length} destinations</p>
          </div>
        </div>
        <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-50 border border-green-200"><DollarSign className="w-4 h-4 text-green-600" /></div>
          <div>
            <p className="text-xs text-muted-foreground">Margin/min</p>
            <p className={`text-xl font-bold ${(avgSell - avgBuy) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {(avgSell - avgBuy).toFixed(5)}
            </p>
            <p className="text-xs text-muted-foreground">{rates.length} total rates</p>
          </div>
        </div>
      </div>

      <Tabs value={rateTab} onValueChange={setRateTab}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <TabsList>
            <TabsTrigger value="sell">Sell Rates ({sellRates.length})</TabsTrigger>
            <TabsTrigger value="buy">Buy Rates ({buyRates.length})</TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <Input placeholder="Search destination/prefix..." className="w-56" value={search} onChange={e => setSearch(e.target.value)} />
            <Button variant="outline" size="sm" onClick={exportCsv}><Download className="w-4 h-4 mr-1" />CSV</Button>
            <Button size="sm" onClick={() => openAdd(rateTab)}><Plus className="w-4 h-4 mr-1" />Add {rateTab === 'sell' ? 'Sell' : 'Buy'} Rate</Button>
          </div>
        </div>

        {["sell", "buy"].map(type => (
          <TabsContent key={type} value={type} className="mt-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  {type === 'sell' ? <TrendingUp className="w-4 h-4 text-blue-600" /> : <TrendingDown className="w-4 h-4 text-red-600" />}
                  {type === 'sell' ? 'Sell Rates (what clients pay)' : 'Buy Rates (what you pay suppliers)'}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Destination</TableHead>
                      <TableHead>Prefix</TableHead>
                      <TableHead>MCC/MNC</TableHead>
                      <TableHead>Rate/min</TableHead>
                      <TableHead>Currency</TableHead>
                      <TableHead>Billing Inc.</TableHead>
                      <TableHead>Min Dur.</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRates.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium text-sm">{r.client_name || '—'}</TableCell>
                        <TableCell className="text-sm">{r.destination || '—'}</TableCell>
                        <TableCell className="font-mono text-xs">{r.prefix || '—'}</TableCell>
                        <TableCell className="font-mono text-xs">{r.mcc || '—'}/{r.mnc || '—'}</TableCell>
                        <TableCell className={`font-mono font-bold text-sm ${type === 'sell' ? 'text-blue-700' : 'text-red-700'}`}>
                          {(r.rate_per_min || 0).toFixed(5)}
                        </TableCell>
                        <TableCell className="text-xs">{r.currency}</TableCell>
                        <TableCell className="text-xs">{r.billing_increment}s</TableCell>
                        <TableCell className="text-xs">{r.min_duration}s</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={r.status === 'active' ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-500"}>
                            {r.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="w-3.5 h-3.5" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteMut.mutate(r.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredRates.length === 0 && (
                      <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-10">
                        No {type} rates yet. Click "Add {type === 'sell' ? 'Sell' : 'Buy'} Rate" to start.
                      </TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Voice Rate' : `Add ${form.rate_type === 'sell' ? 'Sell' : 'Buy'} Rate`}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Rate Type</Label>
              <Select value={form.rate_type} onValueChange={v => set('rate_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sell">Sell (client pays)</SelectItem>
                  <SelectItem value="buy">Buy (you pay)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>VoIP Client</Label>
              <Select value={form.client_id} onValueChange={v => { const c = voipClients.find(x => x.id === v); set('client_id', v); set('client_name', c?.name || ''); }}>
                <SelectTrigger><SelectValue placeholder="Select client..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Global / All</SelectItem>
                  {voipClients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Destination Name</Label><Input value={form.destination} onChange={e => set('destination', e.target.value)} placeholder="Bangladesh Mobile" /></div>
            <div className="space-y-1.5"><Label>Prefix</Label><Input value={form.prefix} onChange={e => set('prefix', e.target.value)} placeholder="+880" /></div>
            <div className="space-y-1.5"><Label>MCC</Label><Input value={form.mcc} onChange={e => set('mcc', e.target.value)} placeholder="470" /></div>
            <div className="space-y-1.5"><Label>MNC</Label><Input value={form.mnc} onChange={e => set('mnc', e.target.value)} placeholder="01" /></div>
            <div className="space-y-1.5"><Label>Rate per Minute *</Label><Input type="number" step="0.00001" value={form.rate_per_min} onChange={e => set('rate_per_min', parseFloat(e.target.value) || 0)} /></div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select value={form.currency} onValueChange={v => set('currency', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Billing Increment (sec)</Label><Input type="number" value={form.billing_increment} onChange={e => set('billing_increment', Number(e.target.value))} /></div>
            <div className="space-y-1.5"><Label>Min Duration (sec)</Label><Input type="number" value={form.min_duration} onChange={e => set('min_duration', Number(e.target.value))} /></div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Notes</Label><Input value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Effective From</Label><Input type="datetime-local" value={form.effective_from || ''} onChange={e => set('effective_from', e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Effective Until</Label><Input type="datetime-local" value={form.effective_until || ''} onChange={e => set('effective_until', e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit}>{editing ? 'Update Rate' : 'Add Rate'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}