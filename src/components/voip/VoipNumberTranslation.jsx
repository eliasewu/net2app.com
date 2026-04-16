import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, ArrowRight, Hash } from "lucide-react";
import { toast } from "sonner";

const RULE_TYPES = [
  { value: "add_prefix", label: "Add Prefix" },
  { value: "remove_prefix", label: "Remove Prefix" },
  { value: "replace_prefix", label: "Replace Prefix" },
  { value: "ani_modify", label: "ANI Modify (Caller ID)" },
  { value: "full_replace", label: "Full Replace" },
  { value: "strip_leading", label: "Strip Leading Digits" },
];

const emptyRule = {
  name: "", client_id: "", client_name: "", rule_type: "add_prefix",
  match_prefix: "", remove_prefix: "", add_prefix: "", replace_with: "",
  strip_count: 0, new_ani: "", direction: "inbound", priority: 1, status: "active"
};

function applyRule(rule, number) {
  if (!number) return "";
  let n = number;
  if (rule.match_prefix && !n.startsWith(rule.match_prefix)) return n + " (no match)";
  switch (rule.rule_type) {
    case "add_prefix": return (rule.add_prefix || "") + n;
    case "remove_prefix": return n.startsWith(rule.remove_prefix || "") ? n.slice((rule.remove_prefix || "").length) : n;
    case "replace_prefix": return (rule.add_prefix || "") + n.slice((rule.remove_prefix || "").length);
    case "ani_modify": return rule.new_ani || n;
    case "full_replace": return rule.replace_with || n;
    case "strip_leading": return n.slice(rule.strip_count || 0);
    default: return n;
  }
}

export default function VoipNumberTranslation({ voipClients }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...emptyRule });
  const [testNumber, setTestNumber] = useState("");
  const qc = useQueryClient();

  const { data: rules = [] } = useQuery({
    queryKey: ['voip-translations'],
    queryFn: () => base44.entities.NumberTranslation.filter({ entity_type: 'supplier' }, '-created_date'),
    initialData: [],
  });

  const createMut = useMutation({ mutationFn: d => base44.entities.NumberTranslation.create({ ...d, entity_type: 'supplier', entity_id: d.client_id, entity_name: d.client_name, translation_order: d.priority, match_prefix: d.match_prefix, delete_prefix: d.remove_prefix, add_prefix: d.add_prefix, replace_content: d.replace_with, replace_type: 'custom' }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['voip-translations'] }); setDialogOpen(false); toast.success("Rule added"); } });
  const deleteMut = useMutation({ mutationFn: id => base44.entities.NumberTranslation.delete(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['voip-translations'] }); toast.success("Deleted"); } });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setForm({ ...emptyRule }); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />Add Rule
        </Button>
      </div>

      {/* Live Test */}
      <Card className="border-blue-200 bg-blue-50/30">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Hash className="w-4 h-4" />Live Number Test</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Input placeholder="Enter number to test..." value={testNumber} onChange={e => setTestNumber(e.target.value)} className="w-48" />
            </div>
            {testNumber && rules.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {rules.slice(0, 5).map(r => (
                  <div key={r.id} className="flex items-center gap-1 text-xs bg-white border rounded px-2 py-1">
                    <span className="text-muted-foreground">{r.name}:</span>
                    <span className="font-mono">{testNumber}</span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                    <span className="font-mono font-bold text-blue-700">{applyRule({ rule_type: r.replace_type === 'custom' ? 'replace_prefix' : r.replace_type, match_prefix: r.match_prefix, remove_prefix: r.delete_prefix, add_prefix: r.add_prefix, replace_with: r.replace_content, strip_count: 0 }, testNumber)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Match Prefix</TableHead>
                <TableHead>Remove</TableHead>
                <TableHead>Add Prefix</TableHead>
                <TableHead>Replace With</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="font-mono text-xs">{r.match_prefix || '—'}</TableCell>
                  <TableCell className="font-mono text-xs text-red-600">{r.delete_prefix || '—'}</TableCell>
                  <TableCell className="font-mono text-xs text-green-600">{r.add_prefix || '—'}</TableCell>
                  <TableCell className="font-mono text-xs text-blue-600">{r.replace_content || '—'}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs capitalize">{r.separator || 'both'}</Badge></TableCell>
                  <TableCell>{r.translation_order}</TableCell>
                  <TableCell><Badge variant="outline" className={r.status === 'active' ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-600"}>{r.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => deleteMut.mutate(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {rules.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-12">No translation rules yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Number Translation / ANI Rule</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Rule Name *</Label><Input value={form.name} onChange={e => set('name', e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label>Rule Type</Label>
              <Select value={form.rule_type} onValueChange={v => set('rule_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{RULE_TYPES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Client</Label>
              <Select value={form.client_id} onValueChange={v => { const c = voipClients.find(x => x.id === v); set('client_id', v); set('client_name', c?.name || ''); }}>
                <SelectTrigger><SelectValue placeholder="All clients" /></SelectTrigger>
                <SelectContent>{voipClients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Direction</Label>
              <Select value={form.direction} onValueChange={v => set('direction', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="inbound">Inbound</SelectItem>
                  <SelectItem value="outbound">Outbound</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Match Prefix</Label><Input value={form.match_prefix} onChange={e => set('match_prefix', e.target.value)} placeholder="e.g. 880" /></div>
            <div className="space-y-1.5"><Label>Remove Prefix</Label><Input value={form.remove_prefix} onChange={e => set('remove_prefix', e.target.value)} placeholder="e.g. 880" /></div>
            <div className="space-y-1.5"><Label>Add Prefix</Label><Input value={form.add_prefix} onChange={e => set('add_prefix', e.target.value)} placeholder="e.g. +880" /></div>
            {form.rule_type === 'full_replace' && <div className="space-y-1.5"><Label>Replace With</Label><Input value={form.replace_with} onChange={e => set('replace_with', e.target.value)} /></div>}
            {form.rule_type === 'ani_modify' && <div className="space-y-1.5"><Label>New ANI / Caller ID</Label><Input value={form.new_ani} onChange={e => set('new_ani', e.target.value)} /></div>}
            {form.rule_type === 'strip_leading' && <div className="space-y-1.5"><Label>Strip Count</Label><Input type="number" value={form.strip_count} onChange={e => set('strip_count', Number(e.target.value))} /></div>}
            <div className="space-y-1.5"><Label>Priority</Label><Input type="number" value={form.priority} onChange={e => set('priority', Number(e.target.value))} /></div>
          </div>
          {/* Preview */}
          {testNumber && (
            <div className="flex items-center gap-2 p-2 bg-muted/40 rounded text-xs">
              <span className="text-muted-foreground">Preview:</span>
              <span className="font-mono">{testNumber}</span>
              <ArrowRight className="w-3 h-3" />
              <span className="font-mono font-bold text-blue-700">{applyRule(form, testNumber)}</span>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => createMut.mutate(form)}>Add Rule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}