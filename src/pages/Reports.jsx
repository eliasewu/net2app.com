import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/shared/PageHeader";
import StatsCard from "@/components/shared/StatsCard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from "recharts";
import { MessageSquare, CheckCircle, XCircle, DollarSign } from "lucide-react";

export default function Reports() {
  const [period, setPeriod] = useState("daily");

  const { data: logs = [] } = useQuery({
    queryKey: ['report-logs'],
    queryFn: () => base44.entities.SmsLog.list('-created_date', 200),
    initialData: [],
  });

  const total = logs.length;
  const delivered = logs.filter(l => l.status === 'delivered').length;
  const failed = logs.filter(l => l.status === 'failed').length;
  const revenue = logs.reduce((sum, l) => sum + (l.sell_rate || 0), 0);
  const cost = logs.reduce((sum, l) => sum + (l.cost || 0), 0);

  const clientBreakdown = useMemo(() => {
    const map = {};
    logs.forEach(l => {
      if (!map[l.client_name]) map[l.client_name] = { name: l.client_name, total: 0, delivered: 0, failed: 0, revenue: 0 };
      map[l.client_name].total++;
      if (l.status === 'delivered') map[l.client_name].delivered++;
      if (l.status === 'failed') map[l.client_name].failed++;
      map[l.client_name].revenue += (l.sell_rate || 0);
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [logs]);

  const countryBreakdown = useMemo(() => {
    const map = {};
    logs.forEach(l => {
      const c = l.country || 'Unknown';
      if (!map[c]) map[c] = { name: c, total: 0, delivered: 0, failed: 0 };
      map[c].total++;
      if (l.status === 'delivered') map[c].delivered++;
      if (l.status === 'failed') map[c].failed++;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [logs]);

  const hourlyChart = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => ({
      hour: `${String(i).padStart(2, '0')}:00`,
      delivered: logs.filter(l => new Date(l.created_date).getHours() === i && l.status === 'delivered').length,
      failed: logs.filter(l => new Date(l.created_date).getHours() === i && l.status === 'failed').length,
    }));
  }, [logs]);

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Analytics and traffic reports" />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard title="Total SMS" value={total} icon={MessageSquare} color="primary" />
        <StatsCard title="Delivered" value={delivered} icon={CheckCircle} color="success" trend={total > 0 ? `${((delivered/total)*100).toFixed(1)}%` : '0%'} trendUp />
        <StatsCard title="Failed" value={failed} icon={XCircle} color="danger" />
        <StatsCard title="Revenue" value={`$${revenue.toFixed(2)}`} icon={DollarSign} color="warning" trend={`Cost: $${cost.toFixed(2)}`} trendUp={revenue > cost} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Hourly Delivery Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={hourlyChart}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="delivered" stroke="hsl(142, 71%, 45%)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="failed" stroke="hsl(0, 84%, 60%)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base font-semibold">By Client</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Delivered</TableHead>
                  <TableHead>Failed</TableHead>
                  <TableHead>Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientBreakdown.map((c) => (
                  <TableRow key={c.name}>
                    <TableCell className="font-medium">{c.name || 'N/A'}</TableCell>
                    <TableCell>{c.total}</TableCell>
                    <TableCell className="text-green-600">{c.delivered}</TableCell>
                    <TableCell className="text-red-600">{c.failed}</TableCell>
                    <TableCell className="font-mono">${c.revenue.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base font-semibold">By Country</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Country</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Delivered</TableHead>
                  <TableHead>Failed</TableHead>
                  <TableHead>ASR</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {countryBreakdown.map((c) => (
                  <TableRow key={c.name}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.total}</TableCell>
                    <TableCell className="text-green-600">{c.delivered}</TableCell>
                    <TableCell className="text-red-600">{c.failed}</TableCell>
                    <TableCell>{c.total > 0 ? `${((c.delivered/c.total)*100).toFixed(1)}%` : '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}