import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Copy, Server, Wifi, Phone, Database, Shield, BookOpen, Users, Settings, GitBranch } from "lucide-react";
import { toast } from "sonner";
import { SCRIPTS, ARCH } from "./deployScripts";

function CodeBlock({ label, code, color = "text-green-400" }) {
  return (
    <div className="space-y-1">
      {label && <p className="text-xs font-semibold text-muted-foreground">{label}</p>}
      <div className="relative">
        <pre className={`bg-gray-900 ${color} text-xs font-mono p-4 rounded-lg overflow-x-auto whitespace-pre`}>{code}</pre>
        <Button size="sm" variant="ghost" className="absolute top-2 right-2 text-gray-400 hover:text-white gap-1"
          onClick={() => { navigator.clipboard.writeText(code); toast.success("Copied!"); }}>
          <Copy className="w-3 h-3" />Copy
        </Button>
      </div>
    </div>
  );
}

function InfoBox({ color = "blue", children }) {
  const cls = {
    blue: "bg-blue-50 border-blue-200 text-blue-800",
    orange: "bg-orange-50 border-orange-200 text-orange-800",
    yellow: "bg-yellow-50 border-yellow-300 text-yellow-900",
    red: "bg-red-50 border-red-200 text-red-800",
    green: "bg-green-50 border-green-200 text-green-800",
    purple: "bg-purple-50 border-purple-200 text-purple-800",
  }[color];
  return <div className={`p-3 border rounded-lg text-xs space-y-1 ${cls}`}>{children}</div>;
}

export default function IntegrationDeployGuide() {
  const [tab, setTab] = useState("overview");

  return (
    <div className="space-y-4">
      <div className="p-4 bg-gradient-to-r from-blue-900 to-indigo-900 rounded-xl text-white space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <BookOpen className="w-5 h-5" />
          <h2 className="font-bold text-lg">Full Deploy Guide — Super Admin Only</h2>
          <Badge className="bg-white/20 text-white border-white/30">Debian 12 Bookworm</Badge>
          <Badge className="bg-red-500/80 text-white border-red-400/50">Super Admin</Badge>
        </div>
        <p className="text-blue-200 text-sm">
          Asterisk 20 + Kannel (bearerbox/smsbox) SMPP/HTTP server + SIM Box + MariaDB per-tenant CDR + real-time billing + firewall
        </p>
        <div className="flex flex-wrap gap-2 text-xs">
          {["System Prep","Kannel SMS","SIM Box","MariaDB Schema","Tenant DB","Real-Time Billing","Asterisk CDR","Firewall","Tenant SMTP"].map((s,i) => (
            <div key={i} className="flex items-center gap-1 bg-white/10 rounded px-2 py-0.5">
              <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[9px] font-bold">{i+1}</span>
              {s}
            </div>
          ))}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto gap-1 bg-muted/50 p-1">
          <TabsTrigger value="overview" className="gap-1 text-xs"><Server className="w-3 h-3" />Overview</TabsTrigger>
          <TabsTrigger value="system" className="gap-1 text-xs"><Settings className="w-3 h-3" />System</TabsTrigger>
          <TabsTrigger value="kannel_install" className="gap-1 text-xs"><Wifi className="w-3 h-3" />Kannel Install</TabsTrigger>
          <TabsTrigger value="kannel" className="gap-1 text-xs"><Wifi className="w-3 h-3" />Kannel Config</TabsTrigger>
          <TabsTrigger value="simbox" className="gap-1 text-xs"><Wifi className="w-3 h-3" />SIM Box</TabsTrigger>
          <TabsTrigger value="database" className="gap-1 text-xs"><Database className="w-3 h-3" />Database</TabsTrigger>
          <TabsTrigger value="tenant_db" className="gap-1 text-xs"><Users className="w-3 h-3" />Tenant DB</TabsTrigger>
          <TabsTrigger value="billing" className="gap-1 text-xs"><Database className="w-3 h-3" />Billing</TabsTrigger>
          <TabsTrigger value="asterisk" className="gap-1 text-xs"><Phone className="w-3 h-3" />Asterisk</TabsTrigger>
          <TabsTrigger value="security" className="gap-1 text-xs"><Shield className="w-3 h-3" />Firewall</TabsTrigger>
          <TabsTrigger value="smtp" className="gap-1 text-xs"><Settings className="w-3 h-3" />SMTP/Logo</TabsTrigger>
          <TabsTrigger value="android_apk" className="gap-1 text-xs"><Phone className="w-3 h-3" />Android APK</TabsTrigger>
          <TabsTrigger value="billing_setup" className="gap-1 text-xs"><Database className="w-3 h-3" />Billing Setup</TabsTrigger>
          <TabsTrigger value="github" className="gap-1 text-xs"><GitBranch className="w-3 h-3" />GitHub Deploy</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">System Architecture</CardTitle></CardHeader>
            <CardContent>
              <pre className="text-xs font-mono text-muted-foreground bg-muted p-4 rounded-lg overflow-x-auto">{ARCH}</pre>
            </CardContent>
          </Card>
          <InfoBox color="orange">
            <p className="font-bold">Key Architecture Decisions:</p>
            <p>• <strong>Kannel only</strong> — no Jasmin. Kannel handles SMPP server + client + HTTP + SIM box (bearerbox).</p>
            <p>• <strong>Per-tenant SMPP port</strong> (9096+): each tenant gets a dedicated smpp-server block in kannel.conf.</p>
            <p>• <strong>MariaDB</strong>: global tables + per-tenant VIEWs = data isolation without duplication.</p>
            <p>• <strong>Real-time billing</strong>: MySQL trigger updates billing_summary on every DLR/status update.</p>
            <p>• <strong>Tenant script</strong>: <code>fix-tenant.sh</code> — auto-escalates to root, creates DB + user + views + local tables, saves credentials to <code>/root/.tenant_ID</code>.</p>
          </InfoBox>
        </TabsContent>

        {/* System */}
        <TabsContent value="system" className="mt-4 space-y-4">
          <CodeBlock label="Step 1 — System Preparation (Debian 12, run as root)" code={SCRIPTS.system} />
          <InfoBox color="green">
            <p>Installs: MariaDB, Kannel, Nginx, PHP, supervisor, UFW, fail2ban. Start Kannel after configuring /etc/kannel/kannel.conf.</p>
          </InfoBox>
        </TabsContent>

        {/* Kannel Install */}
        <TabsContent value="kannel_install" className="mt-4 space-y-4">
          <InfoBox color="green">
            <p className="font-bold">One-shot Kannel install script — run as root on Debian 12</p>
            <p>Installs Kannel, writes <code>/etc/kannel/kannel.conf</code>, creates dedicated systemd services for bearerbox + smsbox, verifies running. bearerbox on 13001 (internal), smsbox HTTP on 13013, admin on 13000.</p>
          </InfoBox>
          <CodeBlock label="bash install_kannel.sh" code={SCRIPTS.kannel_install} color="text-green-400" />
          <InfoBox color="orange">
            <p className="font-bold">After running the script:</p>
            <p>1. Edit <code>/etc/kannel/kannel.conf</code> — update passwords + supplier credentials</p>
            <p>2. Reload: <code>systemctl restart kannel-bearerbox kannel-smsbox</code></p>
            <p>3. Add tenant blocks → reload: <code>kill -HUP $(pidof bearerbox)</code></p>
          </InfoBox>
        </TabsContent>

        {/* Kannel Config */}
        <TabsContent value="kannel" className="mt-4 space-y-4">
          <InfoBox color="blue">
            <p className="font-bold">Kannel = bearerbox + smsbox. NO Jasmin needed.</p>
            <p>• <strong>bearerbox</strong>: SMPP server for tenants + SMPP/HTTP client to suppliers.</p>
            <p>• <strong>smsbox</strong>: HTTP send API (port 13013). Tenants connect via nginx on ports 4000–6000.</p>
          </InfoBox>
          <CodeBlock label="Kannel Master Config — /etc/kannel/kannel.conf" code={SCRIPTS.kannel_core} />
          <CodeBlock label="Per-Tenant SMPP Server Blocks (append to kannel.conf)" code={SCRIPTS.kannel_tenants} color="text-yellow-300" />
          <CodeBlock label="HTTP Submit API + Tenant Nginx Proxy" code={SCRIPTS.kannel_http} color="text-cyan-300" />
          <CodeBlock label="Kannel Management Commands" code={`# Start / stop / restart
systemctl start   kannel-bearerbox kannel-smsbox
systemctl restart kannel-bearerbox kannel-smsbox
systemctl status  kannel-bearerbox

# Reload config WITHOUT downtime:
kill -HUP \$(pidof bearerbox)

# View logs:
tail -f /var/log/kannel/bearerbox.log
tail -f /var/log/kannel/smsbox.log

# Admin status:
curl "http://localhost:13000/status?password=CHANGE_ADMIN_PASSWORD"`} />
        </TabsContent>

        {/* SIM Box */}
        <TabsContent value="simbox" className="mt-4 space-y-4">
          <InfoBox color="purple">
            <p className="font-bold">SIM Box / BearBox / GoIP Integration</p>
            <p>• Kannel bearerbox connects to SIM box hardware via AT modem or SMPP.</p>
            <p>• Each SIM slot = one smsc group. Use SMPP mode for GoIP/Hybertone/Dinstar, AT modem for BearBox USB.</p>
          </InfoBox>
          <CodeBlock label="SIM Box Configuration — add to /etc/kannel/kannel.conf" code={SCRIPTS.bearerbox_simbox} />
          <CodeBlock label="Detect SIM Box USB devices" code={`ls /dev/ttyUSB* /dev/ttyACM*
dmesg | grep -i tty
apt-get install -y modemmanager && mmcli -L`} color="text-cyan-300" />
        </TabsContent>

        {/* Database */}
        <TabsContent value="database" className="mt-4 space-y-4">
          <InfoBox color="blue">
            <p className="font-bold">One MariaDB instance — all tenants, all data.</p>
            <p>All tables have a <code>tenant_id</code> column. Super Admin queries globally. Tenants query through filtered VIEWs.</p>
            <p>Includes a <code>tenants</code> registry table — populated automatically by <code>fix-tenant.sh</code>.</p>
          </InfoBox>
          <CodeBlock label="Step 4 — Master Database Schema (run as root)" code={SCRIPTS.mariadb_master} />
          <CodeBlock label="Asterisk CDR MySQL Config — /etc/asterisk/cdr_mysql.conf" code={SCRIPTS.cdr_mysql} />
        </TabsContent>

        {/* Tenant DB */}
        <TabsContent value="tenant_db" className="mt-4 space-y-4">
          <InfoBox color="yellow">
            <p className="font-bold">Tenant Deploy — fix-tenant.sh (Quick Fix Script)</p>
            <p>Auto-escalates to root if not already. Usage: <code>bash fix-tenant.sh &lt;tenant_id&gt; &lt;db_name&gt; &lt;password&gt;</code></p>
            <p>Creates: DB + user (both localhost + 127.0.0.1) + full read/write grants on global tables + 9 views (including <code>v_today_summary</code>, <code>v_supplier_stats</code>) + local tables (wallet, wallet_transactions, tenant_users, api_keys, notifications) + saves credentials to <code>/root/.tenant_ID</code>.</p>
          </InfoBox>
          <CodeBlock label="Save as fix-tenant.sh → bash fix-tenant.sh tenant_acme acme_db Telco1988" code={SCRIPTS.tenant_db} color="text-yellow-300" />
          <CodeBlock label="Quick usage" code={`# Switch to root
sudo -i

# Run script
nano fix-tenant.sh   # paste script content
chmod +x fix-tenant.sh
bash fix-tenant.sh tenant_acme acme_db Telco1988

# Verify connection
mysql -u tenant_acme -pTelco1988 acme_db \\
  -e "SHOW TABLES; SELECT balance FROM wallet;"

# View saved credentials
cat /root/.tenant_tenant_acme`} color="text-cyan-300" />
          <Card>
            <CardHeader><CardTitle className="text-sm">Data Isolation Architecture</CardTitle></CardHeader>
            <CardContent>
              <pre className="text-xs font-mono text-muted-foreground bg-muted p-3 rounded">{`Global DB (net2app)           Tenant DB (acme_db)
──────────────────────        ─────────────────────────────────────
clients    ──────────────►   v_clients          (filtered by tenant_id)
suppliers  ──────────────►   v_suppliers        (filtered by tenant_id)
routes     ──────────────►   v_routes           (filtered by tenant_id)
rates      ──────────────►   v_rates            (filtered by tenant_id)
sms_log    ──────────────►   v_sms_log          (filtered by tenant_id)
cdr        ──────────────►   v_cdr              (filtered by tenant_id)
invoices   ──────────────►   v_invoices         (filtered by tenant_id)
billing_summary ─────────►   v_billing_summary  (filtered by tenant_id)
device_sessions ─────────►   v_device_sessions  (filtered by tenant_id)
                              v_today_summary    (today's stats)
                              v_supplier_stats   (per-supplier DLR %)
                              tenant_settings    (local config)
                              api_keys           (local)
                              wallet             (local balance)
                              wallet_transactions (credit/debit log)
                              tenant_users       (local user accounts)
                              notifications      (local alerts)`}</pre>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing */}
        <TabsContent value="billing" className="mt-4 space-y-4">
          <InfoBox color="green">
            <p className="font-bold">Real-Time Billing via MySQL Trigger — Billing-Type Aware</p>
            <p>• <strong>send</strong>: charged on any non-blocked status.</p>
            <p>• <strong>submit</strong>: charged only when SMSC accepts (not failed/rejected).</p>
            <p>• <strong>delivery</strong>: charged only on DELIVRD (or force_dlr).</p>
            <p>• Supplier is ALWAYS only charged on successful submit, regardless of client billing_type.</p>
          </InfoBox>
          <CodeBlock label="Billing Trigger + Device Stats Trigger" code={SCRIPTS.billing_trigger} color="text-yellow-300" />
          <CodeBlock label="Test billing" code={`SELECT tenant_id, period, total_sms, total_cost, total_revenue, margin
FROM net2app.billing_summary WHERE period = CURDATE() ORDER BY total_revenue DESC;`} />
        </TabsContent>

        {/* Asterisk */}
        <TabsContent value="asterisk" className="mt-4 space-y-4">
          <InfoBox color="green">
            <p className="font-bold">One-shot Asterisk 20 LTS install script — run as root on Debian 12</p>
            <p>Downloads, compiles, configures Asterisk with chan_sip, chan_pjsip, AMI. Writes config files and starts systemd service.</p>
          </InfoBox>
          <CodeBlock label="bash install_asterisk.sh" code={SCRIPTS.asterisk} color="text-green-400" />
          <InfoBox color="orange">
            <p className="font-bold">After install:</p>
            <p>1. Update <code>/etc/asterisk/sip.conf</code> — SIP passwords</p>
            <p>2. Update <code>/etc/asterisk/manager.conf</code> — AMI password</p>
            <p>3. Reload: <code>asterisk -rx "core reload"</code></p>
          </InfoBox>
          <CodeBlock label="SIP Config" code={SCRIPTS.sip_conf} />
          <CodeBlock label="AMI Config" code={SCRIPTS.ami_conf} />
        </TabsContent>

        {/* Firewall */}
        <TabsContent value="security" className="mt-4 space-y-4">
          <InfoBox color="blue">
            <p className="font-bold">One-shot UFW firewall setup — run as root on Debian 12</p>
            <p>Opens SSH, SIP, RTP, Kannel (localhost only), SMPP 9095–9200, tenant HTTP panels 4000–6000, blocks MariaDB externally.</p>
          </InfoBox>
          <CodeBlock label="bash setup_ufw.sh" code={SCRIPTS.firewall} color="text-green-400" />
          <CodeBlock label="Fail2ban — protect SIP + SSH" code={`# /etc/fail2ban/jail.local
[asterisk]
enabled = true
filter = asterisk
logpath = /var/log/asterisk/messages
maxretry = 5
bantime = 3600

[sshd]
enabled = true
port = 22
maxretry = 3
bantime = 86400

systemctl reload fail2ban`} />
          <InfoBox color="orange">
            <p className="font-bold">Tenant ports auto-opened via dashboard:</p>
            <p>Tenant Management → UFW Commands tab → copy and run on server.</p>
          </InfoBox>
        </TabsContent>

        {/* Android APK */}
        <TabsContent value="android_apk" className="mt-4 space-y-4">
          <InfoBox color="orange">
            <p className="font-bold">🤖 Android SMS Gateway — APK Integration</p>
            <p>Any Android phone becomes a real SMS supplier using its SIM card with DLR-only billing and auto-reroute fallback.</p>
          </InfoBox>
          <CodeBlock label="Android APK Integration Guide" code={SCRIPTS.android_apk} color="text-orange-300" />
        </TabsContent>

        {/* Billing Setup */}
        <TabsContent value="billing_setup" className="mt-4 space-y-4">
          <InfoBox color="green">
            <p className="font-bold">Billing Triggers + Stored Procedures — run as root on your Debian 12 server</p>
            <p>Creates 4 MySQL triggers (send/submit/delivery billing, device stats) and 3 stored procedures (dashboard, supplier report, client report). Also alters tables to add billing_type, force_dlr, and margin columns.</p>
          </InfoBox>
          <CodeBlock label="Save as setup-billing.sh → bash setup-billing.sh" code={SCRIPTS.setup_billing} color="text-yellow-300" />
          <InfoBox color="orange">
            <p className="font-bold">If billing routes are not registered in the Node server:</p>
            <p>Run <code>fix-routes.sh</code> below — it registers the billing API, fixes the MySQL pool, installs mysql2, and restarts PM2.</p>
          </InfoBox>
          <CodeBlock label="Save as fix-routes.sh → bash fix-routes.sh" code={SCRIPTS.fix_routes} color="text-cyan-300" />
          <InfoBox color="blue">
            <p className="font-bold">API Endpoints after setup:</p>
            <p>GET /api/billing/dashboard • GET /api/billing/summary • GET /api/billing/sms-log</p>
            <p>GET /api/billing/invoices • POST /api/billing/invoice/generate</p>
            <p>GET /api/billing/supplier-report • GET /api/billing/client-report • POST /api/billing/dlr</p>
          </InfoBox>
        </TabsContent>

        {/* GitHub Deploy */}
        <TabsContent value="github" className="mt-4 space-y-4">
          <div className="p-4 bg-gradient-to-r from-gray-900 to-slate-800 rounded-xl text-white space-y-2">
            <div className="flex items-center gap-2">
              <GitBranch className="w-5 h-5" />
              <h3 className="font-bold">GitHub → Debian 12 Auto Deploy</h3>
            </div>
            <p className="text-gray-300 text-sm">Push to main → server auto-pulls, builds, deploys. ~60s from push to live.</p>
          </div>
          <CodeBlock label="Step 1 — SSH Key Setup" code={SCRIPTS.github_ssh} color="text-cyan-300" />
          <CodeBlock label="Step 2 — Initial Server Deploy" code={SCRIPTS.github_deploy} color="text-green-400" />
          <CodeBlock label="Step 3 — Master Deploy Script v2.1.0 (/opt/net2app/deploy.sh)" code={SCRIPTS.github_update} color="text-yellow-300" />
          <CodeBlock label="Step 4 — GitHub Actions CI/CD (.github/workflows/deploy.yml)" code={SCRIPTS.github_actions} color="text-purple-300" />
          <Card>
            <CardHeader><CardTitle className="text-sm">Required GitHub Secrets</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { key: "SERVER_HOST", val: "Your server IP or domain" },
                  { key: "SERVER_USER", val: "root or deploy user" },
                  { key: "SERVER_KEY",  val: "Full content of ~/.ssh/deploy_key (private key)" },
                ].map(s => (
                  <div key={s.key} className="flex items-start gap-3 p-2 bg-muted rounded-lg">
                    <code className="text-xs bg-black/10 px-2 py-0.5 rounded font-mono shrink-0">{s.key}</code>
                    <span className="text-xs text-muted-foreground">{s.val}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SMTP/Logo */}
        <TabsContent value="smtp" className="mt-4 space-y-4">
          <InfoBox color="blue">
            <p className="font-bold">Tenant SMTP + Logo Branding</p>
            <p>Each tenant configures their own SMTP credentials and logo from tenant account settings.</p>
          </InfoBox>
          <CodeBlock label="Tenant SMTP + Branding Architecture" code={SCRIPTS.tenant_smtp} color="text-cyan-300" />
        </TabsContent>
      </Tabs>
    </div>
  );
}