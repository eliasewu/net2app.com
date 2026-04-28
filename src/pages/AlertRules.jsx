import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bell, Plus, Pencil, Trash2, Play, CheckCircle2, Clock, AlertTriangle,
  TrendingDown, DollarSign, Radio, Zap, Mail
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const ALERT_TYPES = [
  { key: "delivery_rate_below", label: "Delivery Rate Below %", icon: TrendingDown, color: "text-red-600 bg-red-50 border-red-200", description: "Fire when SMS delivery rate falls below threshold" },
  { key: "failure_rate_above",  label: "Failure Rate Above %",  icon: AlertTriangle, color: "text-orange-600 bg-orange-50 border-orange-200", description: "Fire when failure/rejection rate exceeds threshold" },
  { key: "balance_below",       label: "Balance Below Amount",  icon: DollarSign,    color: "text-yellow-600 bg-yellow-50 border-yellow-200", description: "Fire when client balance drops below threshold" },
  { key: "volume_drop",         label: "Volume Below Count",    icon: Radio,         color: "text-blue-600 bg-blue-50 border-blue-200", description: "Fire when message count in window is too low" },
  { key: "no_traffic",          label: "No Traffic Detected",   icon: Zap,           color: "text-purple-600 bg-purple-50 border-purple-200", description: "Fire when zero messages in the time window" },
];

const SEVERITY_COLORS = {
  info:     "bg-blue-50 text-blue-700 border-blue-200",
  warning:  "bg-yellow-50 text-yellow-700 border-yellow-200",
  critical: "bg-red-50 text-red-700 border-red-200",
};

const emptyForm = {
  name: "", alert_type: "delivery_rate_below", threshold: 80,
  window_minutes: 60, min_messages: 10,
  notify_email: "", client_id: "", supplier_id: "",
  severity: "warning", is_active: true, cooldown_minutes: 60,
};

export default function AlertRules() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing]       = useState(null);
  const [form, setForm]             = useState({ ...emptyForm });
  const [running, setRunning]       = useState(false);
  const qc = useQueryClient();

  const { data: rules = [] }     = useQuery({ queryKey: ['alert-rules'], queryFn: () => base44.entities.AlertRule.list('-created_date'), initialData: [] });
  const { data: clients = [] }   = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list(), initialData: [] });
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: () => base44.entities.Supplier.list(), initialData: [] });
  const { data: notifications = [] } = useQuery({ queryKey: ['notifications'], queryFn: () => base44.entities.Notification.list('-created_date', 50), initialData: [], refetchInterval: 30000 });

  const createMut = useMutation({
    mutationFn: (d) => base44.entities.AlertRule.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['alert-rules'] }); setDialogOpen(false); toast.success("Alert rule created"); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.AlertRule.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['alert-rules'] }); setDialogOpen(false); toast.success("Alert rule updated"); },
  });
  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.AlertRule.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['alert-rules'] }); toast.success("Rule deleted"); },
  });
  const toggleMut = useMutation({
    mutationFn: ({ id, is_active }) => base44.entities.AlertRule.update(id, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alert-rules'] }),
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = () => {
    const clientObj   = clients.find(c => c.id === form.client_id);
    const supplierObj = suppliers.find(s => s.id === form.supplier_id);
    const data = {
      ...form,
      client_name:   clientObj?.name || '',
      supplier_name: supplierObj?.name || '',
    };
    if (editing) updateMut.mutate({ id: editing.id, data });
    else createMut.mutate(data);
  };

  const openAdd = () => { setEditing(null); setForm({ ...emptyForm }); setDialogOpen(true); };
  const openEdit = (r) => { setEditing(r); setForm({ ...emptyForm, ...r }); setDialogOpen(true); };

  const runNow = async () => {
    setRunning(true);
    try {
      const res = await base44.functions.invoke('evaluateAlerts', {});
      toast.success(`Evaluated ${res.data?.evaluated || 0} rules — ${res.data?.results?.filter(r => r.fired).length || 0} fired`);
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['alert-rules'] });
    } catch (e) {
      toast.error("Failed to run alerts: " + e.message);
    } finally {
      setRunning(false);
    }
  };

  const activeCount = rules.filter(r => r.is_active).length;
  const recentAlerts = notifications.filter(n => n.type === 'system_alert').slice(0, 10);

  const getTypeInfo = (key) => ALERT_TYPES.find(t => t.key === key) || ALERT_TYPES[0];

  const thresholdLabel = (type) => {
    if (type === 'delivery_rate_below' || type === 'failure_rate_above') return 'Threshold (%)';
    if (type === 'balance_below') return 'Balance Threshold (USD)';
    if (type === 'volume_drop') return 'Min Messages Expected';
    return 'Threshold';
  };

  return (
    <div className="space-y-6">
      <PageHeader title="SMS Alert Rules" description={`${activeCount} active rules — automated email alerts for SMS traffic events`}>
        <Button variant="outline" onClick={runNow} disabled={running}>
          <Play className="w-4 h-4 mr-2" />{running ? 'Running…' : 'Run Now'}
        </Button>
        <Button onClick={openAdd}>
          <Plus className="w-4 h-4 mr-2" />Add Rule
        </Button>
      </PageHeader>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Rules",   value: rules.length,                                   color: "text-blue-600 bg-blue-50 border-blue-200",   icon: Bell },
          { label: "Active",        value: activeCount,                                     color: "text-green-600 bg-green-50 border-green-200", icon: CheckCircle2 },
          { label: "Recent Alerts", value: recentAlerts.length,                            color: "text-orange-600 bg-orange-50 border-orange-200", icon: AlertTriangle },
          { label: "Last Check",    value: rules.some(r => r.last_triggered_at) ? "✓" : "—", color: "text-purple-600 bg-purple-50 border-purple-200", icon: Clock },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg border ${s.color} shrink-0`}><s.icon className="w-4 h-4" /></div>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-bold">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="rules">
        <TabsList>
          <TabsTrigger value="rules"><Bell className="w-3.5 h-3.5 mr-1.5" />Alert Rules</TabsTrigger>
          <TabsTrigger value="history"><Clock className="w-3.5 h-3.5 mr-1.5" />Alert History</TabsTrigger>
        </TabsList>

        {/* Rules Tab */}
        <TabsContent value="rules" className="mt-4 space-y-3">
          {rules.length === 0 && (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              No alert rules yet. Click "Add Rule" to create your first one.
            </CardContent></Card>
          )}
          {rules.map(rule => {
            const typeInfo = getTypeInfo(rule.alert_type);
            return (
              <Card key={rule.id} className={rule.is_active ? '' : 'opacity-60'}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`p-2 rounded-lg border shrink-0 ${typeInfo.color}`}>
                        <typeInfo.icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-semibold text-sm">{rule.name}</span>
                          <Badge variant="outline" className={`text-xs ${SEVERITY_COLORS[rule.severity]}`}>{rule.severity}</Badge>
                          <Badge variant="outline" className="text-xs">{typeInfo.label}</Badge>
                          {rule.client_name && <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200">{rule.client_name}</Badge>}
                          {rule.supplier_name && <Badge variant="outline" className="text-xs bg-teal-50 text-teal-700 border-teal-200">{rule.supplier_name}</Badge>}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>Threshold: <strong>{rule.threshold}{rule.alert_type?.includes('rate') ? '%' : ''}</strong></span>
                          <span>Window: <strong>{rule.window_minutes}m</strong></span>
                          <span>Cooldown: <strong>{rule.cooldown_minutes}m</strong></span>
                          {rule.alert_type !== 'no_traffic' && <span>Min msgs: <strong>{rule.min_messages}</strong></span>}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                          <Mail className="w-3 h-3" />
                          <span className="truncate">{rule.notify_email}</span>
                        </div>
                        {rule.last_triggered_at && (
                          <p className="text-xs text-orange-600 mt-1">Last fired: {format(new Date(rule.last_triggered_at), 'dd/MM/yyyy HH:mm')}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch checked={rule.is_active} onCheckedChange={(v) => toggleMut.mutate({ id: rule.id, is_active: v })} />
                      <Button variant="ghost" size="icon" onClick={() => openEdit(rule)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMut.mutate(rule.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-4 space-y-3">
          {recentAlerts.length === 0 && (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No alerts fired yet.</CardContent></Card>
          )}
          {recentAlerts.map(n => (
            <Card key={n.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg border shrink-0 ${SEVERITY_COLORS[n.severity]}`}>
                    <Bell className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-semibold text-sm">{n.title}</span>
                      <Badge variant="outline" className={`text-xs ${SEVERITY_COLORS[n.severity]}`}>{n.severity}</Badge>
                      {!n.is_read && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                    </div>
                    <p className="text-sm text-muted-foreground">{n.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">{format(new Date(n.created_date), 'dd/MM/yyyy HH:mm:ss')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Alert Rule' : 'New Alert Rule'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Rule Name *</Label>
              <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Low delivery rate alert" />
            </div>

            <div className="space-y-1.5">
              <Label>Alert Type *</Label>
              <Select value={form.alert_type} onValueChange={v => set('alert_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALERT_TYPES.map(t => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{getTypeInfo(form.alert_type).description}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{thresholdLabel(form.alert_type)} *</Label>
                <Input type="number" value={form.threshold} onChange={e => set('threshold', Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Severity</Label>
                <Select value={form.severity} onValueChange={v => set('severity', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Time Window (minutes)</Label>
                <Input type="number" value={form.window_minutes} onChange={e => set('window_minutes', Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Cooldown (minutes)</Label>
                <Input type="number" value={form.cooldown_minutes} onChange={e => set('cooldown_minutes', Number(e.target.value))} />
              </div>
              {form.alert_type !== 'no_traffic' && form.alert_type !== 'balance_below' && (
                <div className="space-y-1.5 col-span-2">
                  <Label>Min Messages (avoid false positives)</Label>
                  <Input type="number" value={form.min_messages} onChange={e => set('min_messages', Number(e.target.value))} />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Notify Email(s) * <span className="text-muted-foreground font-normal">(comma-separated)</span></Label>
              <Input value={form.notify_email} onChange={e => set('notify_email', e.target.value)} placeholder="admin@company.com, ops@company.com" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Filter by Client <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Select value={form.client_id || '__all__'} onValueChange={v => set('client_id', v === '__all__' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="All clients" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All clients</SelectItem>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {form.alert_type !== 'balance_below' && (
                <div className="space-y-1.5">
                  <Label>Filter by Supplier <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Select value={form.supplier_id || '__all__'} onValueChange={v => set('supplier_id', v === '__all__' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="All suppliers" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All suppliers</SelectItem>
                      {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Switch checked={form.is_active} onCheckedChange={v => set('is_active', v)} id="rule-active" />
              <Label htmlFor="rule-active">Rule is active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!form.name || !form.notify_email}>
              {editing ? 'Update Rule' : 'Create Rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}