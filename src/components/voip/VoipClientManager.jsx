import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Phone, MessageSquare } from "lucide-react";
import { toast } from "sonner";

const empty = {
  name: "", platform_id: "", platform_name: "", client_type: "pjsip",
  username: "", password: "", ip_address: "", port: 5060,
  caller_id: "", context: "from-trunk", codec: "ulaw,alaw,g729",
  max_channels: 30, nat: false, qualify: true,
  traffic_type: "voice", buy_rate: 0, sell_rate: 0, currency: "USD",
  billing_cycle: "monthly", status: "active", notes: ""
};

const TRAFFIC_BADGE = {
  voice: "bg-orange-50 text-orange-700 border-orange-200",
  sms: "bg-blue-50 text-blue-700 border-blue-200",
  both: "bg-purple-50 text-purple-700 border-purple-200",
};

export default function VoipClientManager({ platforms }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...empty });
  const qc = useQueryClient();

  const { data: clients = [] } = useQuery({
    queryKey: ['voip-clients'],
    queryFn: () => base44.entities.VoipClient.list('-created_date'),
    initialData: [],
  });

  const createMut = useMutation({ mutationFn: d => base44.entities.VoipClient.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['voip-clients'] }); setDialogOpen(false); toast.success("Client added to Asterisk"); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }) => base44.entities.VoipClient.update(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['voip-clients'] }); setDialogOpen(false); toast.success("Updated"); } });
  const deleteMut = useMutation({ mutationFn: id => base44.entities.VoipClient.delete(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['voip-clients'] }); toast.success("Client removed"); } });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const handleSubmit = () => {
    const platform = platforms.find(p => p.id === form.platform_id);
    const data = { ...form, platform_name: platform?.name || "" };
    editing ? updateMut.mutate({ id: editing.id, data }) : createMut.mutate(data);
  };

  // Generate Asterisk PJSIP config snippet
  const generateConfig = (c) => `; /etc/asterisk/pjsip.conf — ${c.name}
[${c.username}]
type=endpoint
context=${c.context}
disallow=all
allow=${c.codec}
aors=${c.username}
auth=${c.username}-auth
callerid=${c.caller_id || c.username}
max_contacts=${c.max_channels}

[${c.username}-auth]
type=auth
auth_type=userpass
username=${c.username}
password=${c.password}

[${c.username}]
type=aor
max_contacts=${c.max_channels}
${c.ip_address ? `contact=sip:${c.username}@${c.ip_address}:${c.port}` : 'qualify_frequency=60'}`;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setForm({ ...empty }); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />Add SIP Client
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>IP : Port</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Traffic</TableHead>
                <TableHead>Buy Rate</TableHead>
                <TableHead>Sell Rate</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="font-mono text-xs">{c.username}</TableCell>
                  <TableCell className="font-mono text-xs">{c.ip_address || '—'}:{c.port}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{c.client_type}</Badge></TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-xs gap-1 ${TRAFFIC_BADGE[c.traffic_type] || ''}`}>
                      {c.traffic_type === 'voice' && <Phone className="w-3 h-3" />}
                      {c.traffic_type === 'sms' && <MessageSquare className="w-3 h-3" />}
                      {c.traffic_type === 'both' && <><Phone className="w-3 h-3" /><MessageSquare className="w-3 h-3" /></>}
                      {c.traffic_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-green-700 text-xs">{c.buy_rate?.toFixed(4)} {c.currency}</TableCell>
                  <TableCell className="font-mono text-blue-700 text-xs">{c.sell_rate?.toFixed(4)} {c.currency}</TableCell>
                  <TableCell className="text-xs">{c.platform_name || '—'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={c.status === 'active' ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-600"}>
                      {c.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Config" onClick={() => { navigator.clipboard.writeText(generateConfig(c)); toast.success("PJSIP config copied!"); }}>
                        <span className="text-[10px] font-mono text-blue-600">CFG</span>
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(c); setForm({ ...empty, ...c }); setDialogOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMut.mutate(c.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {clients.length === 0 && <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-12">No SIP clients yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit SIP Client' : 'Add SIP Client to Asterisk'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Client Name *</Label><Input value={form.name} onChange={e => set('name', e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label>Platform</Label>
              <Select value={form.platform_id} onValueChange={v => set('platform_id', v)}>
                <SelectTrigger><SelectValue placeholder="Select platform..." /></SelectTrigger>
                <SelectContent>{platforms.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>SIP Username *</Label><Input value={form.username} onChange={e => set('username', e.target.value)} /></div>
            <div className="space-y-1.5"><Label>SIP Password</Label><Input type="password" value={form.password} onChange={e => set('password', e.target.value)} /></div>
            <div className="space-y-1.5"><Label>IP Address (optional)</Label><Input value={form.ip_address} onChange={e => set('ip_address', e.target.value)} placeholder="For IP-based auth" /></div>
            <div className="space-y-1.5"><Label>Port</Label><Input type="number" value={form.port} onChange={e => set('port', Number(e.target.value))} /></div>
            <div className="space-y-1.5"><Label>Caller ID</Label><Input value={form.caller_id} onChange={e => set('caller_id', e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label>Client Type</Label>
              <Select value={form.client_type} onValueChange={v => set('client_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pjsip">PJSIP (recommended)</SelectItem>
                  <SelectItem value="sip_trunk">SIP Trunk</SelectItem>
                  <SelectItem value="sip_peer">SIP Peer</SelectItem>
                  <SelectItem value="iax2">IAX2</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Traffic Type</Label>
              <Select value={form.traffic_type} onValueChange={v => set('traffic_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="voice">🟠 Voice Only</SelectItem>
                  <SelectItem value="sms">🔵 SMS Only</SelectItem>
                  <SelectItem value="both">🟣 Voice + SMS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Context</Label><Input value={form.context} onChange={e => set('context', e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Codecs</Label><Input value={form.codec} onChange={e => set('codec', e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Max Channels</Label><Input type="number" value={form.max_channels} onChange={e => set('max_channels', Number(e.target.value))} /></div>

            {/* Rates */}
            <div className="col-span-2 p-3 bg-green-50 border border-green-100 rounded-lg space-y-3">
              <p className="text-xs font-semibold text-green-800">Rates</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5"><Label>Buy Rate</Label><Input type="number" step="0.00001" value={form.buy_rate} onChange={e => set('buy_rate', parseFloat(e.target.value) || 0)} /></div>
                <div className="space-y-1.5"><Label>Sell Rate</Label><Input type="number" step="0.00001" value={form.sell_rate} onChange={e => set('sell_rate', parseFloat(e.target.value) || 0)} /></div>
                <div className="space-y-1.5">
                  <Label>Currency</Label>
                  <Select value={form.currency} onValueChange={v => set('currency', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="EUR">EUR</SelectItem><SelectItem value="GBP">GBP</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Billing Cycle</Label>
              <Select value={form.billing_cycle} onValueChange={v => set('billing_cycle', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="blocked">Blocked</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit}>{editing ? 'Update' : 'Add Client'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}