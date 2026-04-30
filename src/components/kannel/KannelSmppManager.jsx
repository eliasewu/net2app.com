import { useState, useEffect } from "react";
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
import {
  Plus, Pencil, Trash2, RefreshCw, Copy, Loader2,
  CheckCircle2, XCircle, Wifi, Server, Zap, Users, RotateCcw, Download, Play
} from "lucide-react";
import { toast } from "sonner";

// ── Kannel Config Generators ──────────────────────────────────────────────────
function supplierKannelBlock(s) {
  const id = (s.name || s.id).replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
  const bindMode = s.bind_type === 'transmitter' ? 2 : s.bind_type === 'receiver' ? 1 : 3;
  return [
    `group = smsc`,
    `smsc = smpp`,
    `smsc-id = "${id}"`,
    `host = "${s.smpp_ip}"`,
    `port = ${s.smpp_port || 2775}`,
    `smsc-username = "${s.smpp_username}"`,
    `smsc-password = "${s.smpp_password || ''}"`,
    `system-type = "${s.system_type || 'SMPP'}"`,
    `transceiver-mode = ${bindMode}`,
    `max-pending-submits = ${Math.min(s.tps_limit || 20, 100)}`,
    `throughput = ${s.tps_limit || 100}`,
    `reconnect-delay = 10`,
    `log-file = "/var/log/kannel/${id}.log"`,
    s.dlr_url ? `dlr-url = "${s.dlr_url}"` : null,
  ].filter(Boolean).join('\n');
}

function clientSmppBlock(c, port) {
  const id = (c.name || c.id).replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
  return [
    `group = smpp-server`,
    `smpp-server-id = client_${id}`,
    `port = ${port}`,
    `system-id = "${c.smpp_username}"`,
    `password = "${c.smpp_password}"`,
    `system-type = ""`,
    `log-file = "/var/log/kannel/client_${id}.log"`,
    `log-level = 1`,
  ].join('\n');
}

// ── Bind Status Pill ──────────────────────────────────────────────────────────
function BindPill({ status, ip, port, isBound }) {
  if (isBound) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-100 border border-green-300 text-green-800 text-xs font-mono font-semibold">
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        {ip}:{port}
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-mono">
        <XCircle className="w-3 h-3" />
        {ip}:{port}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200 text-gray-600 text-xs font-mono">
      <span className="w-2 h-2 rounded-full bg-gray-400" />
      {ip || '—'}:{port || '—'}
    </span>
  );
}

const emptySupplier = {
  name: '', category: 'sms', connection_type: 'SMPP',
  smpp_ip: '', smpp_port: 2775, smpp_username: '', smpp_password: '',
  system_type: 'SMPP', bind_type: 'transceiver',
  dlr_url: '', tps_limit: 100, priority: 1, status: 'active', notes: '',
  bind_status: 'unknown', bind_reason: ''
};

const emptyClientSmpp = {
  smpp_username: '', smpp_password: '', smpp_port: 9096
};

export default function KannelSmppManager() {
  const [tab, setTab] = useState("suppliers");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [clientSmppDialog, setClientSmppDialog] = useState(null); // holds client record
  const [clientSmppForm, setClientSmppForm] = useState({ ...emptyClientSmpp });
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...emptySupplier });
  const [testingId, setTestingId] = useState(null);
  const [reloading, setReloading] = useState(false);
  const [kannelUp, setKannelUp] = useState(null);
  const [boundSuppliers, setBoundSuppliers] = useState([]);
  const [boundClients, setBoundClients] = useState([]);
  const [generatedConfig, setGeneratedConfig] = useState('');
  const [generatingConfig, setGeneratingConfig] = useState(false);
  const [checkingAll, setCheckingAll] = useState(false);

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

  const updateSupplier = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Supplier.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); setDialogOpen(false); toast.success("Supplier updated"); }
  });
  const createSupplier = useMutation({
    mutationFn: d => base44.entities.Supplier.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); setDialogOpen(false); toast.success("SMPP Supplier added"); }
  });
  const deleteSupplier = useMutation({
    mutationFn: id => base44.entities.Supplier.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); toast.success("Deleted"); }
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // ── Check Kannel Status ───────────────────────────────────────────
  const checkKannelStatus = async () => {
    try {
      const res = await base44.functions.invoke("smppManager", { action: "status" });
      setKannelUp(res.data?.up ?? false);
    } catch {
      setKannelUp(false);
    }
  };

  // ── Check All Bind Statuses ───────────────────────────────────────
  const checkAllBinds = async () => {
    setCheckingAll(true);
    try {
      const res = await base44.functions.invoke("smppManager", { action: "bind_all" });
      if (res.data?.ok) {
        setBoundSuppliers(res.data.bound_suppliers || []);
        setBoundClients(res.data.bound_clients || []);
        toast.success(`Kannel status: ${(res.data.bound_suppliers || []).length} suppliers bound`);
      } else {
        toast.error(res.data?.error || "Could not reach Kannel admin");
      }
    } catch (e) {
      toast.error("Cannot reach Kannel: " + e.message);
    }
    setCheckingAll(false);
  };

  useEffect(() => { checkKannelStatus(); }, []);

  // ── Test single supplier SMPP bind ───────────────────────────────
  const testBind = async (s) => {
    setTestingId(s.id);
    try {
      const res = await base44.functions.invoke("smppManager", {
        action: "test_smpp",
        smpp_ip: s.smpp_ip,
        smpp_port: s.smpp_port || 2775,
        supplier_id: s.id
      });
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      if (res.data?.connected) {
        toast.success(`✅ ${s.name}: Connected`);
        setBoundSuppliers(prev => [...new Set([...prev, (s.name || s.id).replace(/\s+/g, '_')])]);
      } else {
        toast.error(`❌ ${s.name}: ${res.data?.reason || 'Failed'}`);
      }
    } catch (e) {
      toast.error("Test failed: " + e.message);
    }
    setTestingId(null);
  };

  // ── Reload Kannel ────────────────────────────────────────────────
  const reloadKannel = async () => {
    setReloading(true);
    try {
      const res = await base44.functions.invoke("smppManager", { action: "reload_kannel" });
      if (res.data?.ok) toast.success("Kannel reloaded successfully");
      else toast.error(res.data?.error || "Reload failed — run: kill -HUP $(pidof bearerbox)");
    } catch (e) {
      toast.error("Reload error: " + e.message);
    }
    setReloading(false);
  };

  // ── Generate Full Kannel Config ──────────────────────────────────
  const generateConfig = async () => {
    setGeneratingConfig(true);
    try {
      const res = await base44.functions.invoke("smppManager", { action: "generate_config" });
      if (res.data?.ok) {
        setGeneratedConfig(res.data.config);
        setTab("kannel_config");
        toast.success(`Config generated: ${res.data.supplier_count} suppliers + ${res.data.client_count} clients`);
      } else {
        toast.error("Config generation failed");
      }
    } catch {
      // Fallback: generate locally from entity data
      const smppSuppliers = suppliers.filter(s => s.connection_type === 'SMPP' && s.status !== 'blocked');
      const smppClients = clients.filter(c => c.connection_type === 'SMPP' && c.smpp_username);
      let port = 9096;
      const config = [
        `# Net2app Kannel Config — Generated ${new Date().toISOString()}`,
        `# Apply: cp /etc/kannel/kannel.conf /etc/kannel/kannel.conf.bak && nano /etc/kannel/kannel.conf`,
        `# Reload: kill -HUP $(pidof bearerbox)`, '',
        ...smppSuppliers.map(s => supplierKannelBlock(s) + '\n'),
        ...smppClients.map(c => { const b = clientSmppBlock(c, port); port++; return b + '\n'; })
      ].join('\n');
      setGeneratedConfig(config);
      setTab("kannel_config");
    }
    setGeneratingConfig(false);
  };

  // ── Save Supplier ────────────────────────────────────────────────
  const handleSubmit = () => {
    if (!form.name) { toast.error("Name is required"); return; }
    if (editing) updateSupplier.mutate({ id: editing.id, data: form });
    else createSupplier.mutate(form);
  };

  // ── Provision Client SMPP ────────────────────────────────────────
  const provisionClientSmpp = async () => {
    if (!clientSmppForm.smpp_username || !clientSmppForm.smpp_password) {
      toast.error("Username and password required");
      return;
    }
    try {
      const res = await base44.functions.invoke("smppManager", {
        action: "add_smpp_user",
        client_id: clientSmppDialog.id,
        ...clientSmppForm
      });
      qc.invalidateQueries({ queryKey: ['clients'] });
      setClientSmppDialog(null);
      toast.success(res.data?.message || "SMPP user provisioned");
    } catch (e) {
      toast.error("Error: " + e.message);
    }
  };

  const smsSuppliers = suppliers.filter(s => (s.category || 'sms') === 'sms');

  const isSupplierBound = (s) => {
    const id = (s.name || s.id).replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
    return s.bind_status === 'connected' || boundSuppliers.includes(id) || boundSuppliers.some(b => b.toLowerCase().includes(id.toLowerCase()));
  };

  const isClientBound = (c) => {
    if (!c.smpp_username) return false;
    return boundClients.includes(c.smpp_username.toLowerCase());
  };

  return (
    <div className="space-y-4">
      {/* Status Bar */}
      <div className="flex items-center gap-3 p-3 bg-muted/50 border rounded-lg flex-wrap">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${kannelUp === true ? 'bg-green-500 animate-pulse' : kannelUp === false ? 'bg-red-500' : 'bg-gray-400'}`} />
          <span className="text-sm font-medium">
            Kannel: {kannelUp === true ? 'Running' : kannelUp === false ? 'Offline' : 'Unknown'}
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          {boundSuppliers.length > 0 && <span className="text-green-700 font-medium">{boundSuppliers.length} suppliers bound</span>}
          {boundClients.length > 0 && <span className="ml-2 text-blue-700 font-medium">{boundClients.length} clients connected</span>}
        </div>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={checkKannelStatus} className="gap-1.5 text-xs h-7">
            <Server className="w-3 h-3" />Status
          </Button>
          <Button size="sm" variant="outline" onClick={checkAllBinds} disabled={checkingAll} className="gap-1.5 text-xs h-7">
            {checkingAll ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wifi className="w-3 h-3" />}
            Check Binds
          </Button>
          <Button size="sm" variant="outline" onClick={generateConfig} disabled={generatingConfig} className="gap-1.5 text-xs h-7">
            {generatingConfig ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
            Generate Config
          </Button>
          <Button size="sm" variant="outline" onClick={reloadKannel} disabled={reloading} className="gap-1.5 text-xs h-7 text-orange-700 border-orange-300 hover:bg-orange-50">
            {reloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
            Reload Kannel
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="suppliers" className="gap-1 text-xs">
            <Server className="w-3 h-3" />SMPP Suppliers ({smsSuppliers.length})
          </TabsTrigger>
          <TabsTrigger value="clients" className="gap-1 text-xs">
            <Users className="w-3 h-3" />Client SMPP ({clients.length})
          </TabsTrigger>
          <TabsTrigger value="kannel_config" className="gap-1 text-xs">
            <Zap className="w-3 h-3" />Kannel Config
          </TabsTrigger>
        </TabsList>

        {/* ── SUPPLIERS TAB ──────────────────────────────────────── */}
        <TabsContent value="suppliers" className="mt-4 space-y-3">
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => { setEditing(null); setForm({ ...emptySupplier }); setDialogOpen(true); }} className="gap-1.5">
              <Plus className="w-4 h-4" />Add SMPP Supplier
            </Button>
          </div>

          {smsSuppliers.map(s => {
            const isTesting = testingId === s.id;
            const isBound = isSupplierBound(s);
            const smscId = (s.name || s.id).replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');

            return (
              <Card key={s.id} className={`border-l-4 transition-colors ${isBound ? 'border-l-green-500' : s.bind_status === 'failed' ? 'border-l-red-400' : 'border-l-gray-300'}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm">{s.name}</span>
                        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">
                          SMPP
                        </Badge>
                        <Badge variant="outline" className={`text-xs ${isBound ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                          {isBound ? 'Bound' : s.bind_status === 'failed' ? 'Disconnected' : 'Unknown'}
                        </Badge>
                        {isBound && <span className="text-xs text-green-600 font-medium">✓ smsc-id: {smscId}</span>}
                      </div>

                      {/* IP shown in green when bound */}
                      <div className="flex items-center gap-3 flex-wrap">
                        <BindPill status={s.bind_status} ip={s.smpp_ip} port={s.smpp_port} isBound={isBound} />
                        <span className="text-xs text-muted-foreground">user: <code className="font-mono">{s.smpp_username}</code></span>
                        <span className="text-xs text-muted-foreground">TPS: {s.tps_limit}/s</span>
                        <span className="text-xs text-muted-foreground">Bind: {s.bind_type || 'transceiver'}</span>
                      </div>

                      {s.bind_reason && (
                        <p className={`text-xs px-2 py-0.5 rounded border w-fit ${isBound ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                          {s.bind_reason}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-1 shrink-0">
                      <Button variant="outline" size="icon" title="Test TCP connection" onClick={() => testBind(s)} disabled={isTesting} className="h-8 w-8">
                        {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                      </Button>
                      <Button variant="outline" size="icon" title="Copy Kannel block" onClick={() => { navigator.clipboard.writeText(supplierKannelBlock(s)); toast.success("Kannel config block copied!"); }} className="h-8 w-8">
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => { setEditing(s); setForm({ ...emptySupplier, ...s }); setDialogOpen(true); }} className="h-8 w-8">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteSupplier.mutate(s.id)} className="h-8 w-8">
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {smsSuppliers.length === 0 && (
            <Card className="p-12 text-center text-muted-foreground">
              <Wifi className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No SMPP suppliers yet. Add one to get started.</p>
            </Card>
          )}
        </TabsContent>

        {/* ── CLIENTS TAB ────────────────────────────────────────── */}
        <TabsContent value="clients" className="mt-4 space-y-3">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
            Client SMPP users bind TO your Kannel bearerbox on ports 9096+. Click "Provision SMPP" to assign credentials and register the user in Kannel.
          </div>
          {clients.map((c, idx) => {
            const isBound = isClientBound(c);
            const assignedPort = c.smpp_port || (9096 + idx);
            return (
              <Card key={c.id} className={`border-l-4 ${isBound ? 'border-l-green-500' : c.smpp_username ? 'border-l-blue-400' : 'border-l-gray-300'}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm">{c.name}</span>
                        <Badge variant="outline" className={c.connection_type === 'SMPP' ? 'bg-purple-50 text-purple-700 border-purple-200 text-xs' : 'bg-blue-50 text-blue-700 border-blue-200 text-xs'}>
                          {c.connection_type}
                        </Badge>
                        {isBound && (
                          <Badge className="bg-green-100 text-green-700 border-green-300 text-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse mr-1" />Bound
                          </Badge>
                        )}
                      </div>
                      {c.smpp_username ? (
                        <div className="flex items-center gap-3 flex-wrap">
                          <BindPill status={isBound ? 'connected' : 'unknown'} ip={c.smpp_ip || 'YOUR_SERVER_IP'} port={assignedPort} isBound={isBound} />
                          <span className="text-xs text-muted-foreground font-mono">user: {c.smpp_username}</span>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">No SMPP credentials assigned yet</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7"
                        onClick={() => { setClientSmppDialog(c); setClientSmppForm({ smpp_username: c.smpp_username || '', smpp_password: c.smpp_password || '', smpp_port: c.smpp_port || (9096 + idx) }); }}>
                        <Plus className="w-3 h-3" />
                        {c.smpp_username ? 'Edit SMPP' : 'Provision SMPP'}
                      </Button>
                      {c.smpp_username && (
                        <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={() => { navigator.clipboard.writeText(clientSmppBlock(c, assignedPort)); toast.success("Client SMPP block copied!"); }}>
                          <Copy className="w-3 h-3" />Config
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {clients.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">No clients yet.</p>}
        </TabsContent>

        {/* ── KANNEL CONFIG TAB ───────────────────────────────────── */}
        <TabsContent value="kannel_config" className="mt-4 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800 flex-1">
              Full <code>kannel.conf</code> with all SMPP supplier + client blocks. Copy to <code>/etc/kannel/kannel.conf</code>, then reload kannel.
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={generateConfig} disabled={generatingConfig} className="gap-1.5">
                {generatingConfig ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Regenerate
              </Button>
              {generatedConfig && (
                <>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { navigator.clipboard.writeText(generatedConfig); toast.success("Full config copied!"); }}>
                    <Copy className="w-3.5 h-3.5" />Copy All
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5 text-orange-700 border-orange-300 hover:bg-orange-50" onClick={reloadKannel} disabled={reloading}>
                    {reloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                    Apply + Reload
                  </Button>
                </>
              )}
            </div>
          </div>

          {generatedConfig ? (
            <pre className="bg-gray-900 text-green-400 text-xs font-mono p-4 rounded-lg overflow-x-auto whitespace-pre max-h-[60vh] overflow-y-auto">{generatedConfig}</pre>
          ) : (
            <>
              {/* Individual supplier blocks */}
              {smsSuppliers.filter(s => s.connection_type === 'SMPP').map(s => (
                <div key={s.id} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground"># Supplier: {s.name}</p>
                    <Button size="sm" variant="ghost" className="gap-1 h-6 text-xs" onClick={() => { navigator.clipboard.writeText(supplierKannelBlock(s)); toast.success("Copied!"); }}>
                      <Copy className="w-3 h-3" />Copy
                    </Button>
                  </div>
                  <pre className="bg-gray-900 text-green-400 text-xs font-mono p-3 rounded overflow-x-auto">{supplierKannelBlock(s)}</pre>
                </div>
              ))}
              {smsSuppliers.filter(s => s.connection_type === 'SMPP').length === 0 && (
                <div className="text-center text-muted-foreground py-8 text-sm">
                  <p>Click "Generate Config" to build the full kannel.conf</p>
                </div>
              )}
            </>
          )}

          {/* Deploy commands */}
          <Card className="border-orange-200">
            <CardHeader className="pb-2"><CardTitle className="text-xs text-orange-800">Deploy Commands (run on Debian server as root)</CardTitle></CardHeader>
            <CardContent>
              <pre className="bg-gray-900 text-yellow-300 text-xs font-mono p-3 rounded overflow-x-auto">{`# 1. Backup current config
cp /etc/kannel/kannel.conf /etc/kannel/kannel.conf.bak.$(date +%Y%m%d)

# 2. Write new config (paste the generated config above)
nano /etc/kannel/kannel.conf

# 3. Reload bearerbox (NO DOWNTIME — keeps existing connections)
kill -HUP $(pidof bearerbox)

# 4. Verify new SMSCs connected
curl "http://localhost:13000/status?password=YOUR_ADMIN_PASS" | grep -i smsc

# 5. Check logs
tail -f /var/log/kannel/bearerbox.log`}</pre>
              <Button size="sm" variant="ghost" className="mt-2 gap-1 text-xs" onClick={() => { navigator.clipboard.writeText(`cp /etc/kannel/kannel.conf /etc/kannel/kannel.conf.bak.$(date +%Y%m%d)\nkill -HUP $(pidof bearerbox)\ncurl "http://localhost:13000/status?password=YOUR_ADMIN_PASS" | grep -i smsc`); toast.success("Commands copied!"); }}>
                <Copy className="w-3 h-3" />Copy Commands
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Add/Edit Supplier Dialog ──────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit' : 'Add'} SMPP Supplier</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2"><Label>Name *</Label><Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Nexmo_Main" /></div>
              <div className="space-y-1.5"><Label>Priority</Label><Input type="number" value={form.priority} onChange={e => set('priority', Number(e.target.value))} /></div>
              <div className="space-y-1.5"><Label>TPS Limit</Label><Input type="number" value={form.tps_limit} onChange={e => set('tps_limit', Number(e.target.value))} /></div>
            </div>

            <div className="p-3 bg-purple-50 border border-purple-100 rounded-lg space-y-3">
              <p className="text-xs font-semibold text-purple-800">SMPP Bind Configuration (Kannel → Supplier)</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>SMPP Host / IP *</Label><Input value={form.smpp_ip} onChange={e => set('smpp_ip', e.target.value)} placeholder="smpp.provider.com" /></div>
                <div className="space-y-1.5"><Label>Port</Label><Input type="number" value={form.smpp_port} onChange={e => set('smpp_port', Number(e.target.value))} /></div>
                <div className="space-y-1.5"><Label>System ID / Username *</Label><Input value={form.smpp_username} onChange={e => set('smpp_username', e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Password *</Label><Input type="password" value={form.smpp_password} onChange={e => set('smpp_password', e.target.value)} /></div>
                <div className="space-y-1.5">
                  <Label>System Type</Label>
                  <Select value={form.system_type} onValueChange={v => set('system_type', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SMPP">SMPP</SelectItem>
                      <SelectItem value="VMA">VMA</SelectItem>
                      <SelectItem value="CMT">CMT</SelectItem>
                      <SelectItem value={null}>Empty</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Bind Type</Label>
                  <Select value={form.bind_type} onValueChange={v => set('bind_type', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="transceiver">Transceiver (TRX) — recommended</SelectItem>
                      <SelectItem value="transmitter">Transmitter (TX only)</SelectItem>
                      <SelectItem value="receiver">Receiver (RX only)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5"><Label>DLR URL (optional)</Label><Input value={form.dlr_url} onChange={e => set('dlr_url', e.target.value)} placeholder="http://YOUR_SERVER_IP:5000/api/dlr?msgid=%i&status=%d" /></div>
            </div>

            <div className="space-y-1.5"><Label>Notes</Label><Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={updateSupplier.isPending || createSupplier.isPending}>
              {(updateSupplier.isPending || createSupplier.isPending) ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {editing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Client SMPP Provision Dialog ──────────────────────────── */}
      <Dialog open={!!clientSmppDialog} onOpenChange={() => setClientSmppDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Provision SMPP for: {clientSmppDialog?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-purple-50 border border-purple-100 rounded text-xs text-purple-800 space-y-1">
              <p className="font-semibold">This client will bind TO your Kannel bearerbox</p>
              <p>A <code>group = smpp-server</code> block will be added to kannel.conf for this client.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>System ID (username) *</Label><Input value={clientSmppForm.smpp_username} onChange={e => setClientSmppForm(p => ({ ...p, smpp_username: e.target.value }))} placeholder="client_user" /></div>
              <div className="space-y-1.5"><Label>Password *</Label><Input type="password" value={clientSmppForm.smpp_password} onChange={e => setClientSmppForm(p => ({ ...p, smpp_password: e.target.value }))} /></div>
              <div className="space-y-1.5 col-span-2"><Label>Kannel SMPP Server Port (client binds to this port)</Label><Input type="number" value={clientSmppForm.smpp_port} onChange={e => setClientSmppForm(p => ({ ...p, smpp_port: Number(e.target.value) }))} /></div>
            </div>
            <div className="p-2 bg-gray-900 rounded text-xs text-green-400 font-mono">
              {clientSmppDialog && clientSmppForm.smpp_username && clientSmppBlock(
                { ...clientSmppDialog, smpp_username: clientSmppForm.smpp_username, smpp_password: clientSmppForm.smpp_password },
                clientSmppForm.smpp_port
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClientSmppDialog(null)}>Cancel</Button>
            <Button onClick={provisionClientSmpp}>Save + Add to Kannel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}