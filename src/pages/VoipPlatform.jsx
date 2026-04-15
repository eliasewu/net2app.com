import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, Server, Phone, Wifi, Activity } from "lucide-react";
import { toast } from "sonner";

const empty = {
  name: "", platform_type: "asterisk", sip_server: "", sip_port: 5060,
  sip_username: "", sip_password: "", require_auth: false,
  description: "", status: "active", notes: ""
};

export default function VoipPlatform() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...empty });
  const qc = useQueryClient();

  const { data: platforms = [] } = useQuery({
    queryKey: ['voip-platforms'],
    queryFn: () => base44.entities.VoipPlatform.list('-created_date'),
    initialData: [],
  });

  const createMut = useMutation({
    mutationFn: d => base44.entities.VoipPlatform.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['voip-platforms'] }); setDialogOpen(false); toast.success("VoIP platform added"); },
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

  const handleSubmit = () => {
    if (editing) updateMut.mutate({ id: editing.id, data: form });
    else createMut.mutate(form);
  };

  const getPlatformColor = (type) => {
    if (type === "asterisk") return "bg-orange-50 text-orange-700 border-orange-200";
    if (type === "freeswitch") return "bg-blue-50 text-blue-700 border-blue-200";
    return "bg-purple-50 text-purple-700 border-purple-200";
  };

  return (
    <div className="space-y-6">
      <PageHeader title="VoIP Platform" description="Manage Asterisk, FreeSWITCH and SIP servers for Voice OTP routing">
        <Button onClick={() => { setEditing(null); setForm({ ...empty }); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />Add Platform
        </Button>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-orange-50 border border-orange-200"><Server className="w-5 h-5 text-orange-600" /></div>
            <div><p className="text-sm text-muted-foreground">Asterisk</p><p className="text-2xl font-bold">{platforms.filter(p => p.platform_type === 'asterisk').length}</p></div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200"><Phone className="w-5 h-5 text-blue-600" /></div>
            <div><p className="text-sm text-muted-foreground">SIP Servers</p><p className="text-2xl font-bold">{platforms.filter(p => p.platform_type === 'sip').length}</p></div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-green-50 border border-green-200"><Activity className="w-5 h-5 text-green-600" /></div>
            <div><p className="text-sm text-muted-foreground">Active</p><p className="text-2xl font-bold">{platforms.filter(p => p.status === 'active').length}</p></div>
          </div>
        </Card>
      </div>

      {/* Info banner */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex gap-3 items-start">
        <Wifi className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-blue-800">SIP Server Configuration</p>
          <p className="text-xs text-blue-700 mt-1">
            Voice OTP calls are routed through the SIP server via IP and Port. No authentication required by default — 
            simply set the SIP server IP and port. Calls will pass directly to the configured Asterisk/SIP instance.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Server className="w-4 h-4" />VoIP Platforms
            <Badge variant="outline">{platforms.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>SIP Server</TableHead>
                <TableHead>Port</TableHead>
                <TableHead>Auth</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {platforms.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getPlatformColor(p.platform_type)}>
                      {p.platform_type === 'asterisk' ? 'Asterisk' : p.platform_type === 'freeswitch' ? 'FreeSWITCH' : 'SIP'}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{p.sip_server}</TableCell>
                  <TableCell className="font-mono">{p.sip_port}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={p.require_auth ? "bg-yellow-50 text-yellow-700" : "bg-gray-100 text-gray-600"}>
                      {p.require_auth ? "Required" : "None"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={p.status === 'active' ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-600"}>
                      {p.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(p); setForm({ ...empty, ...p }); setDialogOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMut.mutate(p.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {platforms.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                  No VoIP platforms yet. Add your Asterisk or SIP server.
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Edit VoIP Platform' : 'Add VoIP Platform'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Platform Name *</Label><Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Main Asterisk" /></div>
              <div className="space-y-1.5">
                <Label>Platform Type</Label>
                <Select value={form.platform_type} onValueChange={v => set('platform_type', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asterisk">Asterisk</SelectItem>
                    <SelectItem value="freeswitch">FreeSWITCH</SelectItem>
                    <SelectItem value="sip">Custom SIP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg space-y-3">
              <p className="text-xs font-semibold text-orange-800">SIP Connection</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>SIP Server IP / Host *</Label><Input value={form.sip_server} onChange={e => set('sip_server', e.target.value)} placeholder="192.168.1.100" /></div>
                <div className="space-y-1.5"><Label>Port</Label><Input type="number" value={form.sip_port} onChange={e => set('sip_port', Number(e.target.value))} /></div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="require_auth" checked={form.require_auth} onChange={e => set('require_auth', e.target.checked)} className="rounded" />
                <Label htmlFor="require_auth" className="cursor-pointer">Require Authentication</Label>
              </div>
              {form.require_auth && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>SIP Username</Label><Input value={form.sip_username} onChange={e => set('sip_username', e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>SIP Password</Label><Input type="password" value={form.sip_password} onChange={e => set('sip_password', e.target.value)} /></div>
                </div>
              )}
              {!form.require_auth && <p className="text-xs text-orange-700">No authentication — calls route directly via IP:Port to SIP server.</p>}
            </div>

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
            <div className="space-y-1.5"><Label>Notes</Label><Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} /></div>
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