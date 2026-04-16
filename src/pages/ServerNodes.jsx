import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { detectScript } from "@/lib/detectScript";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, Server, Database, Shield, Eye, EyeOff, Copy, Activity } from "lucide-react";
import { toast } from "sonner";

const empty = {
  label: "", server_ip: "", hostname: "", os: "Debian 12 bookworm",
  cpu: "", ram_gb: 0, disk_gb: 0,
  services: '["asterisk","kannel","mariadb","smpp"]',
  asterisk_version: "20.x", kannel_version: "1.4.x", mariadb_version: "10.11",
  sip_port: 5060, ami_port: 5038, smpp_port: 2775,
  kannel_port: 13013, db_port: 3306, ssh_port: 22,
  sip_bindings: "[]", connected_clients: 0, active_calls: 0,
  status: "online", platform_id: "",
  is_universal: true,
  db_host: "", db_name: "net2app", db_user: "net2app", db_password: "",
  notes: ""
};

const SERVICE_COLORS = {
  asterisk: "bg-orange-50 text-orange-700 border-orange-200",
  kannel: "bg-blue-50 text-blue-700 border-blue-200",
  mariadb: "bg-teal-50 text-teal-700 border-teal-200",
  smpp: "bg-purple-50 text-purple-700 border-purple-200",
};

export default function ServerNodes() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'admin';
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...empty });
  const [showPasswords, setShowPasswords] = useState({});
  const [tab, setTab] = useState("nodes");
  const qc = useQueryClient();

  const { data: nodes = [] } = useQuery({
    queryKey: ['server-nodes'],
    queryFn: () => base44.entities.ServerNode.list('-created_date'),
    initialData: [],
    refetchInterval: 30000,
  });

  const createMut = useMutation({ mutationFn: d => base44.entities.ServerNode.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['server-nodes'] }); setDialogOpen(false); toast.success("Server node added"); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }) => base44.entities.ServerNode.update(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['server-nodes'] }); setDialogOpen(false); toast.success("Updated"); } });
  const deleteMut = useMutation({ mutationFn: id => base44.entities.ServerNode.delete(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['server-nodes'] }); toast.success("Deleted"); } });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const handleSubmit = () => editing ? updateMut.mutate({ id: editing.id, data: form }) : createMut.mutate(form);

  const getServices = (n) => { try { return JSON.parse(n.services || '[]'); } catch { return []; } };
  const getSipBindings = (n) => { try { return JSON.parse(n.sip_bindings || '[]'); } catch { return []; } };
  const statusColor = s => s === 'online' ? 'bg-green-50 text-green-700 border-green-200' : s === 'offline' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200';

  const copyDbConn = (n) => {
    navigator.clipboard.writeText(`mysql -h ${n.db_host || n.server_ip} -P ${n.db_port} -u ${n.db_user} -p ${n.db_name}`);
    toast.success("DB connection string copied!");
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Server Nodes" description="Universal server management — Asterisk, Kannel, MariaDB, SMPP — all ports & connections">
        <Button onClick={() => { setEditing(null); setForm({ ...empty }); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />Register Server
        </Button>
      </PageHeader>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="nodes"><Server className="w-3.5 h-3.5 mr-1.5" />Nodes ({nodes.length})</TabsTrigger>
          <TabsTrigger value="detect"><Activity className="w-3.5 h-3.5 mr-1.5" />Auto-Detect Script</TabsTrigger>
          {isSuperAdmin && <TabsTrigger value="db"><Database className="w-3.5 h-3.5 mr-1.5" />DB Access (Super Admin)</TabsTrigger>}
        </TabsList>

        <TabsContent value="nodes" className="mt-4 space-y-4">
          {nodes.map(n => {
            const services = getServices(n);
            const bindings = getSipBindings(n);
            return (
              <Card key={n.id} className={`border-l-4 ${n.status === 'online' ? 'border-l-green-500' : n.status === 'offline' ? 'border-l-red-500' : 'border-l-yellow-400'}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-bold text-base">{n.label}</span>
                        <Badge variant="outline" className={statusColor(n.status)}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-1 ${n.status === 'online' ? 'bg-green-500 animate-pulse' : n.status === 'offline' ? 'bg-red-500' : 'bg-yellow-400'}`} />
                          {n.status}
                        </Badge>
                        {n.is_universal && <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Universal</Badge>}
                        {services.map(s => <Badge key={s} variant="outline" className={`text-xs ${SERVICE_COLORS[s] || ''}`}>{s}</Badge>)}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Server IP</p>
                          <p className="font-mono font-bold">{n.server_ip}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">OS / Hardware</p>
                          <p className="text-xs">{n.os}</p>
                          <p className="text-xs text-muted-foreground">{n.cpu} | {n.ram_gb}GB RAM | {n.disk_gb}GB</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Versions</p>
                          {n.asterisk_version && <p className="text-xs">Asterisk {n.asterisk_version}</p>}
                          {n.kannel_version && <p className="text-xs">Kannel {n.kannel_version}</p>}
                          {n.mariadb_version && <p className="text-xs">MariaDB {n.mariadb_version}</p>}
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Active</p>
                          <p className="text-sm font-bold">{n.active_calls || 0} calls / {n.connected_clients || 0} clients</p>
                        </div>
                      </div>

                      {/* Port badges */}
                      <div className="flex flex-wrap gap-2">
                        {[
                          { label: "SIP", port: n.sip_port, color: "bg-orange-50 border-orange-200 text-orange-700" },
                          { label: "AMI", port: n.ami_port, color: "bg-yellow-50 border-yellow-200 text-yellow-700" },
                          { label: "SMPP", port: n.smpp_port, color: "bg-purple-50 border-purple-200 text-purple-700" },
                          { label: "Kannel", port: n.kannel_port, color: "bg-blue-50 border-blue-200 text-blue-700" },
                          { label: "MySQL", port: n.db_port, color: "bg-teal-50 border-teal-200 text-teal-700" },
                          { label: "SSH", port: n.ssh_port, color: "bg-gray-50 border-gray-200 text-gray-700" },
                        ].map(p => (
                          <div key={p.label} className={`flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-mono font-medium ${p.color}`}>
                            <span className="font-sans font-semibold">{p.label}:</span>{p.port}
                          </div>
                        ))}
                      </div>

                      {/* SIP Bindings */}
                      {bindings.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">SIP Bindings / Connected Peers</p>
                          <div className="flex flex-wrap gap-1">
                            {bindings.map((b, i) => <Badge key={i} variant="outline" className="text-xs font-mono bg-orange-50 text-orange-700 border-orange-200">{b}</Badge>)}
                          </div>
                        </div>
                      )}

                      {/* DB info for super admin */}
                      {isSuperAdmin && n.db_host && (
                        <div className="flex items-center gap-2 p-2 bg-teal-50 border border-teal-200 rounded text-xs">
                          <Database className="w-3.5 h-3.5 text-teal-600" />
                          <span className="font-mono text-teal-800">mysql -h {n.db_host || n.server_ip} -P {n.db_port} -u {n.db_user} -p {n.db_name}</span>
                          <Button size="sm" variant="ghost" className="h-5 px-1 ml-auto" onClick={() => copyDbConn(n)}><Copy className="w-3 h-3" /></Button>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-1 shrink-0">
                      <Button variant="outline" size="icon" onClick={() => { setEditing(n); setForm({ ...empty, ...n }); setDialogOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                      {isSuperAdmin && <Button variant="ghost" size="icon" onClick={() => deleteMut.mutate(n.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {nodes.length === 0 && (
            <Card className="p-12 text-center text-muted-foreground">
              <Server className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p>No servers registered. Use "Register Server" or run the auto-detect script.</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="detect" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Auto-Detection Script — Debian 12</CardTitle>
              <p className="text-xs text-muted-foreground">Run on your server to auto-detect IP, OS, hardware, and installed services.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <pre className="bg-gray-900 text-green-400 rounded-lg p-4 text-xs font-mono overflow-x-auto whitespace-pre">{detectScript}</pre>
                <Button size="sm" variant="ghost" className="absolute top-2 right-2 text-gray-400 hover:text-white gap-1"
                  onClick={() => { navigator.clipboard.writeText(detectScript); toast.success("Script copied!"); }}>
                  <Copy className="w-3 h-3" />Copy
                </Button>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800 space-y-1">
                <p className="font-semibold">How to use:</p>
                <p>1. SSH into your Debian 12 server</p>
                <p>2. Run: <code className="bg-blue-100 px-1 rounded">sudo bash detect.sh</code></p>
                <p>3. Copy the JSON output and paste into "Register Server" form</p>
                <p>4. The system will track all ports, services and hardware automatically</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {isSuperAdmin && (
          <TabsContent value="db" className="mt-4">
            <div className="p-3 bg-yellow-50 border border-yellow-300 rounded-lg text-sm text-yellow-800 mb-4 flex gap-2">
              <Shield className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Super Admin only. Database credentials are visible only to admins. Only admins can change DB access.</span>
            </div>
            <div className="space-y-3">
              {nodes.map(n => (
                <Card key={n.id} className="border-l-4 border-l-teal-500">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{n.label} <span className="font-mono text-muted-foreground text-xs ml-2">{n.server_ip}</span></p>
                      <Button size="sm" variant="outline" onClick={() => { setEditing(n); setForm({ ...empty, ...n }); setDialogOpen(true); }}><Pencil className="w-3.5 h-3.5 mr-1" />Edit DB</Button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                      <div><p className="text-xs text-muted-foreground">DB Host</p><p className="font-mono">{n.db_host || n.server_ip}</p></div>
                      <div><p className="text-xs text-muted-foreground">Database</p><p className="font-mono">{n.db_name}</p></div>
                      <div><p className="text-xs text-muted-foreground">User</p><p className="font-mono">{n.db_user}</p></div>
                      <div>
                        <p className="text-xs text-muted-foreground">Password</p>
                        <div className="flex items-center gap-1">
                          <p className="font-mono text-xs">{showPasswords[n.id] ? (n.db_password || '—') : '••••••••'}</p>
                          <button onClick={() => setShowPasswords(p => ({ ...p, [n.id]: !p[n.id] }))} className="text-muted-foreground hover:text-foreground">
                            {showPasswords[n.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-teal-50 border border-teal-200 rounded text-xs">
                      <span className="font-mono text-teal-800">mysql -h {n.db_host || n.server_ip} -P {n.db_port || 3306} -u {n.db_user} -p {n.db_name}</span>
                      <Button size="sm" variant="ghost" className="h-5 px-1 ml-auto" onClick={() => copyDbConn(n)}><Copy className="w-3 h-3" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Server Node' : 'Register Server Node'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Label *</Label><Input value={form.label} onChange={e => set('label', e.target.value)} placeholder="Main VoIP Server" /></div>
              <div className="space-y-1.5"><Label>Server IP *</Label><Input value={form.server_ip} onChange={e => set('server_ip', e.target.value)} placeholder="192.168.1.10" /></div>
              <div className="space-y-1.5"><Label>Hostname</Label><Input value={form.hostname} onChange={e => set('hostname', e.target.value)} /></div>
              <div className="space-y-1.5"><Label>OS</Label><Input value={form.os} onChange={e => set('os', e.target.value)} placeholder="Debian 12 bookworm" /></div>
              <div className="space-y-1.5"><Label>CPU</Label><Input value={form.cpu} onChange={e => set('cpu', e.target.value)} placeholder="Intel Xeon E5-2680" /></div>
              <div className="space-y-1.5"><Label>RAM (GB)</Label><Input type="number" value={form.ram_gb} onChange={e => set('ram_gb', Number(e.target.value))} /></div>
              <div className="space-y-1.5"><Label>Disk (GB)</Label><Input type="number" value={form.disk_gb} onChange={e => set('disk_gb', Number(e.target.value))} /></div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => set('status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="offline">Offline</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="p-3 bg-orange-50 border border-orange-100 rounded-lg space-y-3">
              <p className="text-xs font-semibold text-orange-800">Service Versions & Ports</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5"><Label>Asterisk Ver.</Label><Input value={form.asterisk_version} onChange={e => set('asterisk_version', e.target.value)} placeholder="20.x" /></div>
                <div className="space-y-1.5"><Label>Kannel Ver.</Label><Input value={form.kannel_version} onChange={e => set('kannel_version', e.target.value)} placeholder="1.4.x" /></div>
                <div className="space-y-1.5"><Label>MariaDB Ver.</Label><Input value={form.mariadb_version} onChange={e => set('mariadb_version', e.target.value)} placeholder="10.11" /></div>
                <div className="space-y-1.5"><Label>SIP Port</Label><Input type="number" value={form.sip_port} onChange={e => set('sip_port', Number(e.target.value))} /></div>
                <div className="space-y-1.5"><Label>AMI Port</Label><Input type="number" value={form.ami_port} onChange={e => set('ami_port', Number(e.target.value))} /></div>
                <div className="space-y-1.5"><Label>SMPP Port</Label><Input type="number" value={form.smpp_port} onChange={e => set('smpp_port', Number(e.target.value))} /></div>
                <div className="space-y-1.5"><Label>Kannel Port</Label><Input type="number" value={form.kannel_port} onChange={e => set('kannel_port', Number(e.target.value))} /></div>
                <div className="space-y-1.5"><Label>MySQL Port</Label><Input type="number" value={form.db_port} onChange={e => set('db_port', Number(e.target.value))} /></div>
                <div className="space-y-1.5"><Label>SSH Port</Label><Input type="number" value={form.ssh_port} onChange={e => set('ssh_port', Number(e.target.value))} /></div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Services (JSON array)</Label>
              <Input value={form.services} onChange={e => set('services', e.target.value)} placeholder='["asterisk","kannel","mariadb","smpp"]' />
            </div>

            <div className="space-y-1.5">
              <Label>SIP Bindings (JSON array of connected peers)</Label>
              <Input value={form.sip_bindings} onChange={e => set('sip_bindings', e.target.value)} placeholder='["client1@192.168.1.5:5060","trunk1@sip.provider.com"]' />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Active Calls</Label><Input type="number" value={form.active_calls} onChange={e => set('active_calls', Number(e.target.value))} /></div>
              <div className="space-y-1.5"><Label>Connected Clients</Label><Input type="number" value={form.connected_clients} onChange={e => set('connected_clients', Number(e.target.value))} /></div>
            </div>

            {isSuperAdmin && (
              <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg space-y-3">
                <p className="text-xs font-semibold text-teal-800 flex items-center gap-1"><Shield className="w-3.5 h-3.5" />Database Access (Super Admin Only)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>DB Host</Label><Input value={form.db_host} onChange={e => set('db_host', e.target.value)} placeholder="localhost or IP" /></div>
                  <div className="space-y-1.5"><Label>DB Name</Label><Input value={form.db_name} onChange={e => set('db_name', e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>DB User</Label><Input value={form.db_user} onChange={e => set('db_user', e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>DB Password</Label><Input type="password" value={form.db_password} onChange={e => set('db_password', e.target.value)} /></div>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="is_universal" checked={form.is_universal} onChange={e => set('is_universal', e.target.checked)} />
                  <Label htmlFor="is_universal">Universal server (shared database for all services)</Label>
                </div>
              </div>
            )}

            <div className="space-y-1.5"><Label>Notes</Label><Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit}>{editing ? 'Update' : 'Register'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}