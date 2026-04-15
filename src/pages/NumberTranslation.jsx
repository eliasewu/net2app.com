import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, ArrowRight, Hash } from "lucide-react";
import { toast } from "sonner";

const REPLACE_TYPES = [
  { value: "replace_star", label: "Replace with * (mask all)" },
  { value: "replace_blank", label: "Replace with blank" },
  { value: "random_replace", label: "Random replace" },
  { value: "digit_extract", label: "Digit extraction replace" },
  { value: "digit_extract_forward", label: "Digit extraction replace (extract forward)" },
  { value: "number_letter_extract", label: "Number & letter extraction replace" },
  { value: "number_letter_extract_forward", label: "Number & letter extraction (extract forward)" },
  { value: "custom", label: "Custom replace" },
  { value: "append_forward", label: "Append forward" },
  { value: "append_backward", label: "Append backward" },
];

const previewTranslation = (input, rule) => {
  if (!input || !rule) return input;
  let num = input;
  // delete prefix
  if (rule.delete_prefix && num.startsWith(rule.delete_prefix)) num = num.slice(rule.delete_prefix.length);
  // add prefix
  if (rule.add_prefix) num = rule.add_prefix + num;
  // apply replace type
  switch (rule.replace_type) {
    case "replace_star": num = num.replace(/\d/g, "*"); break;
    case "replace_blank": num = ""; break;
    case "random_replace": num = num.split("").map(c => /\d/.test(c) ? Math.floor(Math.random() * 10) : c).join(""); break;
    case "digit_extract": num = num.replace(/\D/g, ""); break;
    case "digit_extract_forward": num = num.replace(/\D/g, "").split("").reverse().join(""); break;
    case "number_letter_extract": num = num.replace(/[^a-zA-Z0-9]/g, ""); break;
    case "number_letter_extract_forward": num = num.replace(/[^a-zA-Z0-9]/g, "").split("").reverse().join(""); break;
    case "custom": if (rule.replace_content) num = rule.replace_content; break;
    case "append_forward": if (rule.add_suffix) num = rule.add_suffix + (rule.separator || "") + num; break;
    case "append_backward": if (rule.add_suffix) num = num + (rule.separator || "") + rule.add_suffix; break;
  }
  // add suffix (for non-append types)
  if (rule.add_suffix && !["append_forward", "append_backward"].includes(rule.replace_type)) {
    num = num + (rule.separator || "") + rule.add_suffix;
  }
  return num;
};

export default function NumberTranslationPage() {
  const [tab, setTab] = useState("client");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [testNumber, setTestNumber] = useState("");
  const [form, setForm] = useState({ name: "", entity_type: "client", entity_id: "", entity_name: "", match_prefix: "", delete_prefix: "", add_prefix: "", add_suffix: "", replace_type: "replace_star", replace_content: "", separator: "", translation_order: 1, status: "active" });
  const qc = useQueryClient();

  const { data: translations = [] } = useQuery({ queryKey: ["translations"], queryFn: () => base44.entities.NumberTranslation.list("-created_date"), initialData: [] });
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: () => base44.entities.Client.list(), initialData: [] });
  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers"], queryFn: () => base44.entities.Supplier.list(), initialData: [] });

  const createMut = useMutation({ mutationFn: d => base44.entities.NumberTranslation.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["translations"] }); setDialogOpen(false); toast.success("Translation rule added"); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }) => base44.entities.NumberTranslation.update(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ["translations"] }); setDialogOpen(false); toast.success("Updated"); } });
  const deleteMut = useMutation({ mutationFn: id => base44.entities.NumberTranslation.delete(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ["translations"] }); toast.success("Deleted"); } });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = () => {
    const entityList = form.entity_type === "client" ? clients : suppliers;
    const entity = entityList.find(e => e.id === form.entity_id);
    const data = { ...form, entity_name: entity?.name || "" };
    if (editing) updateMut.mutate({ id: editing.id, data });
    else createMut.mutate(data);
  };

  const openNew = (entityType) => {
    setEditing(null);
    setForm({ name: "", entity_type: entityType, entity_id: "", entity_name: "", match_prefix: "", delete_prefix: "", add_prefix: "", add_suffix: "", replace_type: "replace_star", replace_content: "", separator: "", translation_order: 1, status: "active" });
    setDialogOpen(true);
  };

  const filtered = translations.filter(t => t.entity_type === tab);

  return (
    <div className="space-y-6">
      <PageHeader title="Number Translation" description="Prefix rules, masking, digit extraction and custom transforms">
        <Button onClick={() => openNew(tab)}><Plus className="w-4 h-4 mr-2" />Add Rule</Button>
      </PageHeader>

      {/* Quick test panel */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Hash className="w-4 h-4" />Live Translation Tester</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 flex-wrap">
            <Input placeholder="Enter number to test e.g. 8801712345678" className="max-w-xs bg-white" value={testNumber} onChange={e => setTestNumber(e.target.value)} />
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
            {filtered.filter(t => testNumber.startsWith(t.match_prefix || "")).map(rule => (
              <div key={rule.id} className="flex items-center gap-2 bg-white border rounded px-3 py-1.5">
                <span className="text-xs text-muted-foreground">{rule.name}:</span>
                <span className="font-mono text-sm font-bold text-blue-700">{previewTranslation(testNumber, rule)}</span>
              </div>
            ))}
            {testNumber && filtered.filter(t => testNumber.startsWith(t.match_prefix || "")).length === 0 && (
              <span className="text-sm text-muted-foreground italic">No matching rule</span>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="client">Client Rules</TabsTrigger>
          <TabsTrigger value="supplier">Supplier Rules</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>{tab === "client" ? "Client" : "Supplier"}</TableHead>
                    <TableHead>Match Prefix</TableHead>
                    <TableHead>Delete Prefix</TableHead>
                    <TableHead>Add Prefix</TableHead>
                    <TableHead>Replace Type</TableHead>
                    <TableHead>Add Suffix</TableHead>
                    <TableHead>Separator</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(t => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell>{t.entity_name}</TableCell>
                      <TableCell className="font-mono text-sm">{t.match_prefix || <span className="text-muted-foreground italic">any</span>}</TableCell>
                      <TableCell className="font-mono text-sm text-red-600">{t.delete_prefix}</TableCell>
                      <TableCell className="font-mono text-sm text-green-600">{t.add_prefix}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{REPLACE_TYPES.find(r => r.value === t.replace_type)?.label || t.replace_type}</Badge></TableCell>
                      <TableCell className="font-mono text-sm text-blue-600">{t.add_suffix}</TableCell>
                      <TableCell className="font-mono">{t.separator}</TableCell>
                      <TableCell>{t.translation_order}</TableCell>
                      <TableCell><StatusBadge status={t.status} /></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => { setEditing(t); setForm({ ...t }); setDialogOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteMut.mutate(t.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-12">No translation rules yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Rule" : "Add Translation Rule"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1 col-span-2"><Label>Rule Name *</Label><Input value={form.name} onChange={e => set("name", e.target.value)} /></div>
            <div className="space-y-1">
              <Label>Entity Type</Label>
              <Select value={form.entity_type} onValueChange={v => set("entity_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="client">Client</SelectItem><SelectItem value="supplier">Supplier</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{form.entity_type === "supplier" ? "Supplier" : "Client"}</Label>
              <Select value={form.entity_id} onValueChange={v => set("entity_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>{(form.entity_type === "supplier" ? suppliers : clients).map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Match Prefix (blank = all)</Label><Input value={form.match_prefix} onChange={e => set("match_prefix", e.target.value)} placeholder="880, 91, 44" /></div>
            <div className="space-y-1"><Label>Delete Prefix</Label><Input value={form.delete_prefix} onChange={e => set("delete_prefix", e.target.value)} placeholder="00, +" /></div>
            <div className="space-y-1"><Label>Add Prefix</Label><Input value={form.add_prefix} onChange={e => set("add_prefix", e.target.value)} placeholder="88" /></div>
            <div className="space-y-1"><Label>Add Suffix</Label><Input value={form.add_suffix} onChange={e => set("add_suffix", e.target.value)} /></div>
            <div className="space-y-1 col-span-2">
              <Label>Replace / Transform Type</Label>
              <Select value={form.replace_type} onValueChange={v => set("replace_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{REPLACE_TYPES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {form.replace_type === "custom" && (
              <div className="space-y-1 col-span-2"><Label>Custom Replace Value</Label><Input value={form.replace_content} onChange={e => set("replace_content", e.target.value)} /></div>
            )}
            <div className="space-y-1"><Label>Separator</Label><Input value={form.separator} onChange={e => set("separator", e.target.value)} placeholder="-  or  _" /></div>
            <div className="space-y-1"><Label>Order (priority)</Label><Input type="number" value={form.translation_order} onChange={e => set("translation_order", Number(e.target.value))} /></div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          {/* Live preview */}
          {testNumber && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
              <span className="text-muted-foreground">Preview: </span>
              <span className="font-mono font-bold text-green-700">{testNumber}</span>
              <span className="mx-2 text-muted-foreground">→</span>
              <span className="font-mono font-bold text-blue-700">{previewTranslation(testNumber, form)}</span>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit}>{editing ? "Update" : "Create Rule"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}