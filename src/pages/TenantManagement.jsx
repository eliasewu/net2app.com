import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Plus, Pencil, Trash2, Copy, Users, DollarSign, TrendingUp, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import TenantForm from "@/components/tenant/TenantForm";
import { generateKannelTenantConfig, generateUfwCommands } from "@/lib/portUtils";

const statusColor = s => {
  const m = { active: 'bg-green-50 text-green-700 border-green-200', suspended: 'bg-red-50 text-red-700 border-red-200', expired: 'bg-gray-50 text-gray-600 border-gray-200', pending: 'bg-yellow-50 text-yellow-700 border-yellow-200' };
  return m[s] || 'bg-gray-50 text-gray-600 border-gray-200';
};

export default function TenantManagement() {
  const [tab, setTab] = useState("tenants");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [kannelView, setKannelView] = useState(false);
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
        <TabsList>
          <TabsTrigger value="tenants">Tenants ({tenants.length})</TabsTrigger>
          <TabsTrigger value="ports">Port Map</TabsTrigger>
          <TabsTrigger value="kannel">Kannel Config</TabsTrigger>
          <TabsTrigger value="ufw">UFW Commands</TabsTrigger>
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