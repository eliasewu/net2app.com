import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, DollarSign, CreditCard, User, LogOut, TrendingUp, CheckCircle, XCircle, Clock, Building2, Activity } from "lucide-react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";

// Determine portal type from URL: /portal?type=client&id=xxx  OR /portal?type=supplier&id=xxx
function getPortalParams() {
  const params = new URLSearchParams(window.location.search);
  return { type: params.get("type") || "client", id: params.get("id") || "" };
}

const statusColor = (s) => {
  const map = {
    delivered: "bg-green-50 text-green-700 border-green-200",
    failed: "bg-red-50 text-red-700 border-red-200",
    pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
    sent: "bg-blue-50 text-blue-700 border-blue-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
    blocked: "bg-gray-50 text-gray-700 border-gray-200",
    paid: "bg-green-50 text-green-700 border-green-200",
    draft: "bg-gray-100 text-gray-600 border-gray-200",
    overdue: "bg-red-50 text-red-700 border-red-200",
  };
  return map[s] || "bg-gray-50 text-gray-600 border-gray-200";
};

function StatCard({ icon: Icon, label, value, sub, color = "text-blue-600 bg-blue-50 border-blue-200" }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-lg border ${color}`}><Icon className="w-4 h-4" /></div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Client Portal ───────────────────────────────────────────────────────────
function ClientPortal({ clientId }) {
  const { data: client, isLoading: loadingClient } = useQuery({
    queryKey: ["portal-client", clientId],
    queryFn: () => base44.entities.Client.filter({ id: clientId }),
    select: (res) => res[0],
    enabled: !!clientId,
  });

  const { data: smsLogs = [] } = useQuery({
    queryKey: ["portal-sms", clientId],
    queryFn: () => base44.entities.SmsLog.filter({ client_id: clientId }, "-created_date", 200),
    enabled: !!clientId,
    initialData: [],
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["portal-invoices", clientId],
    queryFn: () => base44.entities.Invoice.filter({ client_id: clientId }, "-created_date", 50),
    enabled: !!clientId,
    initialData: [],
  });

  if (loadingClient) return <div className="text-center py-20 text-muted-foreground">Loading your account...</div>;
  if (!client) return <div className="text-center py-20 text-destructive">Account not found.</div>;

  const totalSms = smsLogs.length;
  const delivered = smsLogs.filter(l => l.status === "delivered").length;
  const failed = smsLogs.filter(l => l.status === "failed" || l.status === "rejected").length;
  const deliveryRate = totalSms > 0 ? Math.round((delivered / totalSms) * 100) : 0;
  const totalSpend = smsLogs.reduce((s, l) => s + (l.cost || 0), 0);

  return (
    <div className="space-y-6">
      {/* Account Header */}
      <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl text-white">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <User className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-lg">{client.name}</h2>
              <p className="text-blue-200 text-sm">{client.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge className={`${client.status === "active" ? "bg-green-500" : "bg-red-500"} text-white border-0`}>
              {client.status}
            </Badge>
            <div className="text-right">
              <p className="text-xs text-blue-200">Current Balance</p>
              <p className="font-bold text-xl">{client.currency || "USD"} {(client.balance || 0).toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={MessageSquare} label="Total SMS" value={totalSms.toLocaleString()} color="text-blue-600 bg-blue-50 border-blue-200" />
        <StatCard icon={CheckCircle} label="Delivered" value={delivered.toLocaleString()} sub={`${deliveryRate}% DLR`} color="text-green-600 bg-green-50 border-green-200" />
        <StatCard icon={XCircle} label="Failed" value={failed.toLocaleString()} color="text-red-600 bg-red-50 border-red-200" />
        <StatCard icon={DollarSign} label="Total Spend" value={`$${totalSpend.toFixed(4)}`} color="text-purple-600 bg-purple-50 border-purple-200" />
      </div>

      <Tabs defaultValue="sms">
        <TabsList>
          <TabsTrigger value="sms"><MessageSquare className="w-3.5 h-3.5 mr-1" />SMS Logs</TabsTrigger>
          <TabsTrigger value="invoices"><CreditCard className="w-3.5 h-3.5 mr-1" />Invoices</TabsTrigger>
          <TabsTrigger value="account"><User className="w-3.5 h-3.5 mr-1" />Account</TabsTrigger>
        </TabsList>

        {/* SMS Logs — NO supplier info shown */}
        <TabsContent value="sms" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4" />Message History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted border-b">
                      {["Date/Time", "Destination", "Sender", "Parts", "Status"].map(h => (
                        <th key={h} className="text-left p-3 text-xs font-semibold text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {smsLogs.slice(0, 100).map((log, i) => (
                      <tr key={log.id} className={`border-b hover:bg-accent/30 ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                        <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{log.created_date ? format(new Date(log.created_date), "dd/MM/yy HH:mm") : "—"}</td>
                        <td className="p-3 font-mono font-semibold text-xs">{log.destination}</td>
                        <td className="p-3 text-xs">{log.sender_id || "—"}</td>
                        <td className="p-3 text-xs text-center">{log.parts || 1}</td>
                        <td className="p-3">
                          <Badge variant="outline" className={`text-xs ${statusColor(log.status)}`}>{log.status}</Badge>
                        </td>
                      </tr>
                    ))}
                    {smsLogs.length === 0 && (
                      <tr><td colSpan={5} className="text-center text-muted-foreground py-10">No messages yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invoices */}
        <TabsContent value="invoices" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><CreditCard className="w-4 h-4" />Payment History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted border-b">
                      {["Invoice #", "Period", "Total SMS", "Amount", "Currency", "Status"].map(h => (
                        <th key={h} className="text-left p-3 text-xs font-semibold text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv, i) => (
                      <tr key={inv.id} className={`border-b hover:bg-accent/30 ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                        <td className="p-3 font-mono text-xs font-semibold">{inv.invoice_number || inv.id?.slice(0, 8)}</td>
                        <td className="p-3 text-xs">{inv.period_start} → {inv.period_end}</td>
                        <td className="p-3 text-xs">{(inv.total_sms || 0).toLocaleString()}</td>
                        <td className="p-3 font-semibold text-xs">{(inv.total_amount || 0).toFixed(2)}</td>
                        <td className="p-3 text-xs">{inv.currency}</td>
                        <td className="p-3">
                          <Badge variant="outline" className={`text-xs ${statusColor(inv.status)}`}>{inv.status}</Badge>
                        </td>
                      </tr>
                    ))}
                    {invoices.length === 0 && (
                      <tr><td colSpan={6} className="text-center text-muted-foreground py-10">No invoices yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Account Info — basic only */}
        <TabsContent value="account" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Account Information</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "Company Name", value: client.name },
                { label: "Email", value: client.email },
                { label: "Phone", value: client.phone || "—" },
                { label: "Contact Person", value: client.contact_person || "—" },
                { label: "Connection Type", value: client.connection_type },
                { label: "Billing Type", value: client.billing_type },
                { label: "Currency", value: client.currency },
                { label: "Credit Limit", value: client.credit_limit != null ? `${client.currency} ${client.credit_limit}` : "—" },
                { label: "TPS Limit", value: client.tps_limit || "—" },
                { label: "Account Status", value: client.status },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center py-2 border-b last:border-0">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className="text-sm font-medium capitalize">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Supplier Portal ──────────────────────────────────────────────────────────
function SupplierPortal({ supplierId }) {
  const { data: supplier, isLoading: loadingSupplier } = useQuery({
    queryKey: ["portal-supplier", supplierId],
    queryFn: () => base44.entities.Supplier.filter({ id: supplierId }),
    select: (res) => res[0],
    enabled: !!supplierId,
  });

  const { data: smsLogs = [] } = useQuery({
    queryKey: ["portal-sms-supplier", supplierId],
    queryFn: () => base44.entities.SmsLog.filter({ supplier_id: supplierId }, "-created_date", 200),
    enabled: !!supplierId,
    initialData: [],
  });

  if (loadingSupplier) return <div className="text-center py-20 text-muted-foreground">Loading your account...</div>;
  if (!supplier) return <div className="text-center py-20 text-destructive">Account not found.</div>;

  const totalSms = smsLogs.length;
  const delivered = smsLogs.filter(l => l.status === "delivered").length;
  const failed = smsLogs.filter(l => l.status === "failed" || l.status === "rejected").length;
  const deliveryRate = totalSms > 0 ? Math.round((delivered / totalSms) * 100) : 0;
  const totalCost = smsLogs.reduce((s, l) => s + (l.cost || 0), 0);

  return (
    <div className="space-y-6">
      {/* Account Header */}
      <div className="p-4 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl text-white">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-lg">{supplier.name}</h2>
              <p className="text-indigo-200 text-sm">{supplier.email || "—"}</p>
              <p className="text-indigo-200 text-xs capitalize">{supplier.category} · {supplier.connection_type}</p>
            </div>
          </div>
          <Badge className={`${supplier.status === "active" ? "bg-green-500" : "bg-red-500"} text-white border-0`}>
            {supplier.status}
          </Badge>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={MessageSquare} label="Total Routed" value={totalSms.toLocaleString()} color="text-blue-600 bg-blue-50 border-blue-200" />
        <StatCard icon={CheckCircle} label="Delivered" value={delivered.toLocaleString()} sub={`${deliveryRate}% DLR`} color="text-green-600 bg-green-50 border-green-200" />
        <StatCard icon={XCircle} label="Failed" value={failed.toLocaleString()} color="text-red-600 bg-red-50 border-red-200" />
        <StatCard icon={TrendingUp} label="Total Cost" value={`$${totalCost.toFixed(4)}`} color="text-purple-600 bg-purple-50 border-purple-200" />
      </div>

      <Tabs defaultValue="sms">
        <TabsList>
          <TabsTrigger value="sms"><MessageSquare className="w-3.5 h-3.5 mr-1" />Traffic Logs</TabsTrigger>
          <TabsTrigger value="account"><User className="w-3.5 h-3.5 mr-1" />Account</TabsTrigger>
        </TabsList>

        {/* Traffic Logs — NO client info shown */}
        <TabsContent value="sms" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4" />Traffic Log</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted border-b">
                      {["Date/Time", "Destination", "Country", "Network", "Parts", "Status"].map(h => (
                        <th key={h} className="text-left p-3 text-xs font-semibold text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {smsLogs.slice(0, 100).map((log, i) => (
                      <tr key={log.id} className={`border-b hover:bg-accent/30 ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                        <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{log.created_date ? format(new Date(log.created_date), "dd/MM/yy HH:mm") : "—"}</td>
                        <td className="p-3 font-mono font-semibold text-xs">{log.destination}</td>
                        <td className="p-3 text-xs">{log.country || "—"}</td>
                        <td className="p-3 text-xs">{log.network || "—"}</td>
                        <td className="p-3 text-xs text-center">{log.parts || 1}</td>
                        <td className="p-3">
                          <Badge variant="outline" className={`text-xs ${statusColor(log.status)}`}>{log.status}</Badge>
                        </td>
                      </tr>
                    ))}
                    {smsLogs.length === 0 && (
                      <tr><td colSpan={6} className="text-center text-muted-foreground py-10">No traffic yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Account Info */}
        <TabsContent value="account" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Account Information</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "Supplier Name", value: supplier.name },
                { label: "Email", value: supplier.email || "—" },
                { label: "Phone", value: supplier.phone || "—" },
                { label: "Contact Person", value: supplier.contact_person || "—" },
                { label: "Category", value: supplier.category },
                { label: "Connection Type", value: supplier.connection_type },
                { label: "Priority", value: supplier.priority || "—" },
                { label: "TPS Limit", value: supplier.tps_limit || "—" },
                { label: "Account Status", value: supplier.status },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center py-2 border-b last:border-0">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className="text-sm font-medium capitalize">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Login Gate ───────────────────────────────────────────────────────────────
function PortalLogin({ onLogin }) {
  const [type, setType] = useState("client");
  const [accountId, setAccountId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!accountId.trim()) { setError("Please enter your Account ID."); return; }
    setLoading(true);
    setError("");

    // Fetch the account and verify against SMPP password as portal PIN
    if (type === "client") {
      const results = await base44.entities.Client.filter({ id: accountId.trim() });
      const acc = results[0];
      if (!acc) { setError("Account ID not found."); setLoading(false); return; }
      // Use smpp_password or a simple check: password matches smpp_password
      if (acc.smpp_password && password !== acc.smpp_password) {
        setError("Invalid password."); setLoading(false); return;
      }
      onLogin({ type: "client", id: acc.id });
    } else {
      const results = await base44.entities.Supplier.filter({ id: accountId.trim() });
      const acc = results[0];
      if (!acc) { setError("Account ID not found."); setLoading(false); return; }
      if (acc.smpp_password && password !== acc.smpp_password) {
        setError("Invalid password."); setLoading(false); return;
      }
      onLogin({ type: "supplier", id: acc.id });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-800/80 border-slate-700 text-white">
        <CardHeader className="text-center pb-2">
          <div className="w-14 h-14 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <User className="w-7 h-7 text-blue-400" />
          </div>
          <CardTitle className="text-white text-xl">Customer Portal</CardTitle>
          <p className="text-slate-400 text-sm">Access your account, usage stats & invoices</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Type selector */}
          <div className="grid grid-cols-2 gap-2">
            {["client", "supplier"].map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`p-2 rounded-lg border text-sm font-medium capitalize transition-all ${type === t ? "bg-blue-600 border-blue-500 text-white" : "bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-700"}`}
              >
                {t === "client" ? "🏢 Client" : "📡 Supplier"}
              </button>
            ))}
          </div>

          <div className="space-y-1">
            <Label className="text-slate-300 text-xs">Account ID</Label>
            <Input
              value={accountId}
              onChange={e => setAccountId(e.target.value)}
              placeholder="Enter your account ID"
              className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
            />
            <p className="text-xs text-slate-500">Your account ID is provided by your service manager.</p>
          </div>

          <div className="space-y-1">
            <Label className="text-slate-300 text-xs">Password / PIN</Label>
            <Input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
              onKeyDown={e => e.key === "Enter" && handleLogin()}
            />
          </div>

          {error && <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded px-3 py-2">{error}</p>}

          <Button onClick={handleLogin} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700">
            {loading ? "Checking..." : "Login to Portal"}
          </Button>

          <p className="text-center text-slate-500 text-xs">
            Don't have your credentials? Contact your service manager.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Portal Page ─────────────────────────────────────────────────────────
export default function CustomerPortal() {
  const [session, setSession] = useState(null);

  // Support direct URL access: /portal?type=client&id=xxx
  useEffect(() => {
    const { type, id } = getPortalParams();
    if (id) setSession({ type, id });
  }, []);

  if (!session) {
    return <PortalLogin onLogin={setSession} />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-400" />
          <span className="font-semibold text-sm">Net2app Customer Portal</span>
          <Badge className="bg-blue-600/20 text-blue-300 border-blue-500/30 text-xs capitalize">{session.type}</Badge>
        </div>
        <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white gap-1" onClick={() => setSession(null)}>
          <LogOut className="w-4 h-4" />Logout
        </Button>
      </div>

      <div className="max-w-5xl mx-auto p-4 md:p-6">
        {session.type === "client"
          ? <ClientPortal clientId={session.id} />
          : <SupplierPortal supplierId={session.id} />
        }
      </div>
    </div>
  );
}