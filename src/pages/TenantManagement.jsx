import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Plus, Pencil, Trash2, Copy, Users, DollarSign, TrendingUp, AlertTriangle, Settings, Globe, ExternalLink, Server, Wifi } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import TenantForm from "@/components/tenant/TenantForm";
import TenantSettings from "@/components/tenant/TenantSettings";
import { generateKannelTenantConfig, generateUfwCommands } from "@/lib/portUtils";

const statusColor = s => {
  const m = { active: 'bg-green-50 text-green-700 border-green-200', suspended: 'bg-red-50 text-red-700 border-red-200', expired: 'bg-gray-50 text-gray-600 border-gray-200', pending: 'bg-yellow-50 text-yellow-700 border-yellow-200' };
  return m[s] || 'bg-gray-50 text-gray-600 border-gray-200';
};

export default function TenantManagement() {
  const [tab, setTab] = useState("tenants");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [settingsTenantId, setSettingsTenantId] = useState(null);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [serverIp, setServerIp] = useState("YOUR_SERVER_IP");
  const qc = useQueryClient();

  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => base44.entities.Tenant.list('-created_date'),
    initialData: [],
  });

  const createMut = useMutation({
    mutationFn: d => base44.entities.Tenant.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tenants'] }); setDialogOpen(false); toast.success("Tenant created! UFW commands generated."); }
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Tenant.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tenants'] }); setDialogOpen(false); toast.success("Tenant updated"); }
  });
  const deleteMut = useMutation({
    mutationFn: id => base44.entities.Tenant.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tenants'] }); toast.success("Tenant deleted"); }
  });
  const suspendMut = useMutation({
    mutationFn: ({ id, status }) => base44.entities.Tenant.update(id, { status }),
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ['tenants'] }); toast.success(`Tenant ${vars.status}`); }
  });

  const handleSave = (data) => {
    if (editing) updateMut.mutate({ id: editing.id, data });
    else createMut.mutate(data);
  };

  // Stats
  const active = tenants.filter(t => t.status === 'active').length;
  const suspended = tenants.filter(t => t.status === 'suspended').length;
  const totalMRR = tenants.filter(t => t.status === 'active').reduce((s, t) => s + (t.monthly_price || 0), 0);
  const nearLimit = tenants.filter(t => t.sms_limit > 0 && (t.sms_used / t.sms_limit) > 0.8).length;

  const allKannelConfig = tenants.map(t => generateKannelTenantConfig(t)).join('\n\n');
  const allUfwCommands = tenants.map(t => generateUfwCommands(t)).join('\n');

  return (
    <div className="space-y-4">
      <PageHeader title="Tenant Management" description="Multi-tenant rental platform — per-tenant SMPP/HTTP ports, usage limits, Kannel auto-provisioning">
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />Create Tenant
        </Button>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Tenants", value: tenants.length, icon: Users, color: "text-blue-600 bg-blue-50 border-blue-200" },
          { label: "Active", value: active, icon: Users, color: "text-green-600 bg-green-50 border-green-200" },
          { label: "Monthly Revenue", value: `$${totalMRR}`, icon: DollarSign, color: "text-purple-600 bg-purple-50 border-purple-200" },
          { label: "Near Limit", value: nearLimit, icon: AlertTriangle, color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
        ].map(s => (
          <Card key={s.label}><CardContent className="p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg border ${s.color}`}><s.icon className="w-4 h-4" /></div>
            <div><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-xl font-bold">{s.value}</p></div>
          </CardContent></Card>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="tenants">Tenants ({tenants.length})</TabsTrigger>
          <TabsTrigger value="access"><Globe className="w-3.5 h-3.5 mr-1" />Tenant Access URLs</TabsTrigger>
          <TabsTrigger value="ports">Port Map</TabsTrigger>
          <TabsTrigger value="kannel">Kannel Config</TabsTrigger>
          <TabsTrigger value="ufw">UFW Commands</TabsTrigger>
          <TabsTrigger value="settings"><Settings className="w-3.5 h-3.5 mr-1" />Tenant SMTP/Logo</TabsTrigger>
        </TabsList>

        {/* Tenant List */}
        <TabsContent value="tenants" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Package</TableHead>
                    <TableHead>SMPP Port</TableHead>
                    <TableHead>HTTP Port</TableHead>
                    <TableHead>SMS Usage</TableHead>
                    <TableHead>Price/mo</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>DLR Mode</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.map(t => {
                    const smsPercent = t.sms_limit > 0 ? Math.min(100, (t.sms_used / t.sms_limit) * 100) : 0;
                    const isNearLimit = smsPercent > 80;
                    const isExpired = t.expiry_date && new Date(t.expiry_date) < new Date();
                    return (
                      <TableRow key={t.id} className={isExpired ? 'bg-red-50/30' : ''}>
                        <TableCell>
                          <div>
                            <p className="font-semibold">{t.company_name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{t.login_username}</p>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{t.package_type}</Badge></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-sm font-bold text-purple-700">{t.smpp_port}</span>
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { navigator.clipboard.writeText(String(t.smpp_port)); toast.success("Port copied"); }}>
                              <Copy className="w-2.5 h-2.5" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-sm font-bold text-blue-700">{t.http_port}</span>
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { navigator.clipboard.writeText(String(t.http_port)); toast.success("Port copied"); }}>
                              <Copy className="w-2.5 h-2.5" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 min-w-[100px]">
                            <div className="flex justify-between text-xs">
                              <span>{(t.sms_used || 0).toLocaleString()}</span>
                              <span className={isNearLimit ? 'text-red-600 font-bold' : 'text-muted-foreground'}>
                                {t.sms_limit >= 999999999 ? '∞' : (t.sms_limit || 0).toLocaleString()}
                              </span>
                            </div>
                            {t.sms_limit < 999999999 && (
                              <Progress value={smsPercent} className={`h-1.5 ${isNearLimit ? 'bg-red-100' : ''}`} />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono font-semibold">{t.currency} {t.monthly_price}</TableCell>
                        <TableCell>
                          {t.expiry_date ? (
                            <span className={`text-xs ${isExpired ? 'text-red-600 font-bold' : 'text-muted-foreground'}`}>
                              {isExpired ? '⚠ ' : ''}{t.expiry_date}
                            </span>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={t.dlr_mode === 'fake_success' ? 'bg-yellow-50 text-yellow-700 border-yellow-300' : 'bg-green-50 text-green-700 border-green-200'}>
                            {t.dlr_mode === 'fake_success' ? '⚡ All Success' : '✓ Real DLR'}
                          </Badge>
                        </TableCell>
                        <TableCell><Badge variant="outline" className={statusColor(t.status)}>{t.status}</Badge></TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {t.status === 'active'
                              ? <Button variant="ghost" size="sm" className="text-xs h-7 text-red-600" onClick={() => suspendMut.mutate({ id: t.id, status: 'suspended' })}>Suspend</Button>
                              : <Button variant="ghost" size="sm" className="text-xs h-7 text-green-600" onClick={() => suspendMut.mutate({ id: t.id, status: 'active' })}>Activate</Button>
                            }
                            <Button variant="outline" size="icon" className="h-7 w-7" title="SMTP/Logo Settings" onClick={() => { setSettingsTenantId(t.id); setSettingsDialogOpen(true); }}><Settings className="w-3.5 h-3.5" /></Button>
                            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => { setEditing(t); setDialogOpen(true); }}><Pencil className="w-3.5 h-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMut.mutate(t.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {tenants.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-12">No tenants yet. Click "Create Tenant" to add the first one.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tenant Access URLs */}
        <TabsContent value="access" className="mt-4 space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
            <p className="text-xs font-bold text-blue-800 flex items-center gap-1"><Globe className="w-3.5 h-3.5" />Tenant Hosting — How It Works</p>
            <p className="text-xs text-blue-700">You are the Super Admin hosting this platform. Each tenant gets their own dedicated SMPP port + HTTP panel port. They connect to you as their provider.</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs font-semibold text-blue-800">Your Server IP:</span>
              <input
                className="border border-blue-300 rounded px-2 py-1 text-xs font-mono w-40 bg-white"
                value={serverIp}
                onChange={e => setServerIp(e.target.value)}
                placeholder="e.g. 45.77.100.200"
              />
              <span className="text-xs text-muted-foreground">(Set your actual server IP to generate correct URLs below)</span>
            </div>
          </div>

          <div className="space-y-3">
            {tenants.length === 0 && (
              <div className="text-center text-muted-foreground py-12 text-sm">No tenants yet. Create tenants first.</div>
            )}
            {tenants.map(t => (
              <Card key={t.id} className={`border-2 ${t.status === 'active' ? 'border-green-200' : 'border-gray-200 opacity-70'}`}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${t.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <h3 className="font-bold">{t.company_name}</h3>
                      <Badge variant="outline" className="text-xs">{t.package_type}</Badge>
                      <Badge variant="outline" className={t.status === 'active' ? 'bg-green-50 text-green-700 border-green-200 text-xs' : 'text-xs'}>{t.status}</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">Login: <code className="bg-muted px-1 rounded">{t.login_username}</code></span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* SMPP Access */}
                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg space-y-2">
                      <p className="text-xs font-bold text-purple-800 flex items-center gap-1"><Wifi className="w-3 h-3" />SMPP Connection</p>
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Host:</span>
                          <div className="flex items-center gap-1">
                            <code className="bg-white border rounded px-1 font-mono">{serverIp}</code>
                            <button onClick={() => { navigator.clipboard.writeText(serverIp); toast.success("Copied"); }} className="p-0.5 hover:bg-purple-100 rounded"><Copy className="w-3 h-3 text-purple-600" /></button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Port:</span>
                          <div className="flex items-center gap-1">
                            <code className="bg-white border rounded px-1 font-mono text-purple-700 font-bold">{t.smpp_port}</code>
                            <button onClick={() => { navigator.clipboard.writeText(String(t.smpp_port)); toast.success("Copied"); }} className="p-0.5 hover:bg-purple-100 rounded"><Copy className="w-3 h-3 text-purple-600" /></button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">System ID:</span>
                          <div className="flex items-center gap-1">
                            <code className="bg-white border rounded px-1 font-mono">{t.smpp_system_id || t.login_username}</code>
                            <button onClick={() => { navigator.clipboard.writeText(t.smpp_system_id || t.login_username); toast.success("Copied"); }} className="p-0.5 hover:bg-purple-100 rounded"><Copy className="w-3 h-3 text-purple-600" /></button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Password:</span>
                          <div className="flex items-center gap-1">
                            <code className="bg-white border rounded px-1 font-mono">{t.smpp_password || '—'}</code>
                            <button onClick={() => { navigator.clipboard.writeText(t.smpp_password || ''); toast.success("Copied"); }} className="p-0.5 hover:bg-purple-100 rounded"><Copy className="w-3 h-3 text-purple-600" /></button>
                          </div>
                        </div>
                      </div>
                      <div className="pt-1">
                        <Button size="sm" variant="outline" className="w-full text-xs h-7 gap-1 border-purple-300 text-purple-700"
                          onClick={() => {
                            const txt = `SMPP Host: ${serverIp}\nPort: ${t.smpp_port}\nSystem ID: ${t.smpp_system_id || t.login_username}\nPassword: ${t.smpp_password || ''}`;
                            navigator.clipboard.writeText(txt); toast.success("SMPP credentials copied!");
                          }}>
                          <Copy className="w-3 h-3" />Copy SMPP Credentials
                        </Button>
                      </div>
                    </div>

                    {/* HTTP Panel Access */}
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                      <p className="text-xs font-bold text-blue-800 flex items-center gap-1"><Server className="w-3 h-3" />HTTP Panel Access</p>
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Panel URL:</span>
                          <div className="flex items-center gap-1">
                            <code className="bg-white border rounded px-1 font-mono text-blue-700 text-[10px]">http://{serverIp}:{t.http_port}</code>
                            <button onClick={() => { navigator.clipboard.writeText(`http://${serverIp}:${t.http_port}`); toast.success("URL copied"); }} className="p-0.5 hover:bg-blue-100 rounded"><Copy className="w-3 h-3 text-blue-600" /></button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">HTTP Send API:</span>
                          <div className="flex items-center gap-1">
                            <code className="bg-white border rounded px-1 font-mono text-[10px]">POST :{t.http_port}/cgi-bin/sendsms</code>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Username:</span>
                          <code className="bg-white border rounded px-1 font-mono">{t.login_username}</code>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Password:</span>
                          <code className="bg-white border rounded px-1 font-mono">{t.login_password || '—'}</code>
                        </div>
                      </div>
                      <div className="pt-1">
                        <Button size="sm" variant="outline" className="w-full text-xs h-7 gap-1 border-blue-300 text-blue-700"
                          onClick={() => {
                            const txt = `Panel URL: http://${serverIp}:${t.http_port}\nHTTP API: http://${serverIp}:${t.http_port}/cgi-bin/sendsms\nUsername: ${t.login_username}\nPassword: ${t.login_password || ''}`;
                            navigator.clipboard.writeText(txt); toast.success("HTTP credentials copied!");
                          }}>
                          <Copy className="w-3 h-3" />Copy HTTP Credentials
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Full onboarding snippet */}
                  <div className="p-2 bg-gray-900 rounded">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-400">Onboarding info to send to tenant</span>
                      <button onClick={() => {
                        const txt = `Welcome to ${t.company_name} SMS Platform!\n\n` +
                          `SMPP Connection:\n  Host: ${serverIp}\n  Port: ${t.smpp_port}\n  System ID: ${t.smpp_system_id || t.login_username}\n  Password: ${t.smpp_password || ''}\n\n` +
                          `HTTP API:\n  URL: http://${serverIp}:${t.http_port}/cgi-bin/sendsms\n  Username: ${t.login_username}\n  Password: ${t.login_password || ''}\n\n` +
                          `Package: ${t.package_type} | SMS Limit: ${t.sms_limit >= 999999999 ? 'Unlimited' : (t.sms_limit || 0).toLocaleString()}\n` +
                          `Expiry: ${t.expiry_date || 'No expiry'}\n`;
                        navigator.clipboard.writeText(txt); toast.success("Onboarding info copied!");
                      }} className="text-xs text-gray-400 hover:text-white flex items-center gap-1">
                        <Copy className="w-3 h-3" />Copy All
                      </button>
                    </div>
                    <pre className="text-green-400 text-[10px] font-mono whitespace-pre-wrap">
{`SMPP: ${serverIp}:${t.smpp_port}  sysid=${t.smpp_system_id || t.login_username}  pass=${t.smpp_password || '?'}
HTTP: http://${serverIp}:${t.http_port}/cgi-bin/sendsms?username=${t.login_username}&password=PASS&from=SENDER&to=NUMBER&text=MSG
Package: ${t.package_type}  Limit: ${t.sms_limit >= 999999999 ? '∞' : (t.sms_limit || 0).toLocaleString()}  Expiry: ${t.expiry_date || 'none'}`}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-xs text-orange-800 space-y-1">
            <p className="font-bold">Hosting Business Setup Checklist:</p>
            <p>1. Install Kannel on your Debian 12 server → see <strong>Deploy Guide</strong></p>
            <p>2. Copy <strong>Kannel Config</strong> tab → append to <code>/etc/kannel/kannel.conf</code> → run <code>killall -HUP bearerbox</code></p>
            <p>3. Run <strong>UFW Commands</strong> tab commands on your server as root to open tenant ports</p>
            <p>4. Share the SMPP/HTTP credentials above with each tenant</p>
            <p>5. Tenant connects their SMS platform using SMPP or HTTP API — they feel like their own dedicated platform</p>
          </div>
        </TabsContent>

        {/* Port map */}
        <TabsContent value="ports" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Port Assignment Map</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-2 bg-gray-100 rounded text-xs font-semibold text-muted-foreground">
                  <span className="w-32">System (Kannel)</span>
                  <span className="w-24 text-purple-700">SMPP: 9095</span>
                  <span className="w-28">HTTP: 80/443</span>
                  <span>Super Admin</span>
                </div>
                {tenants.map((t, i) => (
                  <div key={t.id} className={`flex items-center gap-3 p-2 rounded text-sm border ${t.status === 'active' ? 'border-green-200 bg-green-50/30' : 'border-gray-200 bg-gray-50'}`}>
                    <span className="w-32 font-medium truncate">{t.company_name}</span>
                    <div className="flex items-center gap-1 w-24">
                      <span className="font-mono text-purple-700 font-bold">{t.smpp_port}</span>
                      <Badge variant="outline" className={t.status === 'active' ? 'text-[9px] bg-green-50 text-green-600 border-green-200' : 'text-[9px]'}>{t.status === 'active' ? '●' : '○'}</Badge>
                    </div>
                    <span className="font-mono text-blue-700 font-bold w-28">{t.http_port}</span>
                    <span className="text-xs text-muted-foreground">{t.login_username}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded text-xs text-orange-800">
                <p className="font-bold">Next available ports:</p>
                <p>SMPP: <span className="font-mono font-bold">port {tenants.length > 0 ? Math.max(...tenants.map(t => t.smpp_port || 9095)) + 1 : 9096}</span></p>
                <p>HTTP: <span className="font-mono font-bold">port {tenants.length > 0 ? Math.max(...tenants.map(t => t.http_port || 3999)) + 1 : 4000}</span></p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Kannel config */}
        <TabsContent value="kannel" className="mt-4 space-y-3">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
            Add these blocks to <code>/etc/kannel/kannel.conf</code>, then reload: <code>killall -HUP bearerbox</code>
          </div>
          <div className="relative">
            <pre className="bg-gray-900 text-green-400 text-xs font-mono p-4 rounded-lg overflow-x-auto whitespace-pre">{allKannelConfig || '# No tenants yet'}</pre>
            <Button size="sm" variant="ghost" className="absolute top-2 right-2 text-gray-400 hover:text-white gap-1"
              onClick={() => { navigator.clipboard.writeText(allKannelConfig); toast.success("All Kannel configs copied!"); }}>
              <Copy className="w-3 h-3" />Copy All
            </Button>
          </div>
        </TabsContent>

        {/* Tenant SMTP/Logo */}
        <TabsContent value="settings" className="mt-4 space-y-3">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
            Select a tenant from the <strong>Tenants</strong> tab (click the ⚙ settings icon) to configure their SMTP and logo. Or use the selector below.
          </div>
          <div className="space-y-2">
            <select className="border rounded px-3 py-2 text-sm w-full max-w-xs"
              value={settingsTenantId || ''} onChange={e => setSettingsTenantId(e.target.value)}>
              <option value="">— Select Tenant —</option>
              {tenants.map(t => <option key={t.id} value={t.id}>{t.company_name} ({t.login_username})</option>)}
            </select>
          </div>
          {settingsTenantId && <TenantSettings tenantId={settingsTenantId} />}
        </TabsContent>

        {/* UFW commands */}
        <TabsContent value="ufw" className="mt-4 space-y-3">
          <div className="p-3 bg-orange-50 border border-orange-300 rounded text-xs text-orange-800">
            Run these on your Debian 12 server as root. Each command opens SMPP + HTTP ports for the tenant.
          </div>
          <div className="relative">
            <pre className="bg-gray-900 text-yellow-300 text-xs font-mono p-4 rounded-lg overflow-x-auto whitespace-pre">{allUfwCommands || '# No tenants yet'}</pre>
            <Button size="sm" variant="ghost" className="absolute top-2 right-2 text-gray-400 hover:text-white gap-1"
              onClick={() => { navigator.clipboard.writeText(allUfwCommands); toast.success("UFW commands copied!"); }}>
              <Copy className="w-3 h-3" />Copy All
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Tenant SMTP/Logo Settings Dialog */}
      <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {tenants.find(t => t.id === settingsTenantId)?.company_name || 'Tenant'} — SMTP & Logo Settings
            </DialogTitle>
          </DialogHeader>
          {settingsTenantId && <TenantSettings tenantId={settingsTenantId} />}
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit Tenant — ${editing.company_name}` : 'Create New Tenant'}</DialogTitle>
          </DialogHeader>
          <TenantForm
            tenants={tenants}
            initial={editing}
            onSave={handleSave}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}