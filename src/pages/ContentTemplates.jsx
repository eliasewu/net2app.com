import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function ContentTemplates() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', destination_prefix: '', contents: '', sender_ids: '', is_random: true, client_id: '', status: 'active' });
  const qc = useQueryClient();

  const { data: templates = [] } = useQuery({ queryKey: ['content-templates'], queryFn: () => base44.entities.ContentTemplate.list('-created_date'), initialData: [] });
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list(), initialData: [] });

  const createMut = useMutation({
    mutationFn: (d) => base44.entities.ContentTemplate.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['content-templates'] }); setDialogOpen(false); toast.success("Template created"); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ContentTemplate.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['content-templates'] }); setDialogOpen(false); toast.success("Updated"); },
  });
  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.ContentTemplate.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['content-templates'] }); toast.success("Deleted"); },
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-6">
      <PageHeader title="Content Templates" description="Manage random content/SID rotation per destination">
        <Button onClick={() => { setEditing(null); setForm({ name: '', destination_prefix: '', contents: '', sender_ids: '', is_random: true, client_id: '', status: 'active' }); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />Add Template
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Prefix</TableHead>
                <TableHead>Random</TableHead>
                <TableHead>Contents</TableHead>
                <TableHead>Sender IDs</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((t) => {
                let contentCount = 0;
                let senderCount = 0;
                try { contentCount = JSON.parse(t.contents || '[]').length; } catch {}
                try { senderCount = JSON.parse(t.sender_ids || '[]').length; } catch {}
                return (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="font-mono">{t.destination_prefix}</TableCell>
                    <TableCell>{t.is_random ? 'Yes' : 'No'}</TableCell>
                    <TableCell>{contentCount} variants</TableCell>
                    <TableCell>{senderCount} IDs</TableCell>
                    <TableCell><StatusBadge status={t.status} /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setEditing(t); setForm(t); setDialogOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteMut.mutate(t.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {templates.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-12">No content templates</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Edit Template' : 'Add Template'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => set('name', e.target.value)} /></div>
            <div className="space-y-2"><Label>Destination Prefix *</Label><Input value={form.destination_prefix} onChange={(e) => set('destination_prefix', e.target.value)} placeholder="880, 91" /></div>
            <div className="space-y-2">
              <Label>Client (Optional)</Label>
              <Select value={form.client_id || ''} onValueChange={(v) => set('client_id', v)}>
                <SelectTrigger><SelectValue placeholder="All clients" /></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Content Variants (JSON Array)</Label>
              <Textarea value={form.contents} onChange={(e) => set('contents', e.target.value)} placeholder='["Hello {{name}}, your OTP is {{otp}}", "Hi {{name}}, code: {{otp}}"]' rows={4} />
            </div>
            <div className="space-y-2">
              <Label>Sender IDs (JSON Array)</Label>
              <Textarea value={form.sender_ids} onChange={(e) => set('sender_ids', e.target.value)} placeholder='["SenderA", "SenderB", "SenderC"]' rows={2} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_random} onCheckedChange={(v) => set('is_random', v)} />
              <Label>Random rotation</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => { if (editing) updateMut.mutate({ id: editing.id, data: form }); else createMut.mutate(form); }}>
              {editing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}