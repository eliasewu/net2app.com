import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Users, Building2, Route, CheckCircle2, XCircle, Clock, Activity, Server, Phone } from "lucide-react";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: smsLogs = [] } = useQuery({
    queryKey: ['sms-logs-dash'],
    queryFn: () => base44.entities.SmsLog.list('-created_date', 100),
    initialData: [],
    refetchInterval: 10000,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-dash'],
    queryFn: () => base44.entities.Client.list(),
    initialData: [],
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-dash'],
    queryFn: () => base44.entities.Supplier.list(),
    initialData: [],
  });

  const { data: routes = [] } = useQuery({
    queryKey: ['routes-dash'],
    queryFn: () => base44.entities.Route.list(),
    initialData: [],
  });

  const { data: platforms = [] } = useQuery({
    queryKey: ['voip-platforms-dash'],
    queryFn: () => base44.entities.VoipPlatform.list(),
    initialData: [],
  });

  const { data: nodes = [] } = useQuery({
    queryKey: ['server-nodes-dash'],
    queryFn: () => base44.entities.ServerNode.list(),
    initialData: [],
  });

  const delivered = smsLogs.filter(l => l.status === 'delivered').length;
  const failed = smsLogs.filter(l => l.status === 'failed').length;
  const pending = smsLogs.filter(l => l.status === 'pending' || l.status === 'sent').length;
  const total = smsLogs.length;
  const deliveryRate = total > 0 ? Math.round((delivered / total) * 100) : 0;

  const activePlatform = platforms.find(p => p.status === 'active') || platforms[0];
  const onlineNodes = nodes.filter(n => n.status === 'online').length;

  const stats = [
    { label: "SMS (last 100)", value: total, icon: MessageSquare, color: "text-blue-600 bg-blue-50 border-blue-200" },
    { label: "Delivered", value: delivered, icon: CheckCircle2, color: "text-green-600 bg-green-50 border-green-200" },
    { label: "Failed", value: failed, icon: XCircle, color: "text-red-600 bg-red-50 border-red-200" },
    { label: "Pending / Sent", value: pending, icon: Clock, color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
    { label: "Active Clients", value: clients.filter(c => c.status === 'active').length, icon: Users, color: "text-purple-600 bg-purple-50 border-purple-200" },
    { label: "Active Suppliers", value: suppliers.filter(s => s.status === 'active').length, icon: Building2, color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
    { label: "Active Routes", value: routes.filter(r => r.status === 'active').length, icon: Route, color: "text-teal-600 bg-teal-50 border-teal-200" },
    { label: "Servers Online", value: onlineNodes, icon: Server, color: "text-orange-600 bg-orange-50 border-orange-200" },
  ];

  const statusColor = s => {
    const map = { delivered: 'bg-green-50 text-green-700 border-green-200', failed: 'bg-red-50 text-red-700 border-red-200', pending: 'bg-yellow-50 text-yellow-700 border-yellow-200', sent: 'bg-blue-50 text-blue-700 border-blue-200', rejected: 'bg-red-50 text-red-700 border-red-200', blocked: 'bg-gray-50 text-gray-700 border-gray-200' };
    return map[s] || 'bg-gray-50 text-gray-700 border-gray-200';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Real-time overview of SMS traffic, clients, and infrastructure</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg border ${s.color}`}><s.icon className="w-4 h-4" /></div>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-bold">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Delivery Rate */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Delivery Rate</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 mb-2">
              <span className="text-4xl font-bold">{deliveryRate}%</span>
              <span className="text-sm text-muted-foreground mb-1">of last 100</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${deliveryRate}%` }} />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>{delivered} delivered</span>
              <span>{failed} failed</span>
            </div>
          </CardContent>
        </Card>

        {/* VoIP Status */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Phone className="w-4 h-4" />VoIP Platform</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {activePlatform ? (
              <>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${activePlatform.status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                  <span className="font-semibold text-sm">{activePlatform.name}</span>
                  <Badge variant="outline" className={activePlatform.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}>{activePlatform.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground font-mono">{activePlatform.host}:{activePlatform.sip_port}</p>
                <p className="text-xs text-muted-foreground">Type: {activePlatform.platform_type} | Version: {activePlatform.version || '—'}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No VoIP platform configured</p>
            )}
          </CardContent>
        </Card>

        {/* Server Nodes */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Server className="w-4 h-4" />Server Nodes</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {nodes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No nodes registered</p>
            ) : nodes.slice(0, 3).map(n => (
              <div key={n.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${n.status === 'online' ? 'bg-green-500 animate-pulse' : n.status === 'offline' ? 'bg-red-500' : 'bg-yellow-400'}`} />
                  <span className="font-medium">{n.label}</span>
                </div>
                <span className="text-xs font-mono text-muted-foreground">{n.server_ip}</span>
              </div>
            ))}
            {nodes.length > 3 && <p className="text-xs text-muted-foreground">+{nodes.length - 3} more</p>}
          </CardContent>
        </Card>
      </div>

      {/* Recent SMS Logs */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4" />Recent Messages</CardTitle>
          <Badge variant="outline">{smsLogs.length} records</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted border-b">
                  <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Time</th>
                  <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Destination</th>
                  <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Client</th>
                  <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Supplier</th>
                  <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {smsLogs.slice(0, 15).map((log, i) => (
                  <tr key={log.id} className={`border-b hover:bg-accent/30 ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                    <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{log.created_date ? format(new Date(log.created_date), 'dd/MM HH:mm:ss') : '—'}</td>
                    <td className="p-3 font-mono font-semibold">{log.destination}</td>
                    <td className="p-3 text-muted-foreground">{log.client_name || '—'}</td>
                    <td className="p-3 text-muted-foreground">{log.supplier_name || '—'}</td>
                    <td className="p-3">
                      <Badge variant="outline" className={`text-xs ${statusColor(log.status)}`}>{log.status}</Badge>
                    </td>
                  </tr>
                ))}
                {smsLogs.length === 0 && (
                  <tr><td colSpan={5} className="text-center text-muted-foreground py-12">No messages yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}