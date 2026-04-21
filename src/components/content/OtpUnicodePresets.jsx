import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Play, CheckCircle } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_DIGIT_MAP = {
  "0": ["𝟘","０","𝟬","𝟶","₀","⁰","🄋","౦","0️⃣"],
  "1": ["𝟙","𝟣","𝟭","𝟷","１","₁","¹","①","1️⃣"],
  "2": ["𝟚","𝟤","𝟮","𝟸","２","₂","²","②","2️⃣"],
  "3": ["𝟛","𝟥","𝟯","𝟹","３","₃","³","③","3️⃣"],
  "4": ["𝟜","𝟦","𝟰","𝟺","４","₄","⁴","④","4️⃣"],
  "5": ["𝟝","𝟧","𝟱","𝟻","５","⒌","⁵","➄","5️⃣"],
  "6": ["𝟞","𝟨","𝟲","𝟼","６","⒍","⁶","⑥","6️⃣"],
  "7": ["𝟟","𝟩","𝟳","𝟽","７","₇","⁷","⑦","7️⃣"],
  "8": ["𝟠","𝟪","𝟴","𝟾","８","₈","⁸","⑧","8️⃣"],
  "9": ["𝟡","𝟫","𝟵","𝟿","９","₉","⁹","⑨","9️⃣"],
};

function applyPreset(text, digitMap) {
  const idx = Math.floor(Math.random() * 9);
  return text.replace(/[0-9]/g, (d) => {
    const variants = digitMap[d];
    if (!variants || !variants.length) return d;
    return variants[idx % variants.length];
  });
}

export default function OtpUnicodePresets() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", description: "", digit_map: JSON.stringify(DEFAULT_DIGIT_MAP, null, 2), apply_to_suppliers: "[]", apply_to_routes: "[]", is_active: true });
  const [testInput, setTestInput] = useState("Your OTP is 123456");
  const [testOutput, setTestOutput] = useState("");
  const [testPresetId, setTestPresetId] = useState("");
  const qc = useQueryClient();

  const { data: presets = [] } = useQuery({
    queryKey: ["otp-presets"],
    queryFn: () => base44.entities.OtpUnicodePreset.list("-created_date"),
    initialData: [],
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => base44.entities.Supplier.list(),
    initialData: [],
  });
  const { data: routes = [] } = useQuery({
    queryKey: ["routes"],
    queryFn: () => base44.entities.Route.list(),
    initialData: [],
  });

  const createMut = useMutation({
    mutationFn: (d) => base44.entities.OtpUnicodePreset.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["otp-presets"] }); setDialogOpen(false); toast.success("Preset saved"); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.OtpUnicodePreset.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["otp-presets"] }); setDialogOpen(false); toast.success("Preset updated"); },
  });
  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.OtpUnicodePreset.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["otp-presets"] }); toast.success("Preset deleted"); },
  });

  // Apply preset to a supplier
  const applyToSupplier = async (presetId, supplierId) => {
    const preset = presets.find((p) => p.id === presetId);
    if (!preset || !supplierId) return;
    await base44.entities.Supplier.update(supplierId, {
      otp_unicode_preset: preset.name,
      otp_unicode_enabled: true,
    });
    // Also add supplierId to preset's apply_to_suppliers
    let ids = [];
    try { ids = JSON.parse(preset.apply_to_suppliers || "[]"); } catch {}
    if (!ids.includes(supplierId)) ids.push(supplierId);
    await base44.entities.OtpUnicodePreset.update(presetId, { apply_to_suppliers: JSON.stringify(ids) });
    qc.invalidateQueries({ queryKey: ["suppliers"] });
    qc.invalidateQueries({ queryKey: ["otp-presets"] });
    toast.success("Preset applied to supplier");
  };

  // Apply preset to a route
  const applyToRoute = async (presetId, routeId) => {
    const preset = presets.find((p) => p.id === presetId);
    if (!preset || !routeId) return;
    let ids = [];
    try { ids = JSON.parse(preset.apply_to_routes || "[]"); } catch {}
    if (!ids.includes(routeId)) ids.push(routeId);
    await base44.entities.OtpUnicodePreset.update(presetId, { apply_to_routes: JSON.stringify(ids) });
    qc.invalidateQueries({ queryKey: ["otp-presets"] });
    toast.success("Preset linked to route");
  };

  const runTest = () => {
    const preset = presets.find((p) => p.id === testPresetId) || presets[0];
    if (!preset) { toast.error("No preset selected"); return; }
    let map = DEFAULT_DIGIT_MAP;
    try { map = JSON.parse(preset.digit_map); } catch {}
    const results = Array.from({ length: 5 }, () => applyPreset(testInput, map));
    setTestOutput(results.join("\n"));
  };

  const handleSubmit = () => {
    // validate JSON
    try { JSON.parse(form.digit_map); } catch { toast.error("digit_map must be valid JSON"); return; }
    if (editing) updateMut.mutate({ id: editing.id, data: form });
    else createMut.mutate(form);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({ name: p.name, description: p.description || "", digit_map: p.digit_map, apply_to_suppliers: p.apply_to_suppliers || "[]", apply_to_routes: p.apply_to_routes || "[]", is_active: p.is_active });
    setDialogOpen(true);
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ name: "", description: "", digit_map: JSON.stringify(DEFAULT_DIGIT_MAP, null, 2), apply_to_suppliers: "[]", apply_to_routes: "[]", is_active: true });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">OTP Unicode Presets</h3>
          <p className="text-xs text-muted-foreground">Create multiple named digit-replacement presets and assign them to specific Suppliers or Routes.</p>
        </div>
        <Button size="sm" onClick={openAdd}><Plus className="w-4 h-4 mr-1" />New Preset</Button>
      </div>

      {/* Preset list */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Preset Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Assigned Suppliers</TableHead>
                <TableHead>Assigned Routes</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {presets.map((p) => {
                let supplierIds = [], routeIds = [];
                try { supplierIds = JSON.parse(p.apply_to_suppliers || "[]"); } catch {}
                try { routeIds = JSON.parse(p.apply_to_routes || "[]"); } catch {}
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-semibold">{p.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.description || "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {supplierIds.length === 0 ? <span className="text-xs text-muted-foreground">None</span> : supplierIds.map((id) => {
                          const s = suppliers.find((x) => x.id === id);
                          return <Badge key={id} variant="outline" className="text-[10px] py-0">{s?.name || id.slice(0,8)}</Badge>;
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {routeIds.length === 0 ? <span className="text-xs text-muted-foreground">None</span> : routeIds.map((id) => {
                          const r = routes.find((x) => x.id === id);
                          return <Badge key={id} variant="outline" className="text-[10px] py-0">{r?.name || id.slice(0,8)}</Badge>;
                        })}
                      </div>
                    </TableCell>
                    <TableCell><Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteMut.mutate(p.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {presets.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No presets yet. Click "New Preset" to create one.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Quick Apply panel */}
      {presets.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Apply Preset → Supplier</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <QuickApply
                label="Preset"
                options={presets.map((p) => ({ id: p.id, name: p.name }))}
                label2="Supplier"
                options2={suppliers.filter((s) => s.category !== "device").map((s) => ({ id: s.id, name: s.name }))}
                onApply={applyToSupplier}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Apply Preset → Route</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <QuickApply
                label="Preset"
                options={presets.map((p) => ({ id: p.id, name: p.name }))}
                label2="Route"
                options2={routes.map((r) => ({ id: r.id, name: r.name }))}
                onApply={applyToRoute}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Test panel */}
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Play className="w-4 h-4" />Test a Preset</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Select Preset</Label>
              <Select value={testPresetId} onValueChange={setTestPresetId}>
                <SelectTrigger className="h-8"><SelectValue placeholder="Choose preset..." /></SelectTrigger>
                <SelectContent>{presets.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Input SMS</Label>
              <Input value={testInput} onChange={(e) => setTestInput(e.target.value)} className="h-8 text-xs" />
            </div>
          </div>
          <Button size="sm" onClick={runTest} className="gap-1"><Play className="w-4 h-4" />Generate 5 Samples</Button>
          {testOutput && (
            <div className="space-y-1">
              <Label className="text-xs">Output variants (5 random samples):</Label>
              <div className="p-3 bg-green-50 border border-green-200 rounded font-mono text-sm space-y-1">
                {testOutput.split("\n").map((line, i) => (
                  <div key={i} className="flex gap-2"><span className="text-green-500 text-xs">#{i+1}</span>{line}</div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Preset" : "New OTP Unicode Preset"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Preset Name *</Label>
                <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Style-A, BD-Unicode-1" />
              </div>
              <div className="space-y-1">
                <Label>Description</Label>
                <Input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Optional description" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Digit Map (JSON) — keys 0–9, values = array of Unicode variants</Label>
              <Textarea
                value={form.digit_map}
                onChange={(e) => setForm((p) => ({ ...p, digit_map: e.target.value }))}
                rows={12}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">Each digit has an array of lookalike characters. One random index is picked per message and applied to all digits consistently.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit}><CheckCircle className="w-4 h-4 mr-1" />{editing ? "Update" : "Save Preset"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QuickApply({ label, options, label2, options2, onApply }) {
  const [sel1, setSel1] = useState("");
  const [sel2, setSel2] = useState("");
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs">{label}</Label>
        <Select value={sel1} onValueChange={setSel1}>
          <SelectTrigger className="h-8"><SelectValue placeholder={`Select ${label}...`} /></SelectTrigger>
          <SelectContent>{options.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{label2}</Label>
        <Select value={sel2} onValueChange={setSel2}>
          <SelectTrigger className="h-8"><SelectValue placeholder={`Select ${label2}...`} /></SelectTrigger>
          <SelectContent>{options2.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <Button size="sm" className="w-full gap-1" disabled={!sel1 || !sel2} onClick={() => onApply(sel1, sel2)}>
        <CheckCircle className="w-3 h-3" />Apply
      </Button>
    </div>
  );
}