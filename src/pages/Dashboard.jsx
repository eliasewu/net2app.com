import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import StatsCard from "@/components/shared/StatsCard";
import StatusBadge from "@/components/shared/StatusBadge";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  MessageSquare, Users, Building2, Route, TrendingUp,
  AlertTriangle, CheckCircle, XCircle
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const PIE_COLORS = ["hsl(142, 71%, 45%)", "hsl(0, 84%, 60%)", "hsl(217, 91%, 50%)", "hsl(38, 92%, 50%)"];

export default function Dashboard() {
  const { data: smsLogs = [] } = useQuery({
    queryKey: ['dashboard-sms'],
    queryFn: () => base44.entities.SmsLog.list('-created_date', 50),
    initialData: [],
    refetchInterval: 10000,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['dashboard-clients'],
    queryFn: () => base44.entities.Client.list(),
    initialData: [],
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['dashboard-suppliers'],
    queryFn: () => base44.entities.Supplier.list(),
    initialData: [],
  });

  const { data: routes = [] } = useQuery({
    queryKey: ['dashboard-routes'],
    queryFn: () => base44.entities.Route.list(),
    initialData: [],
  });

  const totalSms = smsLogs.length;
  const delivered = smsLogs.filter(s => s.status === 'delivered').length;
  const failed = smsLogs.filter(s => s.status === 'failed').length;
  const pending = smsLogs.filter(s => s.status === 'pending' || s.status === 'sent').length;
  const deliveryRate = totalSms > 0 ? ((delivered / totalSms) * 100).toFixed(1) : 0;
  const blockedRoutes = routes.filter(r => r.is_auto_blocked).length;

  const statusData = [
    { name: "Delivered", value: delivered },
    { name: "Failed", value: failed },
    { name: "Pending", value: pending },
    { name: "Blocked", value: smsLogs.filter(s => s.status === 'blocked').length },
  ].filter(d => d.value > 0);

  const hourlyData = Array.from({ length: 24 }, (_, i) => ({
    hour: `${i}:00`,
    count: smsLogs.filter(s => {
      const h = new Date(s.created_date).getHours();
      return h === i;
    }).length,
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Real-time SMS gateway overview" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total SMS Today" value={totalSms} icon={MessageSquare} color="primary" trend={`${deliveryRate}% delivery`} trendUp={deliveryRate > 80} />
        <StatsCard title="Active Clients" value={clients.filter(c => c.status === 'active').length} icon={Users} color="success" />
        <StatsCard title="Active Suppliers" value={suppliers.filter(s => s.status === 'active').length} icon={Building2} color="warning" />
        <StatsCard title="Blocked Routes" value={blockedRoutes} icon={AlertTriangle} color="danger" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Hourly Traffic</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={hourlyData}>
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(217, 91%, 50%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Delivery Status</CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {statusData.map((_, index) => (
                      <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Recent SMS</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Destination</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {smsLogs.slice(0, 8).map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-sm">{log.destination}</TableCell>
                    <TableCell>{log.client_name}</TableCell>
                    <TableCell><StatusBadge status={log.status} /></TableCell>
                  </TableRow>
                ))}
                {smsLogs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">No SMS logs yet</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Route Health</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Route</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Fails</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {routes.slice(0, 8).map((route) => (
                  <TableRow key={route.id}>
                    <TableCell className="font-medium">{route.name}</TableCell>
                    <TableCell className="text-sm">{route.routing_mode}</TableCell>
                    <TableCell className="text-sm">{route.fail_count || 0}</TableCell>
                    <TableCell><StatusBadge status={route.is_auto_blocked ? 'blocked' : route.status} /></TableCell>
                  </TableRow>
                ))}
                {routes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">No routes configured</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}