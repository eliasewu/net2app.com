import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Activity, AlertTriangle, CheckCircle2, XCircle,
  RefreshCw, RotateCcw, Settings2, Clock
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const STATUS_CONFIG = {
  healthy:  { color: "text-green-700 bg-green-50 border-green-200",  icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: "Healthy" },
  degraded: { color: "text-yellow-700 bg-yellow-50 border-yellow-200", icon: <AlertTriangle className="w-3.5 h-3.5" />, label: "Degraded" },
  critical: { color: "text-red-700 bg-red-50 border-red-200",        icon: <XCircle className="w-3.5 h-3.5" />,       label: "Critical" },
  unknown:  { color: "text-gray-500 bg-gray-50 border-gray-200",     icon: <Activity className="w-3.5 h-3.5" />,      label: "No Data" },
};

export default function SupplierHealthPanel() {
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [thresholdEdit, setThresholdEdit] = useState({ threshold_error_rate: 30, threshold_min_messages: 10 });

  const { data: healthRecords = [] } = useQuery({
    queryKey: ["supplier-health"],
    queryFn: () => base44.entities.SupplierHealth.list(),
    initialData: [],
    refetchInterval: 30000,
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => base44.entities.Supplier.list(),
    initialData: [],
  });

  const updateHealth = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SupplierHealth.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["supplier-health"] }); toast.success("Threshold updated"); setEditingId(null); },
  });

  const reEnableSupplier = useMutation({
    mutationFn: async (health) => {
      await base44.entities.Supplier.update(health.supplier_id, { status: "active" });
      await base44.entities.SupplierHealth.update(health.id, { auto_disabled: false, status: "unknown" });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["suppliers"] }); qc.invalidateQueries({ queryKey: ["supplier-health"] }); toast.success("Supplier re-enabled"); },
  });

  const runHealthCheck = async () => {
    setRunning(true);
    try {
      const res = await base44.functions.invoke("supplierHealthCheck", {});
      qc.invalidateQueries({ queryKey: ["supplier-health"] });
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success(`Health check complete — ${res.data?.checked || 0} suppliers checked`);
    } catch (e) {
      toast.error("Health check failed: " + e.message);
    }
    setRunning(false);
  };

  // Merge health records with supplier list (show all suppliers)
  const rows = suppliers.map(sup => {
    const health = healthRecords.find(h => h.supplier_id === sup.id);
    return { supplier: sup, health };
  });

  const criticalCount = healthRecords.filter(h => h.status === "critical").length;
  const autoDisabled = healthRecords.filter(h => h.auto_disabled).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-600" />
            Supplier Health Monitor
            {criticalCount > 0 && <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">{criticalCount} Critical</Badge>}
            {autoDisabled > 0 && <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-xs">{autoDisabled} Auto-Disabled</Badge>}
          </CardTitle>
          <Button size="sm" variant="outline" onClick={runHealthCheck} disabled={running} className="gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${running ? "animate-spin" : ""}`} />
            {running ? "Running..." : "Run Health Check"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Computed from last 60 minutes of SMS logs. Auto-refreshes every 30s. Suppliers exceeding error threshold are automatically set to inactive.</p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted border-b">
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Supplier</th>
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Health</th>
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Error Rate</th>
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Success Rate</th>
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Latency</th>
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Volume (1h)</th>
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Threshold</th>
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Last Check</th>
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ supplier, health }) => {
                const s = health?.status || "unknown";
                const cfg = STATUS_CONFIG[s];
                const isAutoDisabled = health?.auto_disabled;
                const isEditing = editingId === supplier.id;

                return (
                  <tr key={supplier.id} className={`border-b hover:bg-accent/20 ${isAutoDisabled ? "bg-orange-50/50" : ""}`}>
                    <td className="p-3">
                      <div>
                        <p className="font-medium text-sm">{supplier.name}</p>
                        <p className="text-xs text-muted-foreground">{supplier.status}</p>
                        {isAutoDisabled && <span className="text-xs text-orange-600 font-semibold">⚠ Auto-disabled</span>}
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className={`text-xs gap-1 ${cfg.color}`}>
                        {cfg.icon}{cfg.label}
                      </Badge>
                    </td>
                    <td className="p-3">
                      {health ? (
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-muted rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full"
                              style={{
                                width: `${Math.min(health.error_rate, 100)}%`,
                                backgroundColor: health.error_rate >= 50 ? "#ef4444" : health.error_rate >= 25 ? "#f59e0b" : "#10b981",
                              }}
                            />
                          </div>
                          <span className="text-xs font-mono font-bold">{health.error_rate?.toFixed(1)}%</span>
                        </div>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="p-3">
                      {health ? (
                        <span className="text-xs font-mono font-bold text-green-700">{health.success_rate?.toFixed(1)}%</span>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="p-3">
                      {health?.latency_ms != null ? (
                        <span className="text-xs font-mono flex items-center gap-1">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          {health.latency_ms > 60000
                            ? `${(health.latency_ms / 60000).toFixed(1)}m`
                            : health.latency_ms > 1000
                              ? `${(health.latency_ms / 1000).toFixed(1)}s`
                              : `${health.latency_ms}ms`}
                        </span>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="p-3">
                      <span className="text-xs font-mono">{health?.total_checked ?? 0}</span>
                    </td>
                    <td className="p-3">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            className="w-14 h-6 text-xs px-1"
                            value={thresholdEdit.threshold_error_rate}
                            onChange={e => setThresholdEdit(p => ({ ...p, threshold_error_rate: parseFloat(e.target.value) }))}
                          />
                          <span className="text-xs text-muted-foreground">% / </span>
                          <Input
                            type="number"
                            className="w-12 h-6 text-xs px-1"
                            value={thresholdEdit.threshold_min_messages}
                            onChange={e => setThresholdEdit(p => ({ ...p, threshold_min_messages: parseInt(e.target.value) }))}
                          />
                          <span className="text-xs text-muted-foreground">msgs</span>
                          <Button size="sm" className="h-6 text-xs px-2" onClick={() => updateHealth.mutate({ id: health.id, data: thresholdEdit })}>✓</Button>
                          <Button size="sm" variant="ghost" className="h-6 text-xs px-1" onClick={() => setEditingId(null)}>✕</Button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingId(supplier.id);
                            setThresholdEdit({
                              threshold_error_rate: health?.threshold_error_rate ?? 30,
                              threshold_min_messages: health?.threshold_min_messages ?? 10,
                            });
                          }}
                          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                        >
                          <Settings2 className="w-3 h-3" />
                          {health?.threshold_error_rate ?? 30}% / {health?.threshold_min_messages ?? 10} msgs
                        </button>
                      )}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {health?.last_checked_at ? format(new Date(health.last_checked_at), "HH:mm:ss") : "Never"}
                    </td>
                    <td className="p-3">
                      {isAutoDisabled && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1 text-green-700 border-green-300 hover:bg-green-50"
                          onClick={() => reEnableSupplier.mutate(health)}
                        >
                          <RotateCcw className="w-3 h-3" />Re-enable
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={9} className="text-center text-muted-foreground py-8 text-sm">No suppliers found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}