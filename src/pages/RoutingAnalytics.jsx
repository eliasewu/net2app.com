import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import PageHeader from "@/components/shared/PageHeader";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  LineChart, Line, CartesianGrid,
} from "recharts";
import { TrendingDown, Activity, CheckCircle2, Zap } from "lucide-react";
import { RULE_TYPE_META } from "@/lib/routingEngine";
import { format, subDays } from "date-fns";
import SupplierHealthPanel from "@/components/routing/SupplierHealthPanel";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316"];

export default function RoutingAnalytics() {
  const { data: rules = [] } = useQuery({ queryKey: ["routing-rules"], queryFn: () => base44.entities.RoutingRule.list("priority"), initialData: [] });
  const { data: smsLogs = [] } = useQuery({ queryKey: ["sms-logs-analytics"], queryFn: () => base44.entities.SmsLog.list("-created_date", 500), initialData: [] });
  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers"], queryFn: () => base44.entities.Supplier.list(), initialData: [] });
  const { data: rates = [] } = useQuery({ queryKey: ["rates"], queryFn: () => base44.entities.Rate.list("-created_date", 500), initialData: [] });

  // ── Volume by rule type ───────────────────────────────────────────
  const ruleTypeVolume = Object.keys(RULE_TYPE_META).map(type => {
    const meta = RULE_TYPE_META[type];
    const count = rules.filter(r => r.rule_type === type).reduce((sum, r) => sum + (r.hit_count || 0), 0);
    return { name: meta.label.split(" — ")[0], hits: count, type };
  }).filter(r => r.hits > 0);

  // ── Top suppliers by success rate (from sms logs) ────────────────
  const supplierStats = {};
  smsLogs.forEach(log => {
    if (!log.supplier_name) return;
    if (!supplierStats[log.supplier_name]) {
      supplierStats[log.supplier_name] = { name: log.supplier_name, total: 0, delivered: 0, failed: 0 };
    }
    supplierStats[log.supplier_name].total++;
    if (log.status === "delivered") supplierStats[log.supplier_name].delivered++;
    if (log.status === "failed" || log.status === "rejected") supplierStats[log.supplier_name].failed++;
  });
  const topSuppliers = Object.values(supplierStats)
    .map(s => ({ ...s, rate: s.total > 0 ? Math.round((s.delivered / s.total) * 100) : 0 }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 8);

  // ── LCR cost savings over last 7 days ────────────────────────────
  // Estimate: for LCR-routed msgs, compare avg cost vs average rate card
  const lcrRules = rules.filter(r => r.rule_type === "lcr" && r.lcr_auto);
  const avgRateCard = rates.length > 0 ? rates.reduce((s, r) => s + (r.rate || 0), 0) / rates.length : 0;

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(new Date(), 6 - i);
    const dayStr = format(date, "MMM d");
    const dayLogs = smsLogs.filter(log => {
      const d = log.created_date ? new Date(log.created_date) : null;
      return d && format(d, "MMM d") === dayStr;
    });
    const delivered = dayLogs.filter(l => l.status === "delivered");
    const avgCost = delivered.length > 0 ? delivered.reduce((s, l) => s + (l.cost || 0), 0) / delivered.length : 0;
    const savings = avgRateCard > 0 && avgCost > 0 ? Math.max(0, (avgRateCard - avgCost) * delivered.length) : 0;
    return {
      day: dayStr,
      volume: dayLogs.length,
      delivered: delivered.length,
      avgCost: parseFloat(avgCost.toFixed(5)),
      savings: parseFloat(savings.toFixed(4)),
    };
  });

  // ── Rule type distribution pie ────────────────────────────────────
  const pieData = Object.keys(RULE_TYPE_META).map(type => {
    const meta = RULE_TYPE_META[type];
    const count = rules.filter(r => r.rule_type === type).length;
    return { name: meta.label.split(" — ")[0], value: count };
  }).filter(r => r.value > 0);

  // ── KPI cards ────────────────────────────────────────────────────
  const totalHits = rules.reduce((s, r) => s + (r.hit_count || 0), 0);
  const activeRules = rules.filter(r => r.is_active !== false).length;
  const totalSavings = last7Days.reduce((s, d) => s + d.savings, 0);
  const overallASR = smsLogs.length > 0
    ? Math.round((smsLogs.filter(l => l.status === "delivered").length / smsLogs.length) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Routing Analytics" description="Traffic trends, supplier performance, and LCR cost savings" />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Rule Hits", value: totalHits.toLocaleString(), icon: Activity, color: "text-blue-600 bg-blue-50 border-blue-200" },
          { label: "Active Rules", value: activeRules, icon: Zap, color: "text-green-600 bg-green-50 border-green-200" },
          { label: "Overall ASR", value: `${overallASR}%`, icon: CheckCircle2, color: "text-purple-600 bg-purple-50 border-purple-200" },
          { label: "Est. LCR Savings (7d)", value: `$${totalSavings.toFixed(3)}`, icon: TrendingDown, color: "text-orange-600 bg-orange-50 border-orange-200" },
        ].map(k => (
          <Card key={k.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg border ${k.color}`}><k.icon className="w-4 h-4" /></div>
              <div>
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className="text-xl font-bold">{k.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Row 1: Volume by rule type + Pie */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4" />Traffic Volume by Rule Type</CardTitle>
          </CardHeader>
          <CardContent>
            {ruleTypeVolume.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No hits recorded yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={ruleTypeVolume} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="hits" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Rule Type Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No rules configured yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Daily traffic + LCR savings */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Daily Message Volume (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={last7Days} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="volume" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="Total" />
                <Line type="monotone" dataKey="delivered" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="Delivered" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><TrendingDown className="w-4 h-4 text-green-600" />LCR Cost Savings (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={last7Days} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`$${v}`, "Savings"]} />
                <Bar dataKey="savings" fill="#10b981" radius={[4, 4, 0, 0]} name="Savings ($)" />
              </BarChart>
            </ResponsiveContainer>
            {avgRateCard === 0 && (
              <p className="text-xs text-muted-foreground text-center mt-2">Add rate cards to see LCR savings estimates</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top suppliers by success rate */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-600" />Top Suppliers by Success Rate</CardTitle>
        </CardHeader>
        <CardContent>
          {topSuppliers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">No SMS log data yet</p>
          ) : (
            <div className="space-y-3">
              {topSuppliers.map((s, i) => (
                <div key={s.name} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-muted-foreground w-5 text-right">{i + 1}</span>
                  <span className="text-sm font-medium w-36 truncate">{s.name}</span>
                  <div className="flex-1 bg-muted rounded-full h-2">
                    <div
                      className="h-2 rounded-full"
                      style={{ width: `${s.rate}%`, backgroundColor: s.rate >= 80 ? "#10b981" : s.rate >= 60 ? "#f59e0b" : "#ef4444" }}
                    />
                  </div>
                  <span className="text-sm font-bold w-12 text-right">{s.rate}%</span>
                  <Badge variant="outline" className="text-xs w-20 justify-center">{s.total.toLocaleString()} msgs</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Supplier Health Monitor */}
      <SupplierHealthPanel />

      {/* Rule hit leaderboard */}
      {rules.some(r => r.hit_count > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Rule Hit Leaderboard</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[...rules].sort((a, b) => (b.hit_count || 0) - (a.hit_count || 0)).slice(0, 8).map((rule, i) => {
                const meta = RULE_TYPE_META[rule.rule_type] || {};
                const maxHits = rules.reduce((m, r) => Math.max(m, r.hit_count || 0), 1);
                return (
                  <div key={rule.id} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-muted-foreground w-5 text-right">{i + 1}</span>
                    <Badge className={`text-xs border shrink-0 ${meta.color}`}>{meta.label?.split(" — ")[0]}</Badge>
                    <span className="text-sm font-medium flex-1 truncate">{rule.name}</span>
                    <div className="w-32 bg-muted rounded-full h-2">
                      <div className="h-2 rounded-full bg-blue-500" style={{ width: `${Math.round(((rule.hit_count || 0) / maxHits) * 100)}%` }} />
                    </div>
                    <span className="text-sm font-bold w-16 text-right">{(rule.hit_count || 0).toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}