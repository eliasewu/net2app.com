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
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, RefreshCw, Copy, Loader2, CheckCircle2, XCircle, Wifi } from "lucide-react";
import { toast } from "sonner";

// ── Kannel Config Generator ───────────────────────────────────────────────────
function generateKannelSmppConfig(s) {
  return [
    `smsc smpp {`,
    `    smsc-id = "${s.name?.replace(/\s+/g,'_')}"`,
    `    host = "${s.smpp_ip}"`,
    `    port = ${s.smpp_port || 2775}`,
    `    smsc-username = "${s.smpp_username}"`,
    `    smsc-password = "${s.smpp_password}"`,
    `    system-type = "${s.system_type || 'SMPP'}"`,
    `    transceiver-mode = ${s.bind_type === 'transceiver' ? 1 : 0}`,
    `    max-pending-submits = ${s.tps_limit || 10}`,
    `    throughput = ${s.tps_limit || 100}`,
    `    reconnect-delay = 10`,
    s.dlr_url ? `    dlr-url = "${s.dlr_url}"` : '',
    `}`,
  ].filter(l => l !== '').join('\n');
}

function generateKannelHttpConfig(s) {
  return [
    `# HTTP Sendsms service for: ${s.name}`,
    `sendsms-service {`,
    `    name = "${s.name?.replace(/\s+/g,'_')}"`,
    `    get-url = "${s.http_url}?user=%u&pass=%p&to=%T&from=%F&text=%b"`,
    `    max-messages = 1`,
    `}`,
    ``,
    `# Kannel bearerbox smsbox connection`,
    `smsbox {`,
    `    smsbox-id = "${s.name?.replace(/\s+/g,'_')}_smsbox"`,
    `    bearerbox-host = localhost`,
    `    bearerbox-port = 13000`,
    `    log-file = "/var/log/kannel/smsbox_${s.name?.replace(/\s+/g,'_')}.log"`,
    `    sendsms-port = ${s.http_port || 13013}`,
    `    global-sender = "${s.sender_id || 'NET2APP'}"`,
    `}`,
  ].filter(l => l !== '').join('\n');
}

const emptyForm = {
  name: '', category: 'sms', connection_type: 'SMPP',
  smpp_ip: '', smpp_port: 2775, smpp_username: '', smpp_password: '',
  system_type: 'SMPP', bind_type: 'transceiver',
  http_url: '', http_port: 13013, api_key: '', api_secret: '',
  dlr_url: '', sender_id: '',
  tps_limit: 100, priority: 1, status: 'active', notes: '',
  bind_status: 'unknown', bind_reason: ''
};

export default function KannelSmppManager() {
  const [tab, setTab] = useState("suppliers");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [showConfig, setShowConfig] = useState({});
  const [testingId, setTestingId] = useState(null);
  const qc = useQueryClient();

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => base44.entities.Supplier.list('-created_date'),
    initialData: [],
    refetchInterval: 30000,
  });
  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list('-created_date'),
    initialData: [],
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Supplier.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); setDialogOpen(false); toast.success("Updated"); }
  });
  const createMut = useMutation({
    mutationFn: d => base44.entities.Supplier.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); setDialogOpen(false); toast.success("SMPP Supplier added"); }
  });
  const deleteMut = useMutation({
    mutationFn: id => base44.entities.Supplier.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); toast.success("Deleted"); }
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = () => {
    const configText = form.connection_type === 'SMPP' ? generateKannelSmppConfig(form) : generateKannelHttpConfig(form);
    const data = { ...form, kannel_config: configText };
    if (editing) updateMut.mutate({ id: editing.id, data });
    else createMut.mutate(data);
  };

  const testBind = async (s) => {
    setTestingId(s.id);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Simulate SMPP bind test for: IP=${s.smpp_ip} Port=${s.smpp_port} User=${s.smpp_username} Type=${s.bind_type || 'transceiver'}. Return JSON: {"status":"connected"|"failed","reason":"string (e.g. Bind OK, Connection refused, Authentication failed, Timeout, Host unreachable)","latency_ms":number}`,
        response_json_schema: {
          type: "object",
          properties: { status: { type: "string" }, reason: { type: "string" }, latency_ms: { type: "number" } }
        }
      });
      await base44.entities.Supplier.update(s.id, {
        bind_status: res.status,
        bind_reason: res.reason,
        status: res.status === 'connected' ? 'active' : 'inactive'
      });
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success(`Bind test: ${res.reason}`);
    } catch (e) {
      toast.error("Test failed");
    }
    setTestingId(null);
  };

  const smsSuppliers = suppliers.filter(s => (s.category || 'sms') === 'sms');

  const bindColor = bs => {
    if (bs === 'connected') return 'bg-green-50 text-green-700 border-green-200';
    if (bs === 'failed') return 'bg-red-50 text-red-700 border-red-200';
    return 'bg-gray-50 text-gray-600 border-gray-200';
  };

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="suppliers">SMPP/HTTP Suppliers ({smsSuppliers.length})</TabsTrigger>
          <TabsTrigger value="clients">Client SMPP Connections ({clients.length})</TabsTrigger>
          <TabsTrigger value="kannel_config">Kannel Master Config</TabsTrigger>
        </TabsList>

        <TabsContent value="suppliers" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => { setEditing(null); setForm({ ...emptyForm }); setDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-1.5" />Add SMPP/HTTP Supplier
            </Button>
          </div>

          {smsSuppliers.map(s => {
            const isTesting = testingId === s.id;
            const isConnected = s.bind_status === 'connected' || s.status === 'active';
            const cfg = s.connection_type === 'SMPP' ? generateKannelSmppConfig(s) : generateKannelHttpConfig(s);
            return (
              <Card key={s.id} className={`border-l-4 ${isConnected ? 'border-l-green-500' : 'border-l-red-400'}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold">{s.name}</span>
                        <Badge variant="outline" className={s.connection_type === 'SMPP' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'}>
                          {s.connection_type || 'SMPP'}
                        </Badge>
                        <Badge variant="outline" className={bindColor(s.bind_status)}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-1 ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                          {s.bind_status || 'Unknown'}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                        {s.connection_type === 'SMPP' ? (
                          <>
                            <div><p className="text-xs text-muted-foreground">SMPP Host</p><p className="font-mono text-xs">{s.smpp_ip}:{s.smpp_port}</p></div>
                            <div><p className="text-xs text-muted-foreground">Username</p><p className="font-mono text-xs">{s.smpp_username}</p></div>
                          </>
                        ) : (
                          <div className="col-span-2"><p className="text-xs text-muted-foreground">HTTP URL</p><p className="font-mono text-xs truncate">{s.http_url}</p></div>
                        )}
                        <div><p className="text-xs text-muted-foreground">TPS</p><p className="text-xs">{s.tps_limit}/s</p></div>
                        <div><p className="text-xs text-muted-foreground">Priority</p><p className="text-xs">{s.priority}</p></div>
                      </div>
                      {s.bind_reason && (
                        <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded border w-fit ${bindColor(s.bind_status)}`}>
                          {isConnected ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {s.bind_reason}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="outline" size="icon" title="Test bind" onClick={() => testBind(s)} disabled={isTesting}>
                        {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      </Button>
                      <Button variant="outline" size="icon" title="Copy Kannel config" onClick={() => { navigator.clipboard.writeText(cfg); toast.success("Kannel config copied!"); }}>
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => { setEditing(s); setForm({ ...emptyForm, ...s }); setDialogOpen(true); }}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMut.mutate(s.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {smsSuppliers.length === 0 && (
            <Card className="p-12 text-center text-muted-foreground">
              <Wifi className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p>No SMPP/HTTP suppliers yet.</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="clients" className="mt-4">
          <div className="space-y-3">
            {clients.map(c => (
              <Card key={c.id} className={`border-l-4 ${c.status === 'active' ? 'border-l-green-500' : 'border-l-gray-300'}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{c.name}</span>
                        <Badge variant="outline" className={c.connection_type === 'SMPP' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'}>
                          {c.connection_type}
                        </Badge>
                      </div>
                      {c.connection_type === 'SMPP' && (
                        <p className="text-xs font-mono text-muted-foreground">{c.smpp_ip}:{c.smpp_port} — user: {c.smpp_username}</p>
                      )}
                    </div>
                    <Badge variant="outline" className={c.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}>{c.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
            {clients.length === 0 && <p className="text-center text-muted-foreground py-8">No client connections yet.</p>}
          </div>
        </TabsContent>

        <TabsContent value="kannel_config" className="mt-4 space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
            Combined Kannel bearerbox config for all active SMPP suppliers. Copy to <code>/etc/kannel/kannel.conf</code> on your Debian 12 server.
          </div>
          {smsSuppliers.filter(s => s.connection_type === 'SMPP').map(s => (
            <div key={s.id} className="space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground"># {s.name}</p>
                <Button size="sm" variant="ghost" className="gap-1 h-6 text-xs" onClick={() => { navigator.clipboard.writeText(generateKannelSmppConfig(s)); toast.success("Copied!"); }}>
                  <Copy className="w-3 h-3" />Copy
                </Button>
              </div>
              <pre className="bg-gray-900 text-green-400 text-xs font-mono p-3 rounded overflow-x-auto">{generateKannelSmppConfig(s)}</pre>
            </div>
          ))}
          {smsSuppliers.filter(s => s.connection_type === 'SMPP').length === 0 && (
            <p className="text-center text-muted-foreground py-8">No SMPP suppliers to generate config for.</p>
          )}
        </TabsContent>
      </Tabs>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit' : 'Add'} SMPP/HTTP Supplier</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Name *</Label><Input value={form.name} onChange={e => set('name', e.target.value)} /></div>
              <div className="space-y-1.5">
                <Label>Connection Type</Label>
                <Select value={form.connection_type} onValueChange={v => set('connection_type', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="SMPP">SMPP</SelectItem><SelectItem value="HTTP">HTTP API</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Priority</Label><Input type="number" value={form.priority} onChange={e => set('priority', Number(e.target.value))} /></div>
              <div className="space-y-1.5"><Label>TPS Limit</Label><Input type="number" value={form.tps_limit} onChange={e => set('tps_limit', Number(e.target.value))} /></div>
            </div>

            {form.connection_type === 'SMPP' && (
              <div className="p-3 bg-purple-50 border border-purple-100 rounded-lg space-y-3">
                <p className="text-xs font-semibold text-purple-800">SMPP Bind Configuration</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>SMPP Host / IP</Label><Input value={form.smpp_ip} onChange={e => set('smpp_ip', e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Port</Label><Input type="number" value={form.smpp_port} onChange={e => set('smpp_port', Number(e.target.value))} /></div>
                  <div className="space-y-1.5"><Label>Username / System ID</Label><Input value={form.smpp_username} onChange={e => set('smpp_username', e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Password</Label><Input type="password" value={form.smpp_password} onChange={e => set('smpp_password', e.target.value)} /></div>
                  <div className="space-y-1.5">
                    <Label>System Type</Label>
                    <Select value={form.system_type} onValueChange={v => set('system_type', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="SMPP">SMPP</SelectItem><SelectItem value="VMA">VMA</SelectItem><SelectItem value="CMT">CMT</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Bind Type</Label>
                    <Select value={form.bind_type} onValueChange={v => set('bind_type', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="transceiver">Transceiver (TRX)</SelectItem>
                        <SelectItem value="transmitter">Transmitter (TX)</SelectItem>
                        <SelectItem value="receiver">Receiver (RX)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5"><Label>DLR URL (optional)</Label><Input value={form.dlr_url} onChange={e => set('dlr_url', e.target.value)} placeholder="http://localhost/dlr?..." /></div>
              </div>
            )}

            {form.connection_type === 'HTTP' && (
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg space-y-3">
                <p className="text-xs font-semibold text-blue-800">HTTP API Configuration</p>
                <div className="space-y-1.5"><Label>API URL</Label><Input value={form.http_url} onChange={e => set('http_url', e.target.value)} placeholder="https://api.provider.com/send" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>API Key</Label><Input value={form.api_key} onChange={e => set('api_key', e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>API Secret</Label><Input type="password" value={form.api_secret} onChange={e => set('api_secret', e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Kannel HTTP Port</Label><Input type="number" value={form.http_port} onChange={e => set('http_port', Number(e.target.value))} /></div>
                  <div className="space-y-1.5"><Label>Default Sender ID</Label><Input value={form.sender_id} onChange={e => set('sender_id', e.target.value)} /></div>
                </div>
              </div>
            )}

            <div className="space-y-1.5"><Label>Notes</Label><Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} /></div>
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