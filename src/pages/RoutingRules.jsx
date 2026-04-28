import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Activity, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { RULE_TYPE_META } from "@/lib/routingEngine";
import RuleForm from "@/components/routing/RuleForm";
import RuleSimulator from "@/components/routing/RuleSimulator";
import { format } from "date-fns";

export default function RoutingRules() {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const qc = useQueryClient();

  const { data: rules = [] } = useQuery({
    queryKey: ["routing-rules"],
    queryFn: () => base44.entities.RoutingRule.list("priority"),
    initialData: [],
  });
  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers"], queryFn: () => base44.entities.Supplier.list(), initialData: [] });
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: () => base44.entities.Client.list(), initialData: [] });
  const { data: rates = [] } = useQuery({ queryKey: ["rates"], queryFn: () => base44.entities.Rate.list("-created_date", 500), initialData: [] });

  const createMut = useMutation({
    mutationFn: (d) => base44.entities.RoutingRule.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["routing-rules"] }); toast.success("Rule created"); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.RoutingRule.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["routing-rules"] }); toast.success("Rule updated"); },
  });
  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.RoutingRule.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["routing-rules"] }); toast.success("Rule deleted"); },
  });

  const handleSave = (data) => {
    if (editing) updateMut.mutate({ id: editing.id, data });
    else createMut.mutate(data);
    setFormOpen(false);
    setEditing(null);
  };

  const openEdit = (rule) => { setEditing(rule); setFormOpen(true); };
  const openAdd = () => { setEditing(null); setFormOpen(true); };

  const toggleActive = (rule) => updateMut.mutate({ id: rule.id, data: { is_active: !rule.is_active } });

  const movePriority = (rule, direction) => {
    const sorted = [...rules].sort((a, b) => (a.priority ?? 10) - (b.priority ?? 10));
    const idx = sorted.findIndex(r => r.id === rule.id);
    const target = sorted[idx + direction];
    if (!target) return;
    updateMut.mutate({ id: rule.id, data: { priority: target.priority } });
    updateMut.mutate({ id: target.id, data: { priority: rule.priority } });
  };

  const sorted = [...rules].sort((a, b) => (a.priority ?? 10) - (b.priority ?? 10));
  const active = sorted.filter(r => r.is_active !== false);
  const inactive = sorted.filter(r => r.is_active === false);

  const typeStats = Object.keys(RULE_TYPE_META).map(type => ({
    type,
    count: rules.filter(r => r.rule_type === type).length,
    ...RULE_TYPE_META[type],
  })).filter(s => s.count > 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Routing Rules Engine" description="Define dynamic routing logic — LCR, load balancing, failover, time-based, and more">
        <Button onClick={openAdd}><Plus className="w-4 h-4 mr-2" />New Rule</Button>
      </PageHeader>

      {/* Stats */}
      {typeStats.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {typeStats.map(s => (
            <div key={s.type} className={`flex items-center gap-1.5 border rounded-lg px-3 py-1.5 text-xs font-medium ${s.color}`}>
              {s.icon} {s.label.split(" — ")[0]} <span className="font-bold">×{s.count}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 border rounded-lg px-3 py-1.5 text-xs font-medium bg-muted">
            <Activity className="w-3.5 h-3.5" /> {active.length} active / {inactive.length} inactive
          </div>
        </div>
      )}

      {/* Simulator */}
      <RuleSimulator rules={rules} rates={rates} suppliers={suppliers} />

      {/* Rules list */}
      {rules.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">No routing rules yet.</p>
            <p className="text-sm text-muted-foreground">Create your first rule to control how messages are routed — LCR, load balance, failover, and more.</p>
            <Button onClick={openAdd}><Plus className="w-4 h-4 mr-2" />Create First Rule</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sorted.map((rule, idx) => {
            const meta = RULE_TYPE_META[rule.rule_type] || {};
            let supplierNames = [];
            try { supplierNames = JSON.parse(rule.supplier_names || "[]"); } catch { }
            let weights = [];
            try { weights = JSON.parse(rule.load_balance_weights || "[]"); } catch { }

            return (
              <Card key={rule.id} className={`transition-all ${rule.is_active === false ? "opacity-50" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Priority controls */}
                    <div className="flex flex-col items-center gap-0.5 shrink-0">
                      <button onClick={() => movePriority(rule, -1)} className="p-0.5 hover:bg-muted rounded disabled:opacity-20" disabled={idx === 0}>
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs font-mono font-bold text-muted-foreground w-6 text-center">{rule.priority}</span>
                      <button onClick={() => movePriority(rule, 1)} className="p-0.5 hover:bg-muted rounded disabled:opacity-20" disabled={idx === sorted.length - 1}>
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Rule info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge className={`text-xs border ${meta.color}`}>{meta.icon} {meta.label?.split(" — ")[0]}</Badge>
                        <span className="font-semibold text-sm">{rule.name}</span>
                        {rule.hit_count > 0 && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <Activity className="w-3 h-3" />{rule.hit_count.toLocaleString()} hits
                          </Badge>
                        )}
                      </div>

                      {/* Match conditions */}
                      <div className="flex flex-wrap gap-1.5 text-xs mb-2">
                        {rule.match_prefix && <span className="bg-muted border rounded px-1.5 py-0.5">prefix: <strong>{rule.match_prefix}</strong></span>}
                        {rule.match_mcc && <span className="bg-muted border rounded px-1.5 py-0.5">MCC: <strong>{rule.match_mcc}</strong>{rule.match_mnc ? `/${rule.match_mnc}` : ""}</span>}
                        {rule.match_client_name && <span className="bg-muted border rounded px-1.5 py-0.5">client: <strong>{rule.match_client_name}</strong></span>}
                        {rule.match_sender_pattern && <span className="bg-muted border rounded px-1.5 py-0.5">sender: <strong>{rule.match_sender_pattern}</strong></span>}
                        {rule.match_time_start && <span className="bg-muted border rounded px-1.5 py-0.5">⏰ {rule.match_time_start}–{rule.match_time_end}</span>}
                        {!rule.match_prefix && !rule.match_mcc && !rule.match_client_id && !rule.match_time_start &&
                          <span className="text-muted-foreground italic">matches all traffic</span>}
                      </div>

                      {/* Supplier chain */}
                      {supplierNames.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1">
                          {supplierNames.map((name, i) => (
                            <span key={i} className="flex items-center gap-1">
                              {i > 0 && <span className="text-muted-foreground text-xs">→</span>}
                              <span className="bg-primary/10 text-primary border border-primary/20 rounded px-2 py-0.5 text-xs font-medium">
                                {name}{rule.rule_type === "load_balance" && weights[i] != null ? ` ${weights[i]}%` : ""}
                              </span>
                            </span>
                          ))}
                        </div>
                      )}
                      {rule.rule_type === "lcr" && rule.lcr_auto && (
                        <span className="text-xs text-green-700 font-medium">💰 Auto LCR — cheapest from rate table{rule.max_cost_per_sms ? ` (cap: $${rule.max_cost_per_sms})` : ""}</span>
                      )}
                      {rule.rule_type === "block" && (
                        <span className="text-xs text-red-700 font-medium">🚫 {rule.block_reason || "Blocked"}</span>
                      )}

                      {rule.notes && <p className="text-xs text-muted-foreground mt-1 italic">{rule.notes}</p>}
                      {rule.last_hit_at && (
                        <p className="text-xs text-muted-foreground mt-1">Last hit: {format(new Date(rule.last_hit_at), "MMM d, HH:mm")}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch checked={rule.is_active !== false} onCheckedChange={() => toggleActive(rule)} />
                      <Button variant="ghost" size="icon" onClick={() => openEdit(rule)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMut.mutate(rule.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <RuleForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onSave={handleSave}
        rule={editing}
        suppliers={suppliers}
        clients={clients}
      />
    </div>
  );
}