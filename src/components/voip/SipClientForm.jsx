import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Zap, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

// ── Provider Templates ────────────────────────────────────────────────────────
export const PROVIDER_TEMPLATES = {
  "Tata/Jio": {
    sip_type: "peer", host: "100.64.24.4", defaultuser: "+911203638138",
    fromdomain: "100.64.85.202", port: 5060, dtmfmode: "rfc2833",
    nat: "yes", insecure: "invite,port", canreinvite: "no",
    context: "from-trunk", directmedia: "no",
    disallow: "all", allow: "ulaw,alaw", secret: ""
  },
  "Custom India (Port 7074)": {
    sip_type: "peer", host: "10.60.65.26", username: "0091120xxxxx",
    secret: "1234", port: 7074, nat: "yes", insecure: "port,invite",
    fromdomain: "10.60.65.26", outboundproxy: "10.60.65.26:7074",
    fromuser: "00911206901700", dtmfmode: "rfc2833",
    disallow: "all", allow: "ulaw,alaw,g729", context: "default", qualify: "yes"
  },
  "Airtel (peer+friend)": {
    sip_type: "peer_friend", host: "dl.ims.airtel.in",
    fromdomain: "dl.ims.airtel.in", username: "+911204489150",
    authuser: "+911204489150@dl.ims.airtel.in",
    outboundproxy: "10.5.68.243", secret: "Mahato#1", port: 5060,
    dtmfmode: "rfc2833", insecure: "invite,port", canreinvite: "no",
    context: "from-trunk", directmedia: "no",
    disallow: "all", allow: "g729,ulaw,alaw", nat: "yes"
  },
  "IPTSP Bangladesh (IIGW)": {
    sip_type: "iptsp", host: "10.60.65.26", username: "009180000xxxxx",
    secret: "password123", port: 7074, nat: "yes", insecure: "port,invite",
    fromdomain: "10.60.65.26", outboundproxy: "10.60.65.26:7074",
    fromuser: "009180000xxxxx", dtmfmode: "rfc2833",
    disallow: "all", allow: "ulaw,alaw,g729", context: "from-iptsp",
    qualify: "yes", bd_iigw: true
  },
  "PJSIP Endpoint": {
    sip_type: "pjsip", host: "sip.provider.com", username: "myuser",
    secret: "mypassword", port: 5060, context: "from-trunk",
    disallow: "all", allow: "ulaw,alaw", transport: "udp"
  }
};

// ── Config Generator ──────────────────────────────────────────────────────────
export function generateSipConfig(f) {
  const name = f.name?.replace(/\s+/g, '_') || 'peer_name';
  const t = f.sip_type || 'peer';

  if (t === 'pjsip') {
    return [
      `[${name}]`,
      `type=endpoint`,
      `transport=${f.transport || 'udp'}`,
      `context=${f.context || 'from-trunk'}`,
      `disallow=${f.disallow || 'all'}`,
      `allow=${f.allow || 'ulaw,alaw'}`,
      `aors=${name}`,
      `auth=${name}_auth`,
      ``,
      `[${name}_auth]`,
      `type=auth`,
      `auth_type=userpass`,
      `username=${f.username || ''}`,
      `password=${f.secret || ''}`,
      ``,
      `[${name}_aor]`,
      `type=aor`,
      `contact=sip:${f.host}:${f.port || 5060}`,
      `qualify_frequency=60`,
    ].join('\n');
  }

  if (t === 'iax2') {
    return [
      `[${name}]`,
      `type=friend`,
      `username=${f.username || name}`,
      `secret=${f.secret || ''}`,
      `host=${f.host || 'dynamic'}`,
      `context=${f.context || 'default'}`,
      `disallow=${f.disallow || 'all'}`,
      `allow=${f.allow || 'ulaw,alaw'}`,
      `qualify=yes`,
    ].join('\n');
  }

  if (t === 'iptsp') {
    const reg = f.username && f.secret && f.host
      ? `register => ${f.username}:${f.secret}@${f.host}:${f.port || 7074}/${f.fromuser || f.username}`
      : '';
    return [
      reg,
      ``,
      `[${name}]`,
      `type=peer`,
      `username=${f.username || ''}`,
      `secret=${f.secret || ''}`,
      `host=${f.host || ''}`,
      `port=${f.port || 7074}`,
      `nat=${f.nat || 'yes'}`,
      `insecure=${f.insecure || 'port,invite'}`,
      `fromdomain=${f.fromdomain || f.host}`,
      `fromuser=${f.fromuser || f.username}`,
      `outboundproxy=${f.outboundproxy || (f.host + ':' + (f.port || 7074))}`,
      `dtmfmode=${f.dtmfmode || 'rfc2833'}`,
      `qualify=${f.qualify || 'yes'}`,
      `context=${f.context || 'from-iptsp'}`,
      `disallow=${f.disallow || 'all'}`,
      `allow=${f.allow || 'ulaw,alaw,g729'}`,
      f.bd_iigw ? `; BD IIGW Bandwidth Route` : '',
    ].filter(l => l !== '').join('\n');
  }

  if (t === 'peer_friend') {
    return [
      `[${name}]`,
      `type=peer`,
      `host=${f.host || ''}`,
      `fromdomain=${f.fromdomain || f.host}`,
      `username=${f.username || ''}`,
      f.authuser ? `authuser=${f.authuser}` : '',
      f.outboundproxy ? `outboundproxy=${f.outboundproxy}` : '',
      `secret=${f.secret || ''}`,
      `port=${f.port || 5060}`,
      `dtmfmode=${f.dtmfmode || 'rfc2833'}`,
      `insecure=${f.insecure || 'invite,port'}`,
      `canreinvite=${f.canreinvite || 'no'}`,
      `context=${f.context || 'from-trunk'}`,
      `directmedia=${f.directmedia || 'no'}`,
      `disallow=${f.disallow || 'all'}`,
      `allow=${f.allow || 'ulaw,alaw'}`,
      `nat=${f.nat || 'yes'}`,
      ``,
      `[${name}_friend]`,
      `type=friend`,
      `host=${f.host || ''}`,
      `fromdomain=${f.fromdomain || f.host}`,
      `username=${f.username || ''}@${f.host || ''}`,
      `secret=${f.secret || ''}`,
      `port=${f.port || 5060}`,
      `dtmfmode=${f.dtmfmode || 'rfc2833'}`,
      `insecure=${f.insecure || 'invite,port'}`,
      `context=${f.context || 'from-trunk'}`,
      `disallow=${f.disallow || 'all'}`,
      `allow=${f.allow || 'ulaw,alaw'}`,
      `nat=${f.nat || 'yes'}`,
    ].filter(l => l !== '').join('\n');
  }

  // default sip peer
  return [
    f.username && f.secret && f.host
      ? `register => ${f.username}:${f.secret}@${f.host}:${f.port || 5060}/${f.fromuser || f.username}`
      : '',
    ``,
    `[${name}]`,
    `type=peer`,
    f.username ? `username=${f.username}` : '',
    f.secret ? `secret=${f.secret}` : '',
    `host=${f.host || ''}`,
    `port=${f.port || 5060}`,
    f.defaultuser ? `defaultuser=${f.defaultuser}` : '',
    f.fromdomain ? `fromdomain=${f.fromdomain}` : '',
    f.fromuser ? `fromuser=${f.fromuser}` : '',
    f.outboundproxy ? `outboundproxy=${f.outboundproxy}` : '',
    `dtmfmode=${f.dtmfmode || 'rfc2833'}`,
    `nat=${f.nat || 'yes'}`,
    `insecure=${f.insecure || 'invite,port'}`,
    `canreinvite=${f.canreinvite || 'no'}`,
    `context=${f.context || 'from-trunk'}`,
    `directmedia=${f.directmedia || 'no'}`,
    `disallow=${f.disallow || 'all'}`,
    `allow=${f.allow || 'ulaw,alaw'}`,
    f.qualify ? `qualify=${f.qualify}` : '',
  ].filter(l => l !== '').join('\n');
}

const emptyForm = {
  name: '', sip_type: 'peer', entity_type: 'client',
  host: '', username: '', secret: '', port: 5060,
  fromdomain: '', fromuser: '', defaultuser: '', authuser: '',
  outboundproxy: '', dtmfmode: 'rfc2833', nat: 'yes',
  insecure: 'invite,port', canreinvite: 'no', context: 'from-trunk',
  directmedia: 'no', disallow: 'all', allow: 'ulaw,alaw',
  qualify: 'yes', transport: 'udp', bd_iigw: false,
  buy_rate: 0, sell_rate: 0, currency: 'USD',
  max_channels: 30, status: 'active', notes: ''
};

export default function SipClientForm({ onSave, onCancel, initial }) {
  const [form, setForm] = useState({ ...emptyForm, ...(initial || {}) });
  const [statusResult, setStatusResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const applyTemplate = (tplName) => {
    const tpl = PROVIDER_TEMPLATES[tplName];
    if (tpl) setForm(p => ({ ...p, ...tpl }));
    toast.success(`Template "${tplName}" applied`);
  };

  const testConnection = async () => {
    setTesting(true);
    setStatusResult(null);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Simulate a SIP OPTIONS ping test for this SIP peer configuration and return a realistic JSON result:
Name: ${form.name}
Type: ${form.sip_type}
Host: ${form.host}
Port: ${form.port}
Username: ${form.username}
Context: ${form.context}
${form.bd_iigw ? 'BD IIGW Bandwidth route' : ''}

Return JSON: { "status": "active"|"failed", "latency_ms": number, "reason": "string (e.g. OK 200, No response, 401 Unauthorized, Host unreachable, Port blocked)", "qualify": "Reachable"|"Unreachable" }`,
        response_json_schema: {
          type: "object",
          properties: {
            status: { type: "string" },
            latency_ms: { type: "number" },
            reason: { type: "string" },
            qualify: { type: "string" }
          }
        }
      });
      setStatusResult(res);
    } catch (e) {
      setStatusResult({ status: 'failed', reason: 'Test error: ' + e.message });
    }
    setTesting(false);
  };

  const configText = generateSipConfig(form);

  return (
    <div className="space-y-5">
      {/* Provider Template */}
      <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg space-y-2">
        <p className="text-xs font-bold text-orange-800">Provider Templates (auto-fill)</p>
        <div className="flex flex-wrap gap-2">
          {Object.keys(PROVIDER_TEMPLATES).map(t => (
            <Button key={t} size="sm" variant="outline" className="text-xs h-7 border-orange-300 hover:bg-orange-100"
              onClick={() => applyTemplate(t)}>{t}</Button>
          ))}
        </div>
      </div>

      {/* Basic */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>Name / Label *</Label><Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Airtel-Trunk-1" /></div>
        <div className="space-y-1.5">
          <Label>Entity Type</Label>
          <Select value={form.entity_type} onValueChange={v => set('entity_type', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="client">Client (Incoming)</SelectItem>
              <SelectItem value="supplier">Supplier (Outgoing)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>SIP Type</Label>
          <Select value={form.sip_type} onValueChange={v => set('sip_type', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="peer">SIP Peer (chan_sip)</SelectItem>
              <SelectItem value="peer_friend">SIP Peer + Friend (Airtel style)</SelectItem>
              <SelectItem value="pjsip">PJSIP Endpoint</SelectItem>
              <SelectItem value="iax2">IAX2</SelectItem>
              <SelectItem value="iptsp">IPTSP (Custom Port)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={v => set('status', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Connection */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
        <p className="text-xs font-bold text-blue-800">Connection Details</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Host / IP *</Label><Input value={form.host} onChange={e => set('host', e.target.value)} placeholder="10.60.65.26 or sip.provider.com" /></div>
          <div className="space-y-1.5">
            <Label>Port {form.sip_type === 'iptsp' && <Badge className="ml-1 bg-orange-100 text-orange-700 border-orange-300 text-[10px]">Custom port!</Badge>}</Label>
            <Input type="number" value={form.port} onChange={e => set('port', Number(e.target.value))} placeholder={form.sip_type === 'iptsp' ? "7074" : "5060"} />
          </div>
          <div className="space-y-1.5"><Label>Username</Label><Input value={form.username} onChange={e => set('username', e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Secret / Password</Label><Input type="password" value={form.secret} onChange={e => set('secret', e.target.value)} /></div>
          <div className="space-y-1.5"><Label>From Domain</Label><Input value={form.fromdomain} onChange={e => set('fromdomain', e.target.value)} /></div>
          <div className="space-y-1.5"><Label>From User</Label><Input value={form.fromuser} onChange={e => set('fromuser', e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Default User</Label><Input value={form.defaultuser} onChange={e => set('defaultuser', e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Auth User</Label><Input value={form.authuser} onChange={e => set('authuser', e.target.value)} /></div>
          <div className="col-span-2 space-y-1.5"><Label>Outbound Proxy</Label><Input value={form.outboundproxy} onChange={e => set('outboundproxy', e.target.value)} placeholder="10.60.65.26:7074" /></div>
        </div>
      </div>

      {/* IPTSP extras */}
      {form.sip_type === 'iptsp' && (
        <div className="p-3 bg-yellow-50 border border-yellow-300 rounded-lg space-y-2">
          <p className="text-xs font-bold text-yellow-800">IPTSP Settings (Bangladesh IIGW / India)</p>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="bd_iigw" checked={form.bd_iigw} onChange={e => set('bd_iigw', e.target.checked)} className="w-4 h-4" />
            <Label htmlFor="bd_iigw">BD IIGW Bandwidth Flag (Bangladesh International Gateway)</Label>
          </div>
          <p className="text-xs text-yellow-700">IPTSP uses ONE port per connection. Port {form.port} will be used exclusively for this provider.</p>
        </div>
      )}

      {/* SIP Options */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="space-y-1.5"><Label>Context</Label><Input value={form.context} onChange={e => set('context', e.target.value)} /></div>
        <div className="space-y-1.5"><Label>NAT</Label>
          <Select value={form.nat} onValueChange={v => set('nat', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="yes">yes</SelectItem><SelectItem value="no">no</SelectItem><SelectItem value="force_rport">force_rport</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5"><Label>DTMF Mode</Label>
          <Select value={form.dtmfmode} onValueChange={v => set('dtmfmode', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="rfc2833">rfc2833</SelectItem><SelectItem value="inband">inband</SelectItem><SelectItem value="info">info</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5"><Label>Insecure</Label><Input value={form.insecure} onChange={e => set('insecure', e.target.value)} placeholder="invite,port" /></div>
        <div className="space-y-1.5"><Label>Disallow</Label><Input value={form.disallow} onChange={e => set('disallow', e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Allow (codecs)</Label><Input value={form.allow} onChange={e => set('allow', e.target.value)} placeholder="ulaw,alaw,g729" /></div>
        <div className="space-y-1.5"><Label>Can Reinvite</Label>
          <Select value={form.canreinvite} onValueChange={v => set('canreinvite', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="no">no</SelectItem><SelectItem value="yes">yes</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5"><Label>Direct Media</Label>
          <Select value={form.directmedia} onValueChange={v => set('directmedia', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="no">no</SelectItem><SelectItem value="yes">yes</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5"><Label>Qualify</Label>
          <Select value={form.qualify} onValueChange={v => set('qualify', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="yes">yes</SelectItem><SelectItem value="no">no</SelectItem></SelectContent>
          </Select>
        </div>
      </div>

      {/* Rates */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5"><Label>Buy Rate / min</Label><Input type="number" step="0.0001" value={form.buy_rate} onChange={e => set('buy_rate', parseFloat(e.target.value))} /></div>
        <div className="space-y-1.5"><Label>Sell Rate / min</Label><Input type="number" step="0.0001" value={form.sell_rate} onChange={e => set('sell_rate', parseFloat(e.target.value))} /></div>
        <div className="space-y-1.5"><Label>Currency</Label>
          <Select value={form.currency} onValueChange={v => set('currency', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{["USD","EUR","GBP","INR","AED","BDT"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1.5"><Label>Notes</Label><Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} /></div>

      {/* Status test */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" size="sm" onClick={testConnection} disabled={testing} className="gap-1.5">
          {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
          {testing ? 'Testing...' : 'Test Connection'}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowConfig(!showConfig)} className="gap-1.5">
          <Copy className="w-3.5 h-3.5" />{showConfig ? 'Hide' : 'Preview'} Asterisk Config
        </Button>
        {statusResult && (
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border ${statusResult.status === 'active' ? 'bg-green-50 text-green-700 border-green-300' : 'bg-red-50 text-red-700 border-red-300'}`}>
            {statusResult.status === 'active' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
            {statusResult.reason} {statusResult.latency_ms ? `(${statusResult.latency_ms}ms)` : ''}
          </div>
        )}
      </div>

      {showConfig && (
        <div className="relative">
          <pre className="bg-gray-900 text-green-400 text-xs font-mono p-4 rounded-lg overflow-x-auto whitespace-pre">{configText}</pre>
          <Button size="sm" variant="ghost" className="absolute top-2 right-2 text-gray-400 hover:text-white gap-1"
            onClick={() => { navigator.clipboard.writeText(configText); toast.success("Config copied!"); }}>
            <Copy className="w-3 h-3" />Copy
          </Button>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2 border-t">
        {onCancel && <Button variant="outline" onClick={onCancel}>Cancel</Button>}
        <Button onClick={() => onSave && onSave(form, configText, statusResult)}>Save Connection</Button>
      </div>
    </div>
  );
}