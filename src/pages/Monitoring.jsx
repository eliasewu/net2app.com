import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/shared/PageHeader";
import StatsCard from "@/components/shared/StatsCard";
import StatusBadge from "@/components/shared/StatusBadge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Activity, CheckCircle, XCircle, Clock, Zap } from "lucide-react";
import { format } from "date-fns";

export default function Monitoring() {
  const { data: logs = [] } = useQuery({
    queryKey: ['monitor-logs'],
    queryFn: () => base44.entities.SmsLog.list('-created_date', 50),
    initialData: [],
    refetchInterval: 3000,
  });

  const { data: routes = [] } = useQuery({
    queryKey: ['monitor-routes'],
    queryFn: () => base44.entities.Route.list(),
    initialData: [],
    refetchInterval: 10000,
  });

  const delivered = logs.filter(l => l.status === 'delivered').length;
  const failed = logs.filter(l => l.status === 'failed').length;
  const pending = logs.filter(l => l.status === 'pending' || l.status === 'sent').length;
  const tps = logs.filter(l => {
    const diff = Date.now() - new Date(l.created_date).getTime();
    return diff < 60000;
  }).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Live Monitoring" description="Real-time SMS traffic overview">
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 animate-pulse">
          <Activity className="w-3 h-3 mr-1" /> LIVE
        </Badge>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard title="Messages/min" value={tps} icon={Zap} color="primary" />
        <StatsCard title="Delivered" value={delivered} icon={CheckCircle} color="success" />
        <StatsCard title="Failed" value={failed} icon={XCircle} color="danger" />
        <StatsCard title="Pending" value={pending} icon={Clock} color="warning" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Live SMS Feed</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Number</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Content</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Dest Msg ID</TableHead>
                    <TableHead>Fail Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs whitespace-nowrap">{format(new Date(log.created_date), 'HH:mm:ss')}</TableCell>
                      <TableCell className="font-mono text-sm">{log.destination}</TableCell>
                      <TableCell className="text-sm">{log.client_name}</TableCell>
                      <TableCell className="text-sm">{log.supplier_name}</TableCell>
                      <TableCell className="text-sm max-w-[150px] truncate">{log.content}</TableCell>
                      <TableCell><StatusBadge status={log.status} /></TableCell>
                      <TableCell className="font-mono text-xs">{log.dest_message_id?.slice(0, 12)}</TableCell>
                      <TableCell className="text-xs text-destructive">{log.fail_reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Route Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {routes.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="font-medium text-sm">{r.name}</p>
                  <p className="text-xs text-muted-foreground">{r.client_name} → {r.supplier_name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{r.fail_count || 0} fails</span>
                  <StatusBadge status={r.is_auto_blocked ? 'blocked' : r.status} />
                </div>
              </div>
            ))}
            {routes.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">No routes</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}