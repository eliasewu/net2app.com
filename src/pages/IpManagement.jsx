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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Shield, ShieldOff, Eye, Globe, Lock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const LIST_TYPES = [
  { value: "whitelist", label: "IP Whitelist", icon: Shield, color: "bg-green-50 text-green-700 border-green-200" },
  { value: "blacklist", label: "IP Blacklist", icon: ShieldOff, color: "bg-red-50 text-red-700 border-red-200" },
  { value: "web_blacklist", label: "Web Login Blacklist", icon: Lock, color: "bg-orange-50 text-orange-700 border-orange-200" },
  { value: "unaudited", label: "Unaudited IPs", icon: Eye, color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
];

export default function IpManagement() {
  const [tab, setTab] = useState("whitelist");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ip_address: "", list_type: "whitelist", entity_type: "global", entity_id: "", entity_name: "", description: "", is_active: true });
  const qc = useQueryClient();

  const { data: ips = [] } = useQuery({ queryKey: ["ip-access"], queryFn: () => base44.entities.IpAccess.list("-created_date", 200), initialData: [] });
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: () => base44.entities.Client.list(), initialData: [] });
  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers"], queryFn: () => base44.entities.Supplier.list(), initialData: [] });

  const createMut = useMutation({ mutationFn: d => base44.entities.IpAccess.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["ip-access"] }); setDialogOpen(false); toast.success("IP added"); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }) => base44.entities.IpAccess.update(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ["ip-access"] }); setDialogOpen(false); toast.success("Updated"); } });
  const deleteMut = useMutation({ mutationFn: id => base44.entities.IpAccess.delete(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ["ip-access"] }); toast.success("Deleted"); } });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = () => {
    const entityList = form.entity_type === "client" ? clients : form.entity_type === "supplier" ? suppliers : [];
    const entity = entityList.find(e => e.id === form.entity_id);
    const data = { ...form, entity_name: entity?.name || "" };
    if (editing) updateMut.mutate({ id: editing.id, data });
    else createMut.mutate(data);
  };

  const filtered = ips.filter(ip => ip.list_type === tab);
  const currentType = LIST_TYPES.find(l => l.value === tab);

  const countByType = (type) => ips.filter(i => i.list_type === type).length;

  return (
    <div className="space-y-6">
      <PageHeader title="IP Management" description="Whitelist, blacklist, web login blocks and unaudited IP tracking">
        <Button onClick={() => { setEditing(null); setForm({ ip_address: "", list_type: tab, entity_type: "global", entity_id: "", entity_name: "", description: "", is_active: true }); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />Add IP
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {LIST_TYPES.map(t => (
          <Card key={t.value} className={`cursor-pointer transition-all hover:shadow-md ${tab === t.value ? "ring-2 ring-primary" : ""}`} onClick={() => setTab(t.value)}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg border ${t.color}`}><t.icon className="w-4 h-4" /></div>
              <div>
                <p className="text-xs text-muted-foreground">{t.label}</p>
                <p className="text-xl font-bold">{countByType(t.value)}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            {currentType && <currentType.icon className="w-4 h-4" />}{currentType?.label}
            <Badge variant="outline">{filtered.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>IP Address</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead>Hits</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(ip => (
                <TableRow key={ip.id}>
                  <TableCell className="font-mono font-semibold">{ip.ip_address}</TableCell>
                  <TableCell>
                    {ip.entity_name ? <span>{ip.entity_name} <span className="text-xs text-muted-foreground">({ip.entity_type})</span></span> : <span className="text-muted-foreground italic">Global</span>}
                  </TableCell>
                  <TableCell><Badge variant="outline" className="text-xs capitalize">{ip.entity_type}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{ip.description}</TableCell>
                  <TableCell className="text-xs">{ip.last_seen ? format(new Date(ip.last_seen), "MMM d HH:mm") : "—"}</TableCell>
                  <TableCell>{ip.hit_count || 0}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={ip.is_active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}>
                      {ip.is_active ? "Yes" : "No"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(ip); setForm({ ...ip }); setDialogOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMut.mutate(ip.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-12">No IPs in this list</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit IP Entry" : "Add IP Entry"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1"><Label>IP Address *</Label><Input value={form.ip_address} onChange={e => set("ip_address", e.target.value)} placeholder="192.168.1.1 or 10.0.0.0/24" /></div>
            <div className="space-y-1">
              <Label>List Type</Label>
              <Select value={form.list_type} onValueChange={v => set("list_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LIST_TYPES.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Entity Type</Label>
              <Select value={form.entity_type} onValueChange={v => set("entity_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="supplier">Supplier</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(form.entity_type === "client" || form.entity_type === "supplier") && (
              <div className="space-y-1">
                <Label>{form.entity_type === "client" ? "Client" : "Supplier"}</Label>
                <Select value={form.entity_id} onValueChange={v => set("entity_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>{(form.entity_type === "client" ? clients : suppliers).map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1"><Label>Description</Label><Input value={form.description} onChange={e => set("description", e.target.value)} /></div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={form.is_active} onChange={e => set("is_active", e.target.checked)} id="is_active" />
              <Label htmlFor="is_active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit}>{editing ? "Update" : "Add IP"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}