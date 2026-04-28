import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { MessageSquare, TrendingUp, DollarSign, CheckCircle2, XCircle, Clock, Activity, RefreshCw } from "lucide-react";
import { format, subDays, startOfDay, parseISO, isAfter } from "date-fns";
import { Button } from "@/components/ui/button";

const STATUS_COLORS = {
  delivered: "#22c55e",
  sent: "#3b82f6",
  failed: "#ef4444",
  rejected: "#f97316",
  pending: "#eab308",
  blocked: "#6b7280",
};

const PIE_COLORS = ["#22c55e", "#3b82f6", "#ef4444", "#f97316", "#eab308", "#6b7280"];

function StatCard({ icon: Icon, label, value, sub, color = "text-blue-600 bg-blue-50 border-blue-200", trend }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-start gap-3">
        <div className={`p-2 rounded-lg border ${color} shrink-0`}><Icon className="w-4 h-4" /></div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold truncate">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          {trend !== undefined && (
            <p className={`text-xs font-medium mt-0.5 ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}% vs prev period
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function buildHourlyTraffic(logs) {
  const map = {};
  logs.forEach(l => {
    const key = l.created_date ? format(new Date(l.created_date), 'HH:00') : null;
    if (!key) return;
    if (!map[key]) map[key] = { hour: key, delivered: 0, failed: 0, pending: 0, sent: 0 };
    const s = l.status === 'rejected' ? 'failed' : (l.status || 'pending');
    if (map[key][s] !== undefined) map[key][s]++;
    else map[key].pending++;
  });
  return Object.values(map).sort((a, b) => a.hour.localeCompare(b.hour));
}

function buildDailyTraffic(logs, days) {
  const map = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = format(subDays(new Date(), i), 'dd/MM');
    map[d] = { day: d, delivered: 0, failed: 0, sent: 0, total: 0 };
  }
  logs.forEach(l => {
    if (!l.created_date) return;
    const d = format(new Date(l.created_date), 'dd/MM');
    if (!map[d]) return;
    const s = l.status === 'rejected' ? 'failed' : (l.status || 'pending');
    map[d].total++;
    if (map[d][s] !== undefined) map[d][s]++;
  });
  return Object.values(map);
}

function buildStatusPie(logs) {
  const map = {};
  logs.forEach(l => {
    const s = l.status || 'pending';
    map[s] = (map[s] || 0) + 1;
  });
  return Object.entries(map).map(([name, value]) => ({ name, value }));
}

function buildSupplierBreakdown(logs) {
  const map = {};
  logs.forEach(l => {
    const key = l.supplier_name || 'Unknown';
    if (!map[key]) map[key] = { supplier: key, total: 0, delivered: 0, failed: 0 };
    map[key].total++;
    if (l.status === 'delivered') map[key].delivered++;
    if (l.status === 'failed' || l.status === 'rejected') map[key].failed++;
  });
  return Object.values(map)
    .map(s => ({ ...s, asr: s.total > 0 ? Math.round((s.delivered / s.total) * 100) : 0 }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);
}

function buildCountryBreakdown(logs) {
  const map = {};
  logs.forEach(l => {
    const key = l.country || 'Unknown';
    if (!map[key]) map[key] = { country: key, total: 0, delivered: 0 };
    map[key].total++;
    if (l.status === 'delivered') map[key].delivered++;
  });
  return Object.values(map)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
}

export default function TenantDashboard() {
  const [period, setPeriod] = useState("7");
  const [chartView, setChartView] = useState("daily");

  const days = parseInt(period);
  const cutoff = startOfDay(subDays(new Date(), days));

  const { data: allLogs = [], isLoading, refetch } = useQuery({
    queryKey: ['tenant-dash-logs', period],
    queryFn: () => base44.entities.SmsLog.list('-created_date', 2000),
    initialData: [],
    refetchInterval: 60000,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['tenant-dash-invoices'],
    queryFn: () => base44.entities.Invoice.list('-created_date', 50),
    initialData: [],
  });

  // Filter logs to selected period
  const logs = allLogs.filter(l => {
    if (!l.created_date) return false;
    return isAfter(new Date(l.created_date), cutoff);
  });

  // Core metrics
  const total = logs.length;
  const delivered = logs.filter(l => l.status === 'delivered').length;
  const failed = logs.filter(l => l.status === 'failed' || l.status === 'rejected').length;
  const pending = logs.filter(l => l.status === 'pending' || l.status === 'sent').length;
  const asr = total > 0 ? Math.round((delivered / total) * 100) : 0;

  // Billing from invoices
  const totalRevenue = invoices.reduce((a, inv) => a + (inv.total_amount || 0), 0);
  const paidInvoices = invoices.filter(i => i.status === 'paid');
  const paidRevenue = paidInvoices.reduce((a, inv) => a + (inv.total_amount || 0), 0);

  // Cost from logs
  const totalCost = logs.reduce((a, l) => a + (l.cost || 0), 0);
  const totalSell = logs.reduce((a, l) => a + (l.sell_rate || 0), 0);
  const margin = totalSell - totalCost;

  // Chart data
  const hourlyData = buildHourlyTraffic(logs);
  const dailyData = buildDailyTraffic(logs, Math.min(days, 30));
  const statusPie = buildStatusPie(logs);
  const supplierData = buildSupplierBreakdown(logs);
  const countryData = buildCountryBreakdown(logs);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tenant Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">SMS traffic, delivery rates & billing — live data</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Today</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetch()} title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={MessageSquare} label="Total SMS" value={total.toLocaleString()} sub={`Last ${days} day${days > 1 ? 's' : ''}`} color="text-blue-600 bg-blue-50 border-blue-200" />
        <StatCard icon={CheckCircle2} label="Delivered" value={delivered.toLocaleString()} sub={`${asr}% delivery rate`} color="text-green-600 bg-green-50 border-green-200" />
        <StatCard icon={XCircle} label="Failed" value={failed.toLocaleString()} sub={total > 0 ? `${Math.round((failed / total) * 100)}% failure rate` : '—'} color="text-red-600 bg-red-50 border-red-200" />
        <StatCard icon={Clock} label="Pending/Sent" value={pending.toLocaleString()} sub="Awaiting DLR" color="text-yellow-600 bg-yellow-50 border-yellow-200" />
      </div>

      {/* Billing KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} label="Total Revenue" value={`$${totalSell.toFixed(2)}`} sub="Sell rate sum" color="text-emerald-600 bg-emerald-50 border-emerald-200" />
        <StatCard icon={DollarSign} label="Total Cost" value={`$${totalCost.toFixed(2)}`} sub="Supplier cost sum" color="text-orange-600 bg-orange-50 border-orange-200" />
        <StatCard icon={TrendingUp} label="Margin" value={`$${margin.toFixed(2)}`} sub={totalSell > 0 ? `${Math.round((margin / totalSell) * 100)}% margin` : '—'} color={margin >= 0 ? "text-green-600 bg-green-50 border-green-200" : "text-red-600 bg-red-50 border-red-200"} />
        <StatCard icon={Activity} label="Delivery Rate" value={`${asr}%`} sub={`${delivered} / ${total} messages`} color="text-purple-600 bg-purple-50 border-purple-200" />
      </div>

      {/* Traffic Chart */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4" />SMS Traffic</CardTitle>
          <div className="flex gap-1">
            <Button size="sm" variant={chartView === 'daily' ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setChartView('daily')}>Daily</Button>
            <Button size="sm" variant={chartView === 'hourly' ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setChartView('hourly')}>Hourly</Button>
          </div>
        </CardHeader>
        <CardContent>
          {(chartView === 'daily' ? dailyData : hourlyData).length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data for selected period</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartView === 'daily' ? dailyData : hourlyData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey={chartView === 'daily' ? 'day' : 'hour'} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="delivered" stackId="1" stroke="#22c55e" fill="#dcfce7" name="Delivered" />
                <Area type="monotone" dataKey="sent" stackId="1" stroke="#3b82f6" fill="#dbeafe" name="Sent" />
                <Area type="monotone" dataKey="failed" stackId="1" stroke="#ef4444" fill="#fee2e2" name="Failed" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Breakdown Charts */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Status Pie */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Status Distribution</CardTitle></CardHeader>
          <CardContent>
            {statusPie.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={statusPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                    {statusPie.map((entry, i) => (
                      <Cell key={i} fill={STATUS_COLORS[entry.name] || PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Supplier ASR */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Supplier Performance (ASR %)</CardTitle></CardHeader>
          <CardContent>
            {supplierData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={supplierData} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                  <YAxis type="category" dataKey="supplier" tick={{ fontSize: 10 }} width={90} />
                  <Tooltip formatter={(v) => `${v}%`} />
                  <Bar dataKey="asr" name="ASR %" fill="#3b82f6" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Country Breakdown + Supplier Volume Table */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Country Bar */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Top Destinations</CardTitle></CardHeader>
          <CardContent>
            {countryData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={countryData} layout="vertical" margin={{ left: 0, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="country" tick={{ fontSize: 10 }} width={80} />
                  <Tooltip />
                  <Bar dataKey="total" name="Total" fill="#8b5cf6" radius={[0, 3, 3, 0]} />
                  <Bar dataKey="delivered" name="Delivered" fill="#22c55e" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Supplier Volume Table */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Supplier Volume Summary</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted border-b">
                    <th className="text-left p-3 font-semibold">Supplier</th>
                    <th className="text-right p-3 font-semibold">Total</th>
                    <th className="text-right p-3 font-semibold">Delivered</th>
                    <th className="text-right p-3 font-semibold">Failed</th>
                    <th className="text-right p-3 font-semibold">ASR</th>
                  </tr>
                </thead>
                <tbody>
                  {supplierData.length === 0 && (
                    <tr><td colSpan={5} className="text-center text-muted-foreground py-8">No data</td></tr>
                  )}
                  {supplierData.map((s, i) => (
                    <tr key={i} className="border-b hover:bg-accent/20">
                      <td className="p-3 font-medium truncate max-w-[120px]">{s.supplier}</td>
                      <td className="p-3 text-right">{s.total.toLocaleString()}</td>
                      <td className="p-3 text-right text-green-600 font-medium">{s.delivered.toLocaleString()}</td>
                      <td className="p-3 text-right text-red-600">{s.failed.toLocaleString()}</td>
                      <td className="p-3 text-right">
                        <Badge variant="outline" className={`text-xs ${s.asr >= 80 ? 'bg-green-50 text-green-700 border-green-200' : s.asr >= 50 ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                          {s.asr}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Billing Summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><DollarSign className="w-4 h-4" />Invoice Summary</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted border-b">
                  <th className="text-left p-3 font-semibold">Invoice #</th>
                  <th className="text-left p-3 font-semibold">Client</th>
                  <th className="text-left p-3 font-semibold">Period</th>
                  <th className="text-right p-3 font-semibold">SMS</th>
                  <th className="text-right p-3 font-semibold">Amount</th>
                  <th className="text-left p-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-muted-foreground py-8">No invoices yet</td></tr>
                )}
                {invoices.slice(0, 10).map((inv, i) => (
                  <tr key={inv.id} className="border-b hover:bg-accent/20">
                    <td className="p-3 font-mono text-xs">{inv.invoice_number || '—'}</td>
                    <td className="p-3">{inv.client_name}</td>
                    <td className="p-3 text-muted-foreground">{inv.period_start} → {inv.period_end}</td>
                    <td className="p-3 text-right">{(inv.total_sms || 0).toLocaleString()}</td>
                    <td className="p-3 text-right font-semibold">{inv.currency || 'USD'} {(inv.total_amount || 0).toFixed(2)}</td>
                    <td className="p-3">
                      <Badge variant="outline" className={`text-xs ${
                        inv.status === 'paid' ? 'bg-green-50 text-green-700 border-green-200' :
                        inv.status === 'overdue' ? 'bg-red-50 text-red-700 border-red-200' :
                        inv.status === 'sent' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        'bg-gray-100 text-gray-600 border-gray-200'
                      }`}>{inv.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}