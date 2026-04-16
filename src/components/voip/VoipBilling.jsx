import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { CreditCard, Pencil, TrendingUp, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export default function VoipBilling({ voipClients }) {
  const [editingClient, setEditingClient] = useState(null);
  const [form, setForm] = useState({});
  const qc = useQueryClient();

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.VoipClient.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['voip-clients'] }); setEditingClient(null); toast.success("Billing updated"); }
  });

  const openEdit = (c) => { setEditingClient(c); setForm({ buy_rate: c.buy_rate, sell_rate: c.sell_rate, currency: c.currency, billing_cycle: c.billing_cycle }); };

  const totalRevenue = voipClients.reduce((s, c) => s + (c.sell_rate || 0), 0);
  const totalCost = voipClients.reduce((s, c) => s + (c.buy_rate || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-50 border border-blue-200"><TrendingUp className="w-4 h-4 text-blue-600" /></div>
          <div><p className="text-xs text-muted-foreground">Total Sell Rates</p><p className="text-xl font-bold">{totalRevenue.toFixed(4)}</p></div>
        </div>
        <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-50 border border-red-200"><DollarSign className="w-4 h-4 text-red-600" /></div>
          <div><p className="text-xs text-muted-foreground">Total Buy Rates</p><p className="text-xl font-bold">{totalCost.toFixed(4)}</p></div>
        </div>
        <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-50 border border-green-200"><CreditCard className="w-4 h-4 text-green-600" /></div>
          <div><p className="text-xs text-muted-foreground">Net Margin</p><p className={`text-xl font-bold ${(totalRevenue - totalCost) >= 0 ? 'text-green-700' : 'text-red-700'}`}>{(totalRevenue - totalCost).toFixed(4)}</p></div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><CreditCard className="w-4 h-4" />Billing Cycles</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Traffic</TableHead>
                <TableHead>Buy Rate</TableHead>
                <TableHead>Sell Rate</TableHead>
                <TableHead>Margin</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Billing Cycle</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Edit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {voipClients.map(c => {
                const margin = (c.sell_rate || 0) - (c.buy_rate || 0);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={c.traffic_type === 'voice' ? "bg-orange-50 text-orange-700 border-orange-200" : c.traffic_type === 'sms' ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-purple-50 text-purple-700 border-purple-200"}>
                        {c.traffic_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-red-700">{(c.buy_rate || 0).toFixed(5)}</TableCell>
                    <TableCell className="font-mono text-sm text-blue-700">{(c.sell_rate || 0).toFixed(5)}</TableCell>
                    <TableCell className={`font-mono text-sm font-bold ${margin >= 0 ? 'text-green-700' : 'text-red-600'}`}>{margin >= 0 ? '+' : ''}{margin.toFixed(5)}</TableCell>
                    <TableCell>{c.currency}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize text-xs bg-blue-50 text-blue-700 border-blue-200">{c.billing_cycle}</Badge></TableCell>
                    <TableCell><Badge variant="outline" className={c.status === 'active' ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-600"}>{c.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="w-4 h-4" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {voipClients.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-12">No clients configured</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editingClient} onOpenChange={() => setEditingClient(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Billing — {editingClient?.name}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Buy Rate</Label><Input type="number" step="0.00001" value={form.buy_rate || 0} onChange={e => setForm(p => ({ ...p, buy_rate: parseFloat(e.target.value) || 0 }))} /></div>
            <div className="space-y-1.5"><Label>Sell Rate</Label><Input type="number" step="0.00001" value={form.sell_rate || 0} onChange={e => setForm(p => ({ ...p, sell_rate: parseFloat(e.target.value) || 0 }))} /></div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select value={form.currency || 'USD'} onValueChange={v => setForm(p => ({ ...p, currency: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="EUR">EUR</SelectItem><SelectItem value="GBP">GBP</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Billing Cycle</Label>
              <Select value={form.billing_cycle || 'monthly'} onValueChange={v => setForm(p => ({ ...p, billing_cycle: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingClient(null)}>Cancel</Button>
            <Button onClick={() => updateMut.mutate({ id: editingClient.id, data: form })}>Save Billing</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}