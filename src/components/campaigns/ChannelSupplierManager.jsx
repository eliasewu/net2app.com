import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, MessageSquare, Phone, Send, Zap } from "lucide-react";
import { toast } from "sonner";

const CHANNEL_META = {
  whatsapp: { icon: Phone, color: "bg-green-50 text-green-700 border-green-200", label: "WhatsApp Business API", fields: ["api_url", "api_key", "phone_number_id"] },
  telegram: { icon: Send, color: "bg-sky-50 text-sky-700 border-sky-200", label: "Telegram Bot", fields: ["bot_token", "api_url"] },
  viber: { icon: Zap, color: "bg-purple-50 text-purple-700 border-purple-200", label: "Viber Business", fields: ["api_key", "sender_id", "api_url"] },
  imo: { icon: Phone, color: "bg-orange-50 text-orange-700 border-orange-200", label: "IMO Business", fields: ["api_key", "api_url"] },
};

export default function ChannelSupplierManager() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", channel: "whatsapp", api_key: "", api_secret: "", api_url: "", phone_number_id: "", bot_token: "", sender_id: "", status: "active", config: "", notes: "" });
  const qc = useQueryClient();

  const { data: suppliers = [] } = useQuery({ queryKey: ["channel-suppliers"], queryFn: () => base44.entities.ChannelSupplier.list(), initialData: [] });

  const createMut = useMutation({ mutationFn: d => base44.entities.ChannelSupplier.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["channel-suppliers"] }); setDialogOpen(false); toast.success("Channel supplier added"); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }) => base44.entities.ChannelSupplier.update(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ["channel-suppliers"] }); setDialogOpen(false); toast.success("Updated"); } });
  const deleteMut = useMutation({ mutationFn: id => base44.entities.ChannelSupplier.delete(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ["channel-suppliers"] }); toast.success("Deleted"); } });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const meta = CHANNEL_META[form.channel];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-semibold">Channel Suppliers</h3>
          <p className="text-sm text-muted-foreground">Add API credentials for WhatsApp, Telegram, Viber, IMO</p>
        </div>
        <Button onClick={() => { setEditing(null); setForm({ name: "", channel: "whatsapp", api_key: "", api_secret: "", api_url: "", phone_number_id: "", bot_token: "", sender_id: "", status: "active", config: "", notes: "" }); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />Add Channel Supplier
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(CHANNEL_META).map(([channel, m]) => {
          const channelSuppliers = suppliers.filter(s => s.channel === channel);
          return (
            <Card key={channel}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Badge variant="outline" className={`${m.color} text-xs`}><m.icon className="w-3 h-3 mr-1" />{channel.toUpperCase()}</Badge>
                  {m.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {channelSuppliers.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No supplier configured</p>
                ) : (
                  <div className="space-y-2">
                    {channelSuppliers.map(s => (
                      <div key={s.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                        <div>
                          <p className="font-medium text-sm">{s.name}</p>
                          <p className="text-xs text-muted-foreground">{s.api_url || s.bot_token?.slice(0, 20) + "..."}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => { setEditing(s); setForm({ ...s }); setDialogOpen(true); }}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteMut.mutate(s.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Channel Supplier" : "Add Channel Supplier"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1"><Label>Name *</Label><Input value={form.name} onChange={e => set("name", e.target.value)} /></div>
            <div className="space-y-1">
              <Label>Channel *</Label>
              <Select value={form.channel} onValueChange={v => set("channel", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp Business</SelectItem>
                  <SelectItem value="telegram">Telegram Bot</SelectItem>
                  <SelectItem value="viber">Viber Business</SelectItem>
                  <SelectItem value="imo">IMO Business</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.channel === "whatsapp" && <>
              <div className="space-y-1"><Label>API URL</Label><Input value={form.api_url} onChange={e => set("api_url", e.target.value)} placeholder="https://graph.facebook.com/v18.0" /></div>
              <div className="space-y-1"><Label>API Key / Access Token</Label><Input value={form.api_key} onChange={e => set("api_key", e.target.value)} /></div>
              <div className="space-y-1"><Label>Phone Number ID</Label><Input value={form.phone_number_id} onChange={e => set("phone_number_id", e.target.value)} /></div>
            </>}
            {form.channel === "telegram" && <>
              <div className="space-y-1"><Label>Bot Token</Label><Input value={form.bot_token} onChange={e => set("bot_token", e.target.value)} placeholder="123456:ABC-DEF..." /></div>
              <div className="space-y-1"><Label>API URL (optional)</Label><Input value={form.api_url} onChange={e => set("api_url", e.target.value)} placeholder="https://api.telegram.org" /></div>
            </>}
            {(form.channel === "viber" || form.channel === "imo") && <>
              <div className="space-y-1"><Label>API Key</Label><Input value={form.api_key} onChange={e => set("api_key", e.target.value)} /></div>
              <div className="space-y-1"><Label>Sender ID</Label><Input value={form.sender_id} onChange={e => set("sender_id", e.target.value)} /></div>
              <div className="space-y-1"><Label>API URL</Label><Input value={form.api_url} onChange={e => set("api_url", e.target.value)} /></div>
            </>}
            <div className="space-y-1"><Label>API Secret (if needed)</Label><Input type="password" value={form.api_secret} onChange={e => set("api_secret", e.target.value)} /></div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Notes</Label><Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => { if (editing) updateMut.mutate({ id: editing.id, data: form }); else createMut.mutate(form); }}>
              {editing ? "Update" : "Save Supplier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}