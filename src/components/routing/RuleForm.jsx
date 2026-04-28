import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { RULE_TYPE_META } from "@/lib/routingEngine";
import { X, GripVertical, Plus } from "lucide-react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function RuleForm({ open, onClose, onSave, rule, suppliers, clients }) {
  const blank = {
    name: "", description: "", rule_type: "lcr", priority: 10,
    match_prefix: "", match_mcc: "", match_mnc: "",
    match_client_id: "", match_client_name: "", match_sender_pattern: "",
    match_time_start: "", match_time_end: "", match_days: "",
    supplier_ids: "[]", supplier_names: "[]", load_balance_weights: "[]",
    lcr_auto: true, max_cost_per_sms: "", block_reason: "",
    action_on_all_fail: "reject", is_active: true, notes: "",
  };

  const [form, setForm] = useState(blank);
  const [selectedSuppliers, setSelectedSuppliers] = useState([]); // [{id,name,weight}]
  const [selectedDays, setSelectedDays] = useState([]);

  useEffect(() => {
    if (rule) {
      setForm({ ...blank, ...rule });
      try { 
        const ids = JSON.parse(rule.supplier_ids || "[]");
        const names = JSON.parse(rule.supplier_names || "[]");
        const weights = JSON.parse(rule.load_balance_weights || "[]");
        setSelectedSuppliers(ids.map((id, i) => ({ id, name: names[i] || id, weight: weights[i] ?? 50 })));
      } catch { setSelectedSuppliers([]); }
      try { setSelectedDays(JSON.parse(rule.match_days || "[]")); } catch { setSelectedDays([]); }
    } else {
      setForm(blank);
      setSelectedSuppliers([]);
      setSelectedDays([]);
    }
  }, [rule, open]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const addSupplier = (id) => {
    if (!id || selectedSuppliers.find(s => s.id === id)) return;
    const sup = suppliers.find(s => s.id === id);
    setSelectedSuppliers(prev => [...prev, { id, name: sup?.name || id, weight: 50 }]);
  };

  const removeSupplier = (id) => setSelectedSuppliers(prev => prev.filter(s => s.id !== id));

  const setWeight = (id, w) => setSelectedSuppliers(prev => prev.map(s => s.id === id ? { ...s, weight: Number(w) } : s));

  const toggleDay = (d) => setSelectedDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);

  const handleSave = () => {
    const ids = selectedSuppliers.map(s => s.id);
    const names = selectedSuppliers.map(s => s.name);
    const weights = selectedSuppliers.map(s => s.weight ?? 50);
    const client = clients.find(c => c.id === form.match_client_id);
    onSave({
      ...form,
      supplier_ids: JSON.stringify(ids),
      supplier_names: JSON.stringify(names),
      load_balance_weights: JSON.stringify(weights),
      match_days: selectedDays.length ? JSON.stringify(selectedDays) : "",
      match_client_name: client?.name || form.match_client_name || "",
      max_cost_per_sms: form.max_cost_per_sms ? Number(form.max_cost_per_sms) : null,
    });
  };

  const meta = RULE_TYPE_META[form.rule_type];
  const weightTotal = selectedSuppliers.reduce((s, x) => s + (x.weight ?? 0), 0);
  const showSuppliers = !["block"].includes(form.rule_type);
  const showWeights = form.rule_type === "load_balance";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{rule ? "Edit Routing Rule" : "New Routing Rule"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Type selector */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label>Rule Type *</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(RULE_TYPE_META).map(([key, m]) => (
                  <button key={key} type="button"
                    onClick={() => set("rule_type", key)}
                    className={`flex items-center gap-1.5 border rounded-lg px-3 py-2 text-xs font-medium transition-all ${form.rule_type === key ? m.color + " ring-2 ring-offset-1 ring-current" : "border-border bg-background hover:bg-muted"}`}>
                    <span>{m.icon}</span>{m.label.split(" — ")[0].split(" ")[0]} {m.label.split(" — ")[0].split(" ").slice(1).join(" ")}
                  </button>
                ))}
              </div>
              {meta && <p className="text-xs text-muted-foreground mt-1 pl-1">{meta.label}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Rule Name *</Label>
              <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. BD Cheapest Route" />
            </div>
            <div className="space-y-1.5">
              <Label>Priority <span className="text-xs text-muted-foreground">(lower = first)</span></Label>
              <Input type="number" value={form.priority} onChange={e => set("priority", Number(e.target.value))} />
            </div>
          </div>

          {/* Match conditions */}
          <div className="p-3 bg-muted/40 rounded-lg border space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Match Conditions <span className="font-normal normal-case">(all blank = match everything)</span></p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Prefix</Label><Input value={form.match_prefix} onChange={e => set("match_prefix", e.target.value)} placeholder="e.g. 880" /></div>
              <div className="space-y-1.5"><Label className="text-xs">MCC</Label><Input value={form.match_mcc} onChange={e => set("match_mcc", e.target.value)} placeholder="e.g. 470" /></div>
              <div className="space-y-1.5"><Label className="text-xs">MNC</Label><Input value={form.match_mnc} onChange={e => set("match_mnc", e.target.value)} placeholder="e.g. 01" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Client (optional)</Label>
                <Select value={form.match_client_id || "__all__"} onValueChange={v => set("match_client_id", v === "__all__" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="All clients" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All clients</SelectItem>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Sender Pattern (regex)</Label><Input value={form.match_sender_pattern} onChange={e => set("match_sender_pattern", e.target.value)} placeholder="e.g. BANK.* or OTP" /></div>
            </div>

            {/* Time window */}
            <div className="grid grid-cols-3 gap-3 items-end">
              <div className="space-y-1.5"><Label className="text-xs">Time Start (HH:MM)</Label><Input type="time" value={form.match_time_start} onChange={e => set("match_time_start", e.target.value)} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Time End (HH:MM)</Label><Input type="time" value={form.match_time_end} onChange={e => set("match_time_end", e.target.value)} /></div>
              <div className="space-y-1.5">
                <Label className="text-xs">Days of Week</Label>
                <div className="flex gap-1 flex-wrap">
                  {DAYS.map((d, i) => (
                    <button key={i} type="button" onClick={() => toggleDay(i)}
                      className={`px-1.5 py-0.5 rounded text-xs border font-medium transition-colors ${selectedDays.includes(i) ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Rule-specific config */}
          {form.rule_type === "block" && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg space-y-2">
              <p className="text-xs font-semibold text-red-800">🚫 Block Rule</p>
              <div className="space-y-1.5"><Label className="text-xs">Block Reason (shown in fail_reason)</Label>
                <Input value={form.block_reason} onChange={e => set("block_reason", e.target.value)} placeholder="e.g. Destination not allowed" /></div>
            </div>
          )}

          {form.rule_type === "lcr" && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg space-y-3">
              <p className="text-xs font-semibold text-green-800">💰 LCR Options</p>
              <div className="flex items-center gap-3">
                <Switch checked={form.lcr_auto} onCheckedChange={v => set("lcr_auto", v)} />
                <Label className="text-xs">Auto-pick cheapest from Rate table</Label>
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Max Rate Cap (skip suppliers above this cost)</Label>
                <Input type="number" step="0.00001" value={form.max_cost_per_sms ?? ""} onChange={e => set("max_cost_per_sms", e.target.value)} placeholder="e.g. 0.005" /></div>
              {!form.lcr_auto && <p className="text-xs text-green-700">Add suppliers below — they will be ranked by their Rate table entry for the matched destination.</p>}
            </div>
          )}

          {form.rule_type === "load_balance" && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs font-semibold text-blue-800 mb-1">⚖️ Weight Distribution — must total 100%</p>
              <p className="text-xs text-blue-700">Traffic is split randomly weighted by the % you assign. Add suppliers and set weights.</p>
              {weightTotal !== 100 && selectedSuppliers.length > 0 && (
                <p className="text-xs text-red-600 mt-1 font-semibold">⚠️ Current total: {weightTotal}% (must be 100)</p>
              )}
            </div>
          )}

          {/* Supplier list */}
          {showSuppliers && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wide">
                  {form.rule_type === "failover" ? "Failover Chain (top = primary)" :
                   form.rule_type === "load_balance" ? "Suppliers with Traffic Weights" :
                   form.rule_type === "lcr" && !form.lcr_auto ? "Supplier Pool for LCR" :
                   "Supplier Pool"}
                </Label>
                <Select onValueChange={addSupplier} value="">
                  <SelectTrigger className="w-48 h-7 text-xs"><SelectValue placeholder="+ Add supplier" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.filter(s => !selectedSuppliers.find(x => x.id === s.id)).map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedSuppliers.length === 0 ? (
                <div className="border-2 border-dashed rounded-lg p-6 text-center text-xs text-muted-foreground">
                  {form.rule_type === "lcr" && form.lcr_auto
                    ? "Auto-LCR enabled — all suppliers with rates will be considered. Add specific suppliers to restrict the pool."
                    : "Add at least one supplier using the dropdown above."}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {selectedSuppliers.map((s, idx) => (
                    <div key={s.id} className="flex items-center gap-2 bg-muted/40 border rounded-lg px-3 py-2">
                      <GripVertical className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="w-5 h-5 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">{idx + 1}</span>
                      <span className="flex-1 text-sm font-medium">{s.name}</span>
                      {showWeights && (
                        <div className="flex items-center gap-1">
                          <Input type="number" min={0} max={100} value={s.weight}
                            onChange={e => setWeight(s.id, e.target.value)}
                            className="w-16 h-7 text-xs text-center" />
                          <span className="text-xs text-muted-foreground">%</span>
                        </div>
                      )}
                      <button type="button" onClick={() => removeSupplier(s.id)} className="text-muted-foreground hover:text-destructive">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Fallback + meta */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">On All Suppliers Fail</Label>
              <Select value={form.action_on_all_fail} onValueChange={v => set("action_on_all_fail", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="reject">Reject (return error)</SelectItem>
                  <SelectItem value="fallback_any">Fallback to any active supplier</SelectItem>
                  <SelectItem value="queue">Queue for retry</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 flex flex-col justify-end">
              <div className="flex items-center gap-2">
                <Switch checked={form.is_active !== false} onCheckedChange={v => set("is_active", v)} />
                <Label className="text-xs">Rule Active</Label>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Description / Notes</Label>
            <Textarea value={form.notes || ""} onChange={e => set("notes", e.target.value)} rows={2} placeholder="Optional notes about this rule..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!form.name || !form.rule_type}>
            {rule ? "Update Rule" : "Create Rule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}