import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle2, XCircle, AlertTriangle, RefreshCw, Database, Server,
  Zap, Globe, Shield, Users, BarChart3, FileText, Settings, Radio,
  Smartphone, Route, GitBranch, Activity, Building2, Bell, Link2
} from "lucide-react";
import { toast } from "sonner";

const MODULE_ICONS = {
  "Health": Activity,
  "Auth / Login": Shield,
  "Dashboard": BarChart3,
  "Users": Users,
  "Clients": Building2,
  "Suppliers": Globe,
  "Routes": Route,
  "Routing Rules": GitBranch,
  "Rates": FileText,
  "MCC/MNC": Globe,
  "SMS Logs": FileText,
  "Voice OTP": Smartphone,
  "Billing Summary": BarChart3,
  "Invoices": FileText,
  "Campaigns": Zap,
  "Content Templates": FileText,
  "Settings": Settings,
  "Alert Rules": Bell,
  "Notifications": Bell,
  "Gateways": Radio,
  "Number Translation": Link2,
  "IP Access": Shield,
  "Reports Traffic": BarChart3,
  "Tenants": Building2,
  "Supplier Health": Activity,
  "CDR Logs": FileText,
  "Kannel Status": Radio,
  "SMPP Test": Radio,
};

function ModuleCard({ module, endpoint, connected, status, note, error }) {
  const Icon = MODULE_ICONS[module] || Server;
  const isNotDeployed = note === "not deployed";
  const bgColor = connected ? "bg-green-50 border-green-200" : isNotDeployed ? "bg-orange-50 border-orange-200" : "bg-red-50 border-red-200";
  const iconBg = connected ? "bg-green-100" : isNotDeployed ? "bg-orange-100" : "bg-red-100";
  const iconColor = connected ? "text-green-600" : isNotDeployed ? "text-orange-600" : "text-red-600";
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border ${bgColor}`}>
      <div className={`p-1.5 rounded-md ${iconBg}`}>
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{module}</p>
        <p className="text-xs text-muted-foreground font-mono truncate">{endpoint}</p>
        {note && <p className={`text-xs truncate ${isNotDeployed ? "text-orange-500" : "text-red-500"}`}>{isNotDeployed ? "⚠ Not deployed — run deploy.sh" : note}</p>}
      </div>
      <div className="shrink-0 text-xs font-mono text-muted-foreground">
        {status > 0 && <span className="mr-1">{status}</span>}
        {connected
          ? <CheckCircle2 className="w-5 h-5 text-green-500 inline" />
          : isNotDeployed
          ? <AlertTriangle className="w-5 h-5 text-orange-500 inline" />
          : <XCircle className="w-5 h-5 text-red-500 inline" />}
      </div>
    </div>
  );
}

function SyncResultRow({ entity, total, synced }) {
  const ok = synced === total;
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <span className="text-sm font-medium">{entity}</span>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{total} records</span>
        <Badge variant="outline" className={ok ? "bg-green-50 text-green-700 border-green-200" : "bg-orange-50 text-orange-700 border-orange-200"}>
          {synced}/{total} synced
        </Badge>
      </div>
    </div>
  );
}

export default function SystemSetup() {
  const [checkResult, setCheckResult] = useState(null);
  const [syncResult, setSyncResult] = useState(null);
  const [tablesResult, setTablesResult] = useState(null);

  const checkMut = useMutation({
    mutationFn: () => base44.functions.invoke("serverSetup", { action: "check" }),
    onSuccess: (res) => {
      setCheckResult(res.data);
      if (res.data?.server_reachable) {
        toast.success(`Connected — ${res.data.modules_connected}/${res.data.modules_total} modules OK`);
      } else {
        toast.error("Server unreachable — check SERVER_API_URL secret");
      }
    },
    onError: (e) => toast.error("Check failed: " + e.message),
  });

  const syncMut = useMutation({
    mutationFn: () => base44.functions.invoke("serverSetup", { action: "sync_entities" }),
    onSuccess: (res) => {
      setSyncResult(res.data);
      toast.success(res.data?.message || "Sync complete");
    },
    onError: (e) => toast.error("Sync failed: " + e.message),
  });

  const tablesMut = useMutation({
    mutationFn: () => base44.functions.invoke("serverSetup", { action: "db_tables_check" }),
    onSuccess: (res) => {
      setTablesResult(res.data);
      if (res.data?.missing_tables?.length === 0) toast.success("All 22 tables verified!");
      else toast.warning(`${res.data?.missing_tables?.length} tables may be missing`);
    },
    onError: (e) => toast.error("Table check failed: " + e.message),
  });

  const kannelSyncMut = useMutation({
    mutationFn: () => base44.functions.invoke("serverSetup", { action: "kannel_sync" }),
    onSuccess: () => toast.success("Kannel config synced and reloaded"),
    onError: (e) => toast.error("Kannel sync failed: " + e.message),
  });

  const result = checkResult;
  const connectedModules = result?.modules?.filter(m => m.connected) || [];
  const notDeployedModules = result?.modules?.filter(m => !m.connected && m.note === "not deployed") || [];
  const failedModules = result?.modules?.filter(m => !m.connected && m.note !== "not deployed") || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">System Setup & Connectivity</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Verify all modules are connected to the backend server, sync entities, and manage deployment
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => kannelSyncMut.mutate()} disabled={kannelSyncMut.isPending}>
            <Radio className="w-4 h-4 mr-2" />
            {kannelSyncMut.isPending ? "Syncing..." : "Sync Kannel"}
          </Button>
          <Button onClick={() => checkMut.mutate()} disabled={checkMut.isPending}>
            <RefreshCw className={`w-4 h-4 mr-2 ${checkMut.isPending ? "animate-spin" : ""}`} />
            {checkMut.isPending ? "Checking..." : "Run Full Check"}
          </Button>
        </div>
      </div>

      {/* Server status bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          {
            label: "Server",
            value: result ? (result.server_reachable ? "Online" : "Offline") : "—",
            color: result ? (result.server_reachable ? "text-green-600" : "text-red-600") : "text-muted-foreground",
            icon: Server,
          },
          {
            label: "Database",
            value: result ? (result.db_connected ? "Connected" : "Disconnected") : "—",
            color: result ? (result.db_connected ? "text-green-600" : "text-red-600") : "text-muted-foreground",
            icon: Database,
          },
          {
            label: "Tables",
            value: result?.tables ?? "—",
            color: "text-foreground",
            icon: Database,
          },
          {
            label: "Modules OK",
            value: result ? `${result.modules_connected}/${result.modules_total}` : "—",
            color: result ? (result.modules_connected === result.modules_total ? "text-green-600" : "text-orange-600") : "text-muted-foreground",
            icon: CheckCircle2,
          },
          {
            label: "SMS Today",
            value: result?.sms_today ?? "—",
            color: "text-foreground",
            icon: Activity,
          },
        ].map(({ label, value, color, icon: Icon }) => (
          <Card key={label} className="p-4">
            <div className="flex items-center gap-3">
              <Icon className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={`text-lg font-bold ${color}`}>{value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Not yet checked */}
      {!result && !checkMut.isPending && (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center space-y-3">
            <Server className="w-12 h-12 mx-auto text-muted-foreground/40" />
            <p className="text-muted-foreground">Click "Run Full Check" to verify all module connections</p>
            <p className="text-xs text-muted-foreground">
              Checks {MODULE_ICONS ? Object.keys(MODULE_ICONS).length : 28} modules against{" "}
              <code className="bg-muted px-1 rounded text-xs">{window?.location?.hostname || "your server"}</code>
            </p>
          </CardContent>
        </Card>
      )}

      {checkMut.isPending && (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <RefreshCw className="w-10 h-10 mx-auto text-primary animate-spin" />
            <p className="text-muted-foreground">Running connectivity checks across all modules...</p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All Modules ({result.modules?.length || 0})</TabsTrigger>
            <TabsTrigger value="ok" className="text-green-600">
              Connected ({connectedModules.length})
            </TabsTrigger>
            <TabsTrigger value="pending" className="text-orange-600">
              Not Deployed ({notDeployedModules.length})
            </TabsTrigger>
            <TabsTrigger value="failed" className="text-red-600">
              Failed ({failedModules.length})
            </TabsTrigger>
            <TabsTrigger value="tables">DB Tables</TabsTrigger>
          <TabsTrigger value="sync">Entity Sync</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {result.modules?.map(m => <ModuleCard key={m.module} {...m} />)}
            </div>
          </TabsContent>

          <TabsContent value="ok" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {connectedModules.map(m => <ModuleCard key={m.module} {...m} />)}
            </div>
            {connectedModules.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">No modules connected yet</div>
            )}
          </TabsContent>

          <TabsContent value="pending" className="mt-4">
            <div className="space-y-3">
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800">
                <AlertTriangle className="w-4 h-4 inline mr-2" />
                {notDeployedModules.length} module(s) not yet deployed. Run the <strong>Full Deploy Script</strong> on your server to install Express + all 40+ API endpoints.
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {notDeployedModules.map(m => <ModuleCard key={m.module} {...m} />)}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="failed" className="mt-4">
            {failedModules.length === 0 ? (
              <div className="text-center py-12 space-y-2">
                <CheckCircle2 className="w-12 h-12 mx-auto text-green-500" />
                <p className="text-green-600 font-medium">All modules connected successfully!</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                  <AlertTriangle className="w-4 h-4 inline mr-2" />
                  {failedModules.length} module(s) failed. Make sure the server is running and
                  <code className="mx-1 bg-amber-100 px-1 rounded">SERVER_API_URL</code> /
                  <code className="mx-1 bg-amber-100 px-1 rounded">SERVER_API_TOKEN</code> secrets are set correctly.
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {failedModules.map(m => <ModuleCard key={m.module} {...m} />)}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="tables" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-600" />
                  Verify All 22 Database Tables
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Check whether all 22 required MariaDB tables exist on the server by probing their corresponding API endpoints.
                </p>
                <Button onClick={() => tablesMut.mutate()} disabled={tablesMut.isPending} className="gap-2">
                  <Database className={`w-4 h-4 ${tablesMut.isPending ? "animate-pulse" : ""}`} />
                  {tablesMut.isPending ? "Checking tables..." : "Check All 22 Tables"}
                </Button>
                {tablesResult && (
                  <div className="space-y-3 mt-4">
                    <div className={`p-3 rounded-lg border text-sm font-medium ${tablesResult.missing_tables?.length === 0 ? "bg-green-50 border-green-200 text-green-800" : "bg-orange-50 border-orange-200 text-orange-800"}`}>
                      {tablesResult.message}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {tablesResult.table_details?.map(t => (
                        <div key={t.table} className={`flex items-center gap-2 p-2 rounded border text-xs font-mono ${t.exists ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                          {t.exists
                            ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                            : <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                          <span className={t.exists ? "text-green-700" : "text-red-700"}>{t.table}</span>
                          <span className="ml-auto text-muted-foreground">{t.status}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground pt-2 border-t">
                      <span>Server reports: <strong>{tablesResult.server_table_count}</strong> tables</span>
                      <span>Expected: <strong>{tablesResult.expected}</strong></span>
                      <span>Verified via API: <strong>{tablesResult.verified_via_api}</strong></span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sync" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-600" />
                  Sync Base44 Entities → Server Database
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Push all records from Base44 cloud entities (Clients, Suppliers, Routes, Routing Rules, Rates, Alert Rules, Gateways, Tenants)
                  into the server's MariaDB database. Safe to run multiple times — uses upsert (INSERT ... ON DUPLICATE KEY UPDATE).
                </p>
                <Button onClick={() => syncMut.mutate()} disabled={syncMut.isPending} className="gap-2">
                  <Database className={`w-4 h-4 ${syncMut.isPending ? "animate-pulse" : ""}`} />
                  {syncMut.isPending ? "Syncing entities..." : "Sync All Entities to Server"}
                </Button>
                {syncResult && (
                  <div className="mt-4 space-y-1">
                    <p className="text-sm font-semibold text-green-700 mb-3">{syncResult.message}</p>
                    {syncResult.results?.map(r => <SyncResultRow key={r.entity} {...r} />)}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Secrets reminder */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <p className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
            <Shield className="w-4 h-4" /> Required Secrets (Dashboard → Code → Secrets)
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {[
              { key: "SERVER_API_URL", desc: "e.g. http://YOUR_SERVER_IP:5000" },
              { key: "SERVER_API_TOKEN", desc: "API token / JWT secret from deploy.sh" },
              { key: "KANNEL_ADMIN_URL", desc: "e.g. http://YOUR_SERVER_IP:13000" },
              { key: "KANNEL_ADMIN_PASS", desc: "Kannel admin password from deploy.sh" },
            ].map(({ key, desc }) => (
              <div key={key} className="flex items-start gap-2 text-xs">
                <code className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-mono">{key}</code>
                <span className="text-blue-600">{desc}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Module map */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Link2 className="w-4 h-4 text-purple-600" />
            Frontend → Backend Module Map
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            {[
              { page: "Dashboard", api: "/api/dashboard", entity: "SmsLog, Client, Supplier" },
              { page: "Clients", api: "/api/clients", entity: "Client" },
              { page: "Suppliers", api: "/api/suppliers", entity: "Supplier" },
              { page: "Routes", api: "/api/routes", entity: "Route" },
              { page: "Routing Rules", api: "/api/routing-rules", entity: "RoutingRule" },
              { page: "Routing Analytics", api: "/api/routing-rules + /api/sms-logs", entity: "RoutingRule, SmsLog" },
              { page: "Rates", api: "/api/rates", entity: "Rate" },
              { page: "MCC/MNC", api: "/api/mccmnc", entity: "MccMnc" },
              { page: "SMS Logs", api: "/api/sms-logs", entity: "SmsLog" },
              { page: "Test SMS", api: "/api/sms-logs (simulate)", entity: "SmsLog" },
              { page: "Campaigns", api: "/api/campaigns", entity: "Campaign" },
              { page: "Content Templates", api: "/api/content-templates", entity: "ContentTemplate" },
              { page: "SMPP Gateway", api: "/api/kannel/status", entity: "Supplier" },
              { page: "IP Management", api: "/api/ip-access", entity: "IpAccess" },
              { page: "Server Nodes", api: "/health", entity: "ServerNode" },
              { page: "Reports", api: "/api/reports/traffic", entity: "SmsLog (aggregate)" },
              { page: "Invoices", api: "/api/invoices", entity: "Invoice" },
              { page: "Billing", api: "/api/billing/summary", entity: "Invoice, Client" },
              { page: "Tenants", api: "/api/tenants", entity: "Tenant" },
              { page: "Alert Rules", api: "/api/alert-rules", entity: "AlertRule" },
              { page: "User Management", api: "/api/users", entity: "User (Base44)" },
              { page: "GitHub Releases", api: "GitHub API", entity: "— (direct API)" },
              { page: "Customer Portal", api: "/api/billing/summary", entity: "Client, Invoice" },
              { page: "Voice OTP", api: "/api/voice-otp", entity: "VoiceOtp" },
              { page: "Number Translation", api: "/api/translations", entity: "NumberTranslation" },
              { page: "Device Connect", api: "/api/device/qr", entity: "Supplier (device)" },
            ].map(({ page, api, entity }) => (
              <div key={page} className="p-2 bg-muted/40 rounded border">
                <p className="font-semibold text-foreground">{page}</p>
                <p className="text-muted-foreground font-mono mt-0.5">{api}</p>
                <p className="text-muted-foreground mt-0.5">Entities: {entity}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}