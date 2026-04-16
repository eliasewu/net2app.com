import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Server, Database, MessageSquare, Phone, Wifi } from "lucide-react";
import { toast } from "sonner";

const empty = {
  name: "", platform_type: "asterisk", version: "Asterisk 20.x",
  host: "", sip_port: 5060,
  agi_host: "", ami_port: 5038, ami_username: "admin", ami_password: "", ami_secret: "",
  db_host: "localhost", db_port: 3306, db_name: "asterisk", db_user: "asterisk", db_password: "",
  kannel_host: "localhost", kannel_port: 13013, kannel_admin_port: 13000, kannel_username: "", kannel_password: "",
  smpp_server_host: "0.0.0.0", smpp_server_port: 2775, smpp_server_username: "", smpp_server_password: "",
  debian_host: "", debian_ssh_port: 22, deploy_mode: "both",
  require_auth: false, status: "active", notes: ""
};

export default function VoipPlatformSetup({ platforms }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...empty });
  const [formTab, setFormTab] = useState("sip");
  const qc = useQueryClient();

  const createMut = useMutation({
    mutationFn: d => base44.entities.VoipPlatform.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['voip-platforms'] }); setDialogOpen(false); toast.success("Platform added"); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.VoipPlatform.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['voip-platforms'] }); setDialogOpen(false); toast.success("Updated"); },
  });
  const deleteMut = useMutation({
    mutationFn: id => base44.entities.VoipPlatform.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['voip-platforms'] }); toast.success("Deleted"); },
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const handleSubmit = () => editing ? updateMut.mutate({ id: editing.id, data: form }) : createMut.mutate(form);

  const typeColor = (t) => t === 'asterisk' ? "bg-orange-50 text-orange-700 border-orange-200" : t === 'freepbx' ? "bg-red-50 text-red-700 border-red-200" : t === 'freeswitch' ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-purple-50 text-purple-700 border-purple-200";
  const statusColor = (s) => s === 'active' ? "bg-green-50 text-green-700 border-green-200" : s === 'error' ? "bg-red-50 text-red-700 border-red-200" : "bg-gray-100 text-gray-600";

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setForm({ ...empty }); setFormTab("sip"); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />Add Platform
        </Button>
      </div>

      <div className="grid gap-4">
        {platforms.map(p => (
          <Card key={p.id} className="border-l-4" style={{ borderLeftColor: p.platform_type === 'asterisk' ? '#f97316' : p.platform_type === 'freepbx' ? '#ef4444' : '#3b82f6' }}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-bold text-base">{p.name}</span>
                    <Badge variant="outline" className={typeColor(p.platform_type)}>{p.platform_type?.toUpperCase()}</Badge>
                    <Badge variant="outline" className={statusColor(p.status)}>{p.status}</Badge>
                    {p.version && <span className="text-xs text-muted-foreground">{p.version}</span>}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 text-sm">
                    <div><span className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" />SIP</span><span className="font-mono">{p.host}:{p.sip_port}</span></div>
                    {p.ami_port && <div><span className="text-xs text-muted-foreground flex items-center gap-1"><Wifi className="w-3 h-3" />AMI</span><span className="font-mono">{p.agi_host || p.host}:{p.ami_port}</span></div>}
                    {p.db_host && <div><span className="text-xs text-muted-foreground flex items-center gap-1"><Database className="w-3 h-3" />DB</span><span className="font-mono">{p.db_host}/{p.db_name}</span></div>}
                    {p.kannel_host && <div><span className="text-xs text-muted-foreground flex items-center gap-1"><MessageSquare className="w-3 h-3" />Kannel</span><span className="font-mono">{p.kannel_host}:{p.kannel_port}</span></div>}
                    {p.smpp_server_port && <div><span className="text-xs text-muted-foreground">SMPP</span><span className="font-mono ml-1">{p.smpp_server_host}:{p.smpp_server_port}</span></div>}
                    {p.debian_host && <div><span className="text-xs text-muted-foreground">Deploy</span><span className="font-mono ml-1">{p.debian_host}</span></div>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="outline" size="icon" onClick={() => { setEditing(p); setForm({ ...empty, ...p }); setFormTab("sip"); setDialogOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteMut.mutate(p.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {platforms.length === 0 && (
          <Card className="p-12 text-center text-muted-foreground">
            <Server className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p>No VoIP platforms configured. Add your Asterisk 20+ or FreePBX server.</p>
          </Card>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Platform' : 'Add VoIP Platform'}</DialogTitle></DialogHeader>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="space-y-1.5"><Label>Name *</Label><Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Main Asterisk" /></div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.platform_type} onValueChange={v => set('platform_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="asterisk">Asterisk 20+</SelectItem>
                  <SelectItem value="freepbx">FreePBX</SelectItem>
                  <SelectItem value="freeswitch">FreeSWITCH</SelectItem>
                  <SelectItem value="sip">Custom SIP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Version</Label><Input value={form.version} onChange={e => set('version', e.target.value)} placeholder="Asterisk 20.x" /></div>
            <div className="space-y-1.5">
              <Label>Deploy Mode</Label>
              <Select value={form.deploy_mode} onValueChange={v => set('deploy_mode', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Voice + SMS</SelectItem>
                  <SelectItem value="voice_only">Voice Only</SelectItem>
                  <SelectItem value="sms_only">SMS Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Tabs value={formTab} onValueChange={setFormTab}>
            <TabsList className="grid grid-cols-4">
              <TabsTrigger value="sip">SIP / AMI</TabsTrigger>
              <TabsTrigger value="db">Database</TabsTrigger>
              <TabsTrigger value="kannel">Kannel SMS</TabsTrigger>
              <TabsTrigger value="smpp">SMPP</TabsTrigger>
            </TabsList>

            <TabsContent value="sip" className="space-y-3 mt-3">
              <div className="p-3 bg-orange-50 border border-orange-100 rounded-lg space-y-3">
                <p className="text-xs font-semibold text-orange-800">SIP Server (Asterisk)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Host / IP *</Label><Input value={form.host} onChange={e => set('host', e.target.value)} placeholder="192.168.1.10" /></div>
                  <div className="space-y-1.5"><Label>SIP Port</Label><Input type="number" value={form.sip_port} onChange={e => set('sip_port', Number(e.target.value))} /></div>
                  <div className="space-y-1.5"><Label>Debian 12 Server IP</Label><Input value={form.debian_host} onChange={e => set('debian_host', e.target.value)} placeholder="192.168.1.10" /></div>
                  <div className="space-y-1.5"><Label>SSH Port</Label><Input type="number" value={form.debian_ssh_port} onChange={e => set('debian_ssh_port', Number(e.target.value))} /></div>
                </div>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg space-y-3">
                <p className="text-xs font-semibold text-blue-800">AMI (Asterisk Manager Interface)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>AMI Host</Label><Input value={form.agi_host} onChange={e => set('agi_host', e.target.value)} placeholder="same as SIP host" /></div>
                  <div className="space-y-1.5"><Label>AMI Port</Label><Input type="number" value={form.ami_port} onChange={e => set('ami_port', Number(e.target.value))} /></div>
                  <div className="space-y-1.5"><Label>AMI Username</Label><Input value={form.ami_username} onChange={e => set('ami_username', e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>AMI Secret</Label><Input type="password" value={form.ami_secret} onChange={e => set('ami_secret', e.target.value)} /></div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="db" className="space-y-3 mt-3">
              <div className="p-3 bg-green-50 border border-green-100 rounded-lg space-y-3">
                <p className="text-xs font-semibold text-green-800">MariaDB / MySQL (Debian 12)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>DB Host</Label><Input value={form.db_host} onChange={e => set('db_host', e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Port</Label><Input type="number" value={form.db_port} onChange={e => set('db_port', Number(e.target.value))} /></div>
                  <div className="space-y-1.5"><Label>Database Name</Label><Input value={form.db_name} onChange={e => set('db_name', e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Username</Label><Input value={form.db_user} onChange={e => set('db_user', e.target.value)} /></div>
                  <div className="col-span-2 space-y-1.5"><Label>Password</Label><Input type="password" value={form.db_password} onChange={e => set('db_password', e.target.value)} /></div>
                </div>
                <div className="text-xs text-green-700 font-mono bg-green-100 p-2 rounded">
                  mysql -h {form.db_host} -u {form.db_user} -p {form.db_name}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="kannel" className="space-y-3 mt-3">
              <div className="p-3 bg-sky-50 border border-sky-100 rounded-lg space-y-3">
                <p className="text-xs font-semibold text-sky-800">Kannel SMS Gateway (Debian 12)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Kannel Host</Label><Input value={form.kannel_host} onChange={e => set('kannel_host', e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Send Port</Label><Input type="number" value={form.kannel_port} onChange={e => set('kannel_port', Number(e.target.value))} /></div>
                  <div className="space-y-1.5"><Label>Admin Port</Label><Input type="number" value={form.kannel_admin_port} onChange={e => set('kannel_admin_port', Number(e.target.value))} /></div>
                  <div className="space-y-1.5"><Label>Username</Label><Input value={form.kannel_username} onChange={e => set('kannel_username', e.target.value)} /></div>
                  <div className="col-span-2 space-y-1.5"><Label>Password</Label><Input type="password" value={form.kannel_password} onChange={e => set('kannel_password', e.target.value)} /></div>
                </div>
                <div className="text-xs font-mono bg-sky-100 p-2 rounded text-sky-800">
                  http://{form.kannel_host}:{form.kannel_port}/cgi-bin/sendsms?user={form.kannel_username}&pass=***
                </div>
              </div>
            </TabsContent>

            <TabsContent value="smpp" className="space-y-3 mt-3">
              <div className="p-3 bg-purple-50 border border-purple-100 rounded-lg space-y-3">
                <p className="text-xs font-semibold text-purple-800">SMPP Server (act as client & server)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Bind Address</Label><Input value={form.smpp_server_host} onChange={e => set('smpp_server_host', e.target.value)} placeholder="0.0.0.0" /></div>
                  <div className="space-y-1.5"><Label>SMPP Port</Label><Input type="number" value={form.smpp_server_port} onChange={e => set('smpp_server_port', Number(e.target.value))} /></div>
                  <div className="space-y-1.5"><Label>System ID</Label><Input value={form.smpp_server_username} onChange={e => set('smpp_server_username', e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Password</Label><Input type="password" value={form.smpp_server_password} onChange={e => set('smpp_server_password', e.target.value)} /></div>
                </div>
                <p className="text-xs text-purple-700">SMPP server runs on Debian 12 alongside Kannel. Acts both as client (upstream) and server (for client connections).</p>
              </div>
            </TabsContent>
          </Tabs>

          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Notes</Label><Input value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit}>{editing ? 'Update' : 'Add Platform'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}