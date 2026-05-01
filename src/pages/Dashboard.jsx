import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Users, Building2, Route, CheckCircle2, XCircle, Clock, Activity, Server, Phone, Send, Mic, Wifi } from "lucide-react";
import DeploymentStatus from "@/components/dashboard/DeploymentStatus";
import SmsVolumeTrend from "@/components/dashboard/SmsVolumeTrend";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: smsLogs = [] } = useQuery({
    queryKey: ['sms-logs-dash'],
    queryFn: () => base44.entities.SmsLog.list('-created_date', 200),
    initialData: [],
    refetchInterval: 60000,
  });
  const { data: clients = [] } = useQuery({ queryKey: ['clients-dash'], queryFn: () => base44.entities.Client.list(), initialData: [] });
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers-dash'], queryFn: () => base44.entities.Supplier.list(), initialData: [] });
  const { data: routes = [] } = useQuery({ queryKey: ['routes-dash'], queryFn: () => base44.entities.Route.list(), initialData: [] });
  const { data: platforms = [] } = useQuery({ queryKey: ['voip-platforms-dash'], queryFn: () => base44.entities.VoipPlatform.list(), initialData: [], refetchInterval: 30000 });
  const { data: nodes = [] } = useQuery({ queryKey: ['server-nodes-dash'], queryFn: () => base44.entities.ServerNode.list(), initialData: [] });
  const { data: voiceOtps = [] } = useQuery({ queryKey: ['voice-otp-dash'], queryFn: () => base44.entities.VoiceOtp.list('-created_date', 200), initialData: [], refetchInterval: 60000 });
  const { data: campaigns = [] } = useQuery({ queryKey: ['campaigns-dash'], queryFn: () => base44.entities.Campaign.list(), initialData: [] });

  // SMS stats
  const smsAll = smsLogs.filter(l => l.sms_type !== 'voice_otp');
  const smsSuccess = smsAll.filter(l => l.status === 'delivered').length;
  const smsFail = smsAll.filter(l => l.status === 'failed' || l.status === 'rejected').length;
  const smsTotal = smsAll.length;
  const smsRate = smsTotal > 0 ? Math.round((smsSuccess / smsTotal) * 100) : 0;

  // WhatsApp stats (campaigns channel=whatsapp)
  const waCampaigns = campaigns.filter(c => c.channel === 'whatsapp');
  const waSuccess = waCampaigns.reduce((a, c) => a + (c.delivered_count || 0), 0);
  const waFail = waCampaigns.reduce((a, c) => a + (c.failed_count || 0), 0);
  const waTotal = waSuccess + waFail;

  // IMO stats
  const imoCampaigns = campaigns.filter(c => c.channel === 'imo');
  const imoSuccess = imoCampaigns.reduce((a, c) => a + (c.delivered_count || 0), 0);
  const imoFail = imoCampaigns.reduce((a, c) => a + (c.failed_count || 0), 0);

  // Voice OTP stats
  const voiceSuccess = voiceOtps.filter(v => v.status === 'delivered' || v.status === 'connected').length;
  const voiceFail = voiceOtps.filter(v => v.status === 'failed' || v.status === 'undelivered' || v.status === 'no_answer' || v.status === 'busy').length;
  const voiceTotal = voiceOtps.length;

  // VoIP metrics (simulated from nodes/platforms)
  const activePlatform = platforms.find(p => p.status === 'active') || platforms[0];
  const onlineNodes = nodes.filter(n => n.status === 'online');
  const totalActiveCalls = onlineNodes.reduce((a, n) => a + (n.active_calls || 0), 0);
  const liveASR = voiceTotal > 0 ? Math.round(((voiceSuccess) / Math.max(voiceTotal, 1)) * 100) : 0;
  const liveACD = voiceOtps.filter(v => v.duration > 0).reduce((a, v, _, arr) => a + v.duration / arr.length, 0);

  const statusColor = s => {
    const map = { delivered: 'bg-green-50 text-green-700 border-green-200', failed: 'bg-red-50 text-red-700 border-red-200', pending: 'bg-yellow-50 text-yellow-700 border-yellow-200', sent: 'bg-blue-50 text-blue-700 border-blue-200', rejected: 'bg-red-50 text-red-700 border-red-200', blocked: 'bg-gray-50 text-gray-700 border-gray-200' };
    return map[s] || 'bg-gray-50 text-gray-700 border-gray-200';
  };

  const ChannelCard = ({ icon: Icon, label, success, fail, total, color, rate }) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className={`p-2 rounded-lg border ${color}`}><Icon className="w-4 h-4" /></div>
          <span className="font-semibold text-sm">{label}</span>
          {rate !== undefined && <Badge variant="outline" className="ml-auto text-xs">{rate}% ASR</Badge>}
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-green-50 rounded-lg p-2">
            <p className="text-xs text-green-600 font-medium">Success</p>
            <p className="text-lg font-bold text-green-700">{success.toLocaleString()}</p>
          </div>
          <div className="bg-red-50 rounded-lg p-2">
            <p className="text-xs text-red-600 font-medium">Failed</p>
            <p className="text-lg font-bold text-red-700">{fail.toLocaleString()}</p>
          </div>
          <div className="bg-muted rounded-lg p-2">
            <p className="text-xs text-muted-foreground font-medium">Total</p>
            <p className="text-lg font-bold">{total.toLocaleString()}</p>
          </div>
        </div>
        {total > 0 && (
          <div className="mt-2 w-full bg-muted rounded-full h-1.5">
            <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${Math.round((success / total) * 100)}%` }} />
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Real-time overview — SMS, WhatsApp, IMO, Voice OTP, VoIP • auto-refreshes every 60s</p>
      </div>

      {/* Channel Stats — 4 columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <ChannelCard icon={MessageSquare} label="SMS" success={smsSuccess} fail={smsFail} total={smsTotal} color="text-blue-600 bg-blue-50 border-blue-200" rate={smsRate} />
        <ChannelCard icon={Send} label="WhatsApp" success={waSuccess} fail={waFail} total={waTotal} color="text-green-600 bg-green-50 border-green-200" />
        <ChannelCard icon={Wifi} label="IMO" success={imoSuccess} fail={imoFail} total={imoSuccess + imoFail} color="text-cyan-600 bg-cyan-50 border-cyan-200" />
        <ChannelCard icon={Mic} label="Voice OTP" success={voiceSuccess} fail={voiceFail} total={voiceTotal} color="text-orange-600 bg-orange-50 border-orange-200" />
      </div>

      {/* VoIP + Infrastructure row */}
      <div className="grid md:grid-cols-4 gap-4">
        {/* Live ASR */}
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-semibold mb-1">Live ASR</p>
            <p className="text-3xl font-bold text-green-600">{liveASR}%</p>
            <p className="text-xs text-muted-foreground mt-1">Answer-Seizure Ratio</p>
            <div className="w-full bg-muted rounded-full h-1.5 mt-2">
              <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${liveASR}%` }} />
            </div>
          </CardContent>
        </Card>

        {/* Live ACD */}
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-semibold mb-1">Live ACD</p>
            <p className="text-3xl font-bold text-blue-600">{liveACD > 0 ? liveACD.toFixed(1) : '—'}s</p>
            <p className="text-xs text-muted-foreground mt-1">Avg Call Duration</p>
          </CardContent>
        </Card>

        {/* Active Calls */}
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-semibold mb-1">Active Calls</p>
            <p className="text-3xl font-bold text-purple-600">{totalActiveCalls}</p>
            <p className="text-xs text-muted-foreground mt-1">Across {onlineNodes.length} nodes</p>
          </CardContent>
        </Card>

        {/* VoIP Platform */}
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-semibold mb-1">VoIP Platform</p>
            {activePlatform ? (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${activePlatform.status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                  <span className="font-semibold text-sm">{activePlatform.name}</span>
                </div>
                <p className="text-xs font-mono text-muted-foreground">{activePlatform.host}</p>
                <p className="text-xs text-muted-foreground">{activePlatform.platform_type}</p>
              </div>
            ) : <p className="text-sm text-muted-foreground">Not configured</p>}
          </CardContent>
        </Card>
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Active Clients", value: clients.filter(c => c.status === 'active').length, icon: Users, color: "text-purple-600 bg-purple-50 border-purple-200" },
          { label: "Active Suppliers", value: suppliers.filter(s => s.status === 'active').length, icon: Building2, color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
          { label: "Active Routes", value: routes.filter(r => r.status === 'active').length, icon: Route, color: "text-teal-600 bg-teal-50 border-teal-200" },
          { label: "Servers Online", value: onlineNodes.length, icon: Server, color: "text-orange-600 bg-orange-50 border-orange-200" },
        ].map(s => (
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

      {/* SMS Volume Trend */}
      <SmsVolumeTrend smsLogs={smsLogs} clients={clients} />

      {/* Deployment Status */}
      <DeploymentStatus />

      {/* Recent SMS Logs */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4" />Recent Messages</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Auto-refresh 60s</span>
            <Badge variant="outline">{smsLogs.length} records</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted border-b">
                  {["Time", "Destination", "Sender", "Client", "Supplier", "Country", "Status"].map(h => (
                    <th key={h} className="text-left p-3 text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {smsLogs.slice(0, 15).map((log, i) => (
                  <tr key={log.id} className={`border-b hover:bg-accent/30 ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                    <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{log.created_date ? format(new Date(log.created_date), 'dd/MM HH:mm:ss') : '—'}</td>
                    <td className="p-3 font-mono font-semibold">{log.destination}</td>
                    <td className="p-3 text-xs">{log.sender_id || '—'}</td>
                    <td className="p-3 text-muted-foreground text-xs">{log.client_name || '—'}</td>
                    <td className="p-3 text-muted-foreground text-xs">{log.supplier_name || '—'}</td>
                    <td className="p-3 text-xs">{log.country || '—'}</td>
                    <td className="p-3">
                      <Badge variant="outline" className={`text-xs ${statusColor(log.status)}`}>{log.status}</Badge>
                    </td>
                  </tr>
                ))}
                {smsLogs.length === 0 && (
                  <tr><td colSpan={7} className="text-center text-muted-foreground py-12">No messages yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}