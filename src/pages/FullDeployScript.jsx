import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Copy, Download, Terminal, Database, Server, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { buildDeployScript, buildKannelSyncScript } from "@/lib/deployScriptBuilder";

const DEFAULT_CONFIG = {
  dbRootPass: "RootPass@2025!",
  dbAppUser: "net2app",
  dbAppPass: "Net2App@2025!",
  dbName: "net2app",
  kannelPass: "kannel_admin_2025",
  apiToken: "net2app_api_token_2025",
  appId: "",
  appBaseUrl: "https://api.base44.com",
  funcVersion: "v3",
};

const TABLES = [
  "users","tenants","clients","suppliers","routes","routing_rules","rates","mcc_mnc",
  "sms_log","sms_log_archive","voice_otp","billing_summary","invoices","campaigns",
  "channel_suppliers","content_templates","otp_unicode_presets","number_translations",
  "ip_access","alert_rules","supplier_health","system_settings","notifications",
  "gateways","cdr_logs","smpp_users"
];

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => toast.success("Copied to clipboard!"));
}

function downloadScript(content, filename) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function FullDeployScript() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const set = (k, v) => setConfig(p => ({ ...p, [k]: v }));

  const deployScript = buildDeployScript(config);
  const syncScript = buildKannelSyncScript(config);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Full Deploy Script</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generate a complete Debian 12 deployment script — 22 tables, express@4, JWT, Kannel, Nginx
          </p>
        </div>
        <Badge className="bg-green-100 text-green-700 border-green-300 text-sm px-3 py-1">
          v3.0 — {TABLES.length} Tables
        </Badge>
      </div>

      {/* Table list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Database className="w-4 h-4 text-blue-600" />
            All {TABLES.length} Database Tables Included
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1.5">
            {TABLES.map(t => (
              <span key={t} className="text-xs font-mono bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded">
                {t}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Config panel */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Server className="w-4 h-4 text-purple-600" />
              Server Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { key: "dbRootPass", label: "MariaDB Root Password" },
              { key: "dbAppUser", label: "App DB Username" },
              { key: "dbAppPass", label: "App DB Password" },
              { key: "dbName", label: "Database Name" },
              { key: "kannelPass", label: "Kannel Admin Password" },
              { key: "apiToken", label: "API Token / JWT Secret" },
              { key: "appId", label: "Base44 App ID (optional)" },
              { key: "appBaseUrl", label: "Base44 Base URL" },
              { key: "funcVersion", label: "Functions Version" },
            ].map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs">{label}</Label>
                <Input
                  className="text-xs font-mono h-8"
                  value={config[key]}
                  onChange={e => set(key, e.target.value)}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Script output */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Terminal className="w-4 h-4 text-green-600" />
              Generated Scripts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs defaultValue="deploy">
              <TabsList>
                <TabsTrigger value="deploy">deploy.sh (full)</TabsTrigger>
                <TabsTrigger value="sync">gen-kannel-conf.sh</TabsTrigger>
                <TabsTrigger value="oneliner">One-liner</TabsTrigger>
              </TabsList>

              <TabsContent value="deploy" className="space-y-3">
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => copyToClipboard(deployScript)}>
                    <Copy className="w-3.5 h-3.5 mr-1.5" />Copy
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => downloadScript(deployScript, "deploy.sh")}>
                    <Download className="w-3.5 h-3.5 mr-1.5" />Download deploy.sh
                  </Button>
                </div>
                <pre className="bg-slate-900 text-green-300 text-xs rounded-lg p-4 overflow-auto max-h-[500px] leading-relaxed whitespace-pre-wrap font-mono">
                  {deployScript}
                </pre>
              </TabsContent>

              <TabsContent value="sync" className="space-y-3">
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => copyToClipboard(syncScript)}>
                    <Copy className="w-3.5 h-3.5 mr-1.5" />Copy
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => downloadScript(syncScript, "gen-kannel-conf.sh")}>
                    <Download className="w-3.5 h-3.5 mr-1.5" />Download
                  </Button>
                </div>
                <pre className="bg-slate-900 text-green-300 text-xs rounded-lg p-4 overflow-auto max-h-[500px] leading-relaxed whitespace-pre-wrap font-mono">
                  {syncScript}
                </pre>
              </TabsContent>

              <TabsContent value="oneliner" className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Run on a fresh Debian 12 server (requires root). Downloads and executes deploy.sh from your GitHub repo.
                </p>
                {[
                  {
                    label: "From GitHub raw URL",
                    cmd: `curl -fsSL https://raw.githubusercontent.com/eliasewu/net2app.com/main/deploy.sh | bash`
                  },
                  {
                    label: "Local file (after upload)",
                    cmd: `chmod +x deploy.sh && sudo bash deploy.sh`
                  },
                  {
                    label: "Check health after deploy",
                    cmd: `curl -s http://localhost:5000/health | python3 -m json.tool`
                  },
                  {
                    label: "Test login",
                    cmd: `curl -s -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@net2app.local","password":"Admin@2025!"}' | python3 -m json.tool`
                  },
                ].map(({ label, cmd }) => (
                  <div key={label} className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">{label}</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-slate-900 text-green-300 text-xs rounded px-3 py-2 font-mono block overflow-x-auto">
                        {cmd}
                      </code>
                      <Button size="icon" variant="ghost" className="shrink-0 h-8 w-8" onClick={() => copyToClipboard(cmd)}>
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </TabsContent>
            </Tabs>

            {/* Checklist */}
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-xs font-semibold text-green-800 mb-2">✅ What this script does</p>
              <div className="grid grid-cols-2 gap-1">
                {[
                  "apt-get update + base packages",
                  "Node.js 20 + PM2",
                  "MariaDB: db + app user",
                  `${TABLES.length} tables via schema.sql`,
                  "Admin user (sha256 hash)",
                  "Billing trigger (labeled block)",
                  "Kannel bearerbox + smsbox",
                  "gen-kannel-conf.sh auto-sync",
                  "express@4 API (40+ endpoints)",
                  "Git hard-reset (no conflicts)",
                  "npm --include=dev + vite build",
                  "Nginx SPA + API proxy (nginx -t)",
                  "UFW firewall rules",
                  "Fail2Ban",
                  "Initial Kannel sync",
                  "Full health check + summary",
                ].map(item => (
                  <div key={item} className="flex items-center gap-1.5 text-xs text-green-700">
                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}