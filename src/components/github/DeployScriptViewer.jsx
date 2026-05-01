import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Terminal, Copy, Check, ExternalLink, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const DEPLOY_STEPS = [
  { num: 1,  label: "System Update",            desc: "apt-get update, upgrade, install build-essential, git, curl, wget, vim, net-tools" },
  { num: 2,  label: "MariaDB",                  desc: "Install DB server, create net2app global database, user, and all schema tables" },
  { num: 3,  label: "Kannel SMS Gateway",        desc: "Install Kannel bearerbox + smsbox, write /etc/kannel/kannel.conf, create systemd services" },
  { num: 4,  label: "Asterisk 20 LTS",           desc: "Compile from source, configure chan_sip + PJSIP + AMI, enable CDR MySQL logging" },
  { num: 5,  label: "Node.js 20 LTS",            desc: "Install via NodeSource repository — required for frontend build" },
  { num: 6,  label: "PM2 Process Manager",        desc: "Install globally, configure systemd startup for Node backend processes" },
  { num: 7,  label: "Nginx",                     desc: "Install, configure SPA reverse proxy for admin panel + per-tenant HTTP panels (ports 4000–6000)" },
  { num: 8,  label: "UFW Firewall",              desc: "Open: SSH 22, HTTP 80/443, SIP 5060, RTP 10000–20000, SMPP 9095–9200, tenant ports 4000–6000, Kannel localhost only" },
  { num: 9,  label: "Fail2Ban",                  desc: "Enable brute-force protection for SSH + Asterisk SIP authentication" },
  { num: 10, label: "Per-Tenant DB Provisioning", desc: "Run create_tenant.sh per tenant — creates isolated DB, filtered views, wallet & api_keys tables" },
  { num: 11, label: "Billing Triggers",           desc: "Apply billing-type aware MySQL triggers on sms_log for real-time billing_summary updates" },
  { num: 12, label: "App Clone & Build",          desc: "Clone net2app from GitHub, npm install, npm run build → copy dist/ to /var/www/html" },
];

const ONE_LINE = "bash <(curl -s https://raw.githubusercontent.com/eliasewu/net2app.com/main/deploy.sh)";

export default function DeployScriptViewer() {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const copy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Terminal className="w-4 h-4 text-green-600" />
            Debian Auto-Deploy Script
            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">12 Steps</Badge>
            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">v2.1.0</Badge>
          </CardTitle>
          <div className="flex gap-2">
            <a
              href="https://github.com/eliasewu/net2app.com/blob/main/deploy.sh"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                <ExternalLink className="w-3 h-3" />View on GitHub
              </Button>
            </a>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* One-line command */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">One-Line Deploy Command</p>
          <div className="flex items-center gap-2 bg-gray-900 rounded-lg px-3 py-2.5">
            <code className="flex-1 text-xs text-green-400 font-mono break-all">{ONE_LINE}</code>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 text-gray-400 hover:text-white shrink-0"
              onClick={() => copy(ONE_LINE)}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>

        {/* Step list toggle */}
        <button
          className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setExpanded(v => !v)}
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expanded ? "Hide" : "Show"} deployment steps ({DEPLOY_STEPS.length})
        </button>

        {expanded && (
          <div className="space-y-2">
            {DEPLOY_STEPS.map(step => (
              <div key={step.num} className="flex items-start gap-3 p-2.5 rounded-lg border bg-muted/30">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold flex items-center justify-center shrink-0">
                  {step.num}
                </div>
                <div>
                  <p className="text-sm font-semibold">{step.label}</p>
                  <p className="text-xs text-muted-foreground">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Missing file warning */}
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs space-y-2">
          <p className="font-semibold text-red-800 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />deploy.sh not found in GitHub repo — you must push it first</p>
          <p className="text-red-700">The file <code className="bg-red-100 px-1 rounded">deploy.sh</code> must exist at the root of <code className="bg-red-100 px-1 rounded">eliasewu/net2app.com</code>. Run these commands on your local machine:</p>
          <div className="bg-gray-900 rounded p-2 space-y-1">
            {[
              "git clone https://github.com/eliasewu/net2app.com.git",
              "cd net2app.com",
              "# paste the deploy.sh content (copy from Deploy Guide → GitHub Deploy tab)",
              "git add deploy.sh",
              'git commit -m "Add deploy.sh"',
              "git push origin main",
            ].map((line, i) => (
              <div key={i} className="flex items-center gap-2">
                <code className={`font-mono text-[10px] ${line.startsWith('#') ? 'text-gray-500' : 'text-green-400'}`}>{line}</code>
                {!line.startsWith('#') && (
                  <button onClick={() => { navigator.clipboard.writeText(line); toast.success("Copied"); }} className="text-gray-500 hover:text-white shrink-0">
                    <Copy className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <p className="text-red-700">After pushing, the one-line command above will work from any server.</p>
        </div>

        {/* Credentials summary */}
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs space-y-1">
          <p className="font-semibold text-amber-800">📋 Default Credentials (change after deploy!)</p>
          <p className="text-amber-700 font-mono">DB User: net2app / Pass: STRONG_PASSWORD_CHANGE_ME</p>
          <p className="text-amber-700 font-mono">Kannel Admin PW: CHANGE_ADMIN_PASSWORD</p>
          <p className="text-amber-700 font-mono">Asterisk AMI PW: CHANGE_AMI_PASSWORD</p>
          <p className="text-amber-700 font-mono">App Dir: /opt/net2app | Build: /var/www/html</p>
        </div>
      </CardContent>
    </Card>
  );
}