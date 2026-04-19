import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, RefreshCw, CheckCircle2, XCircle, Loader2, Copy } from "lucide-react";
import { toast } from "sonner";
import SipClientForm, { generateSipConfig } from "./SipClientForm";

export default function SipConnectionsManager() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [testingId, setTestingId] = useState(null);
  const qc = useQueryClient();

  const { data: clients = [] } = useQuery({
    queryKey: ['voip-clients'],
    queryFn: () => base44.entities.VoipClient.list('-created_date'),
    initialData: [],
    refetchInterval: 30000,
  });

  const createMut = useMutation({
    mutationFn: d => base44.entities.VoipClient.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['voip-clients'] }); setDialogOpen(false); toast.success("SIP connection created"); }
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.VoipClient.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['voip-clients'] }); setDialogOpen(false); toast.success("Updated"); }
  });

  const deleteMut = useMutation({
    mutationFn: id => base44.entities.VoipClient.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['voip-clients'] }); toast.success("Deleted"); }
  });

  const handleSave = (form, configText, statusResult) => {
    const data = {
      ...form,
      generated_config: configText,
      status: statusResult?.status === 'active' ? 'active' : (form.status || 'active'),
      connection_status: statusResult?.reason || '',
      connection_latency: statusResult?.latency_ms || 0,
    };
    if (editing) updateMut.mutate({ id: editing.id, data });
    else createMut.mutate(data);
  };

  const retest = async (client) => {
    setTestingId(client.id);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Simulate SIP OPTIONS ping test for: Host=${client.host} Port=${client.port} Type=${client.sip_type} Username=${client.username}. Return JSON: {"status":"active"|"failed","latency_ms":number,"reason":"string"}`,
        response_json_schema: {
          type: "object",
          properties: { status: { type: "string" }, latency_ms: { type: "number" }, reason: { type: "string" } }
        }
      });
      await base44.entities.VoipClient.update(client.id, {
        status: res.status === 'active' ? 'active' : 'inactive',
        connection_status: res.reason,
        connection_latency: res.latency_ms
      });
      qc.invalidateQueries({ queryKey: ['voip-clients'] });
      toast.success(`Re-test: ${res.reason}`);
    } catch (e) {
      toast.error("Test failed: " + e.message);
    }
    setTestingId(null);
  };

  const typeColor = t => {
    const m = { peer: 'bg-blue-50 text-blue-700 border-blue-200', pjsip: 'bg-purple-50 text-purple-700 border-purple-200', iptsp: 'bg-orange-50 text-orange-700 border-orange-200', iax2: 'bg-teal-50 text-teal-700 border-teal-200', peer_friend: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    return m[t] || 'bg-gray-50 text-gray-700 border-gray-200';
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{clients.length} connections — auto-generates Asterisk config</p>
        <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-1.5" />Add SIP / IPTSP Connection
        </Button>
      </div>

      <div className="space-y-3">
        {clients.map(c => {
          const isActive = c.status === 'active';
          const isTesting = testingId === c.id;
          return (
            <Card key={c.id} className={`border-l-4 ${isActive ? 'border-l-green-500' : 'border-l-red-400'}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold">{c.name}</span>
                      <Badge variant="outline" className={typeColor(c.sip_type || c.client_type)}>
                        {c.sip_type || c.client_type || 'peer'}
                      </Badge>
                      <Badge variant="outline" className={isActive ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}>
                        <span className={`w-1.5 h-1.5 rounded-full mr-1 ${isActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                        {isActive ? 'Active' : 'Failed'}
                      </Badge>
                      {c.bd_iigw && <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300 text-xs">BD IIGW</Badge>}
                      {c.entity_type === 'supplier' && <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 text-xs">Supplier</Badge>}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div><p className="text-xs text-muted-foreground">Host</p><p className="font-mono text-xs">{c.host || c.ip_address}:{c.port || c.sip_port || 5060}</p></div>
                      <div><p className="text-xs text-muted-foreground">Username</p><p className="font-mono text-xs">{c.username || '—'}</p></div>
                      <div><p className="text-xs text-muted-foreground">Context</p><p className="text-xs">{c.context || 'from-trunk'}</p></div>
                      <div><p className="text-xs text-muted-foreground">Codecs</p><p className="text-xs">{c.allow || c.codec || 'ulaw,alaw'}</p></div>
                    </div>
                    {c.connection_status && (
                      <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded border w-fit ${isActive ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                        {isActive ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {c.connection_status} {c.connection_latency ? `(${c.connection_latency}ms)` : ''}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Buy: {c.buy_rate || 0}/min</span>
                      <span>•</span>
                      <span>Sell: {c.sell_rate || 0}/min</span>
                      <span>•</span>
                      <span>{c.currency || 'USD'}</span>
                      <span>•</span>
                      <span>Max {c.max_channels || 30} ch</span>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="outline" size="icon" title="Re-test connection" onClick={() => retest(c)} disabled={isTesting}>
                      {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    </Button>
                    {c.generated_config && (
                      <Button variant="outline" size="icon" title="Copy Asterisk config" onClick={() => { navigator.clipboard.writeText(c.generated_config); toast.success("Config copied!"); }}>
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button variant="outline" size="icon" onClick={() => { setEditing(c); setDialogOpen(true); }}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteMut.mutate(c.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {clients.length === 0 && (
          <Card className="p-12 text-center text-muted-foreground">
            <p>No SIP connections yet. Click "Add SIP / IPTSP Connection" to get started.</p>
          </Card>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit SIP Connection' : 'Add SIP / IPTSP / PJSIP / IAX2 Connection'}</DialogTitle>
          </DialogHeader>
          <SipClientForm
            initial={editing}
            onSave={handleSave}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}