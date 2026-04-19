import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, Copy, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  nextSmppPort, nextHttpPort, isSmppPortTaken, isHttpPortTaken,
  generateKannelTenantConfig, generateUfwCommands, PACKAGES,
  SMPP_BASE_PORT, HTTP_START, HTTP_END
} from "@/lib/portUtils";

const empty = {
  company_name: '', login_username: '', login_password: '', contact_email: '', contact_phone: '',
  package_type: '5m_sms', sms_limit: 5000000, voice_otp_limit: 0, voip_minutes_limit: 0,
  monthly_price: 200, currency: 'USD', expiry_date: '',
  smpp_port: 9096, http_port: 4000,
  smpp_system_id: '', smpp_password: '',
  status: 'active', notes: ''
};

export default function TenantForm({ tenants = [], initial = null, onSave, onCancel }) {
  const [form, setForm] = useState(() => ({ ...empty, ...(initial || {}) }));
  const [checkingSmpp, setCheckingSmpp] = useState(false);
  const [checkingHttp, setCheckingHttp] = useState(false);
  const [showKannel, setShowKannel] = useState(false);
  const [showUfw, setShowUfw] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // Auto-fill ports on mount for new tenant
  useEffect(() => {
    if (!initial) {
      set('smpp_port', nextSmppPort(tenants));
      set('http_port', nextHttpPort(tenants));
    }
  }, []);

  // Auto-fill package defaults
  const applyPackage = (key) => {
    const pkg = PACKAGES.find(p => p.key === key);
    if (pkg) {
      setForm(p => ({
        ...p,
        package_type: key,
        sms_limit: pkg.sms,
        voice_otp_limit: pkg.voice,
        voip_minutes_limit: pkg.voip,
        monthly_price: pkg.price,
        smpp_system_id: p.smpp_system_id || (p.login_username ? p.login_username + '_user' : ''),
        smpp_password: p.smpp_password || Math.random().toString(36).slice(2, 10) + 'A1!',
      }));
    }
  };

  const simulatePortCheck = async (type, port) => {
    if (type === 'smpp') setCheckingSmpp(true);
    else setCheckingHttp(true);
    await new Promise(r => setTimeout(r, 600));
    if (type === 'smpp') setCheckingSmpp(false);
    else setCheckingHttp(false);
  };

  const smppTaken = isSmppPortTaken(tenants, form.smpp_port, initial?.id);
  const httpTaken = isHttpPortTaken(tenants, form.http_port, initial?.id);
  const smppValid = form.smpp_port > SMPP_BASE_PORT && !smppTaken;
  const httpValid = form.http_port >= HTTP_START && form.http_port <= HTTP_END && !httpTaken;

  const kannelConfig = generateKannelTenantConfig(form);
  const ufwCommands = generateUfwCommands(form);

  const handleSave = () => {
    if (!form.company_name || !form.login_username) { toast.error("Company name and username required"); return; }
    if (!smppValid) { toast.error("SMPP port is invalid or already taken"); return; }
    if (!httpValid) { toast.error("HTTP port is invalid or already taken"); return; }
    onSave && onSave({ ...form, kannel_config: kannelConfig, ufw_commands: ufwCommands });
  };

  return (
    <div className="space-y-5">
      {/* Basic Info */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5 col-span-2"><Label>Company / Tenant Name *</Label><Input value={form.company_name} onChange={e => set('company_name', e.target.value)} placeholder="e.g. Acme SMS Ltd" /></div>
        <div className="space-y-1.5"><Label>Login Username *</Label><Input value={form.login_username} onChange={e => set('login_username', e.target.value)} placeholder="tenant_acme" /></div>
        <div className="space-y-1.5"><Label>Login Password</Label><Input type="password" value={form.login_password} onChange={e => set('login_password', e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Contact Email</Label><Input type="email" value={form.contact_email} onChange={e => set('contact_email', e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Contact Phone</Label><Input value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} /></div>
      </div>

      {/* Package */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
        <p className="text-xs font-bold text-blue-800">Package & Limits</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label>Package Type</Label>
            <Select value={form.package_type} onValueChange={applyPackage}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PACKAGES.map(p => <SelectItem key={p.key} value={p.key}>{p.label} {p.price > 0 ? `— $${p.price}/mo` : ''}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>SMS Limit (0 = unlimited)</Label><Input type="number" value={form.sms_limit} onChange={e => set('sms_limit', Number(e.target.value))} /></div>
          <div className="space-y-1.5"><Label>Voice OTP Limit</Label><Input type="number" value={form.voice_otp_limit} onChange={e => set('voice_otp_limit', Number(e.target.value))} /></div>
          <div className="space-y-1.5"><Label>VoIP Minutes</Label><Input type="number" value={form.voip_minutes_limit} onChange={e => set('voip_minutes_limit', Number(e.target.value))} /></div>
          <div className="space-y-1.5"><Label>Monthly Price</Label>
            <div className="flex gap-2">
              <Input type="number" value={form.monthly_price} onChange={e => set('monthly_price', Number(e.target.value))} />
              <Select value={form.currency} onValueChange={v => set('currency', v)}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>{["USD","EUR","GBP","INR","AED","BDT"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5"><Label>Expiry Date</Label><Input type="date" value={form.expiry_date} onChange={e => set('expiry_date', e.target.value)} /></div>
        </div>
      </div>

      {/* Ports */}
      <div className="p-3 bg-orange-50 border border-orange-300 rounded-lg space-y-3">
        <p className="text-xs font-bold text-orange-800">Port Assignment (Auto-suggested)</p>

        {/* SMPP Port */}
        <div className="space-y-1.5">
          <Label className="flex items-center gap-2">
            SMPP Port (base: {SMPP_BASE_PORT}, new starts {SMPP_BASE_PORT + 1}+)
            <Badge variant="outline" className={smppTaken ? 'bg-red-50 text-red-700 border-red-300' : 'bg-green-50 text-green-700 border-green-300'}>
              {checkingSmpp ? <><Loader2 className="w-3 h-3 animate-spin mr-1" />Checking...</> : smppTaken ? <><XCircle className="w-3 h-3 mr-1" />In Use</> : <><CheckCircle2 className="w-3 h-3 mr-1" />Free</>}
            </Badge>
          </Label>
          <div className="flex gap-2">
            <Input type="number" value={form.smpp_port} onChange={e => { set('smpp_port', Number(e.target.value)); simulatePortCheck('smpp', Number(e.target.value)); }} className={smppTaken ? 'border-red-400' : smppValid ? 'border-green-400' : ''} />
            <Button variant="outline" size="icon" title="Suggest next free port" onClick={() => set('smpp_port', nextSmppPort(tenants))}>
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
          {smppTaken && <p className="text-xs text-red-600">Port {form.smpp_port} is already assigned to another tenant.</p>}
        </div>

        {/* HTTP Port */}
        <div className="space-y-1.5">
          <Label className="flex items-center gap-2">
            HTTP Panel Port ({HTTP_START}–{HTTP_END})
            <Badge variant="outline" className={httpTaken ? 'bg-red-50 text-red-700 border-red-300' : httpValid ? 'bg-green-50 text-green-700 border-green-300' : 'bg-yellow-50 text-yellow-700 border-yellow-300'}>
              {checkingHttp ? <><Loader2 className="w-3 h-3 animate-spin mr-1" />Checking...</> : httpTaken ? <><XCircle className="w-3 h-3 mr-1" />In Use</> : httpValid ? <><CheckCircle2 className="w-3 h-3 mr-1" />Free</> : 'Out of range'}
            </Badge>
          </Label>
          <div className="flex gap-2">
            <Input type="number" value={form.http_port} onChange={e => { set('http_port', Number(e.target.value)); simulatePortCheck('http', Number(e.target.value)); }} className={httpTaken ? 'border-red-400' : httpValid ? 'border-green-400' : ''} />
            <Button variant="outline" size="icon" title="Suggest next free port" onClick={() => set('http_port', nextHttpPort(tenants))}>
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
          {form.http_port >= HTTP_START && form.http_port <= HTTP_END && (
            <p className="text-xs text-muted-foreground">Tenant panel URL: <code className="bg-muted px-1 rounded">http://SERVER_IP:{form.http_port}</code></p>
          )}
          {(form.http_port < HTTP_START || form.http_port > HTTP_END) && (
            <p className="text-xs text-red-600">Port must be between {HTTP_START} and {HTTP_END}.</p>
          )}
        </div>
      </div>

      {/* SMPP Credentials */}
      <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg space-y-3">
        <p className="text-xs font-bold text-purple-800">SMPP Bind Credentials (for Kannel)</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>SMPP System ID</Label><Input value={form.smpp_system_id} onChange={e => set('smpp_system_id', e.target.value)} placeholder={form.login_username + '_user'} /></div>
          <div className="space-y-1.5"><Label>SMPP Password</Label><Input value={form.smpp_password} onChange={e => set('smpp_password', e.target.value)} /></div>
        </div>
      </div>

      {/* Status */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={v => set('status', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5"><Label>Notes</Label><Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} /></div>

      {/* Generated configs */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => setShowKannel(!showKannel)}>
            {showKannel ? 'Hide' : 'Preview'} Kannel Config
          </Button>
          <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => setShowUfw(!showUfw)}>
            {showUfw ? 'Hide' : 'Preview'} UFW Commands
          </Button>
        </div>
        {showKannel && (
          <div className="relative">
            <pre className="bg-gray-900 text-green-400 text-xs font-mono p-3 rounded overflow-x-auto">{kannelConfig}</pre>
            <Button size="sm" variant="ghost" className="absolute top-1 right-1 text-gray-400 hover:text-white gap-1" onClick={() => { navigator.clipboard.writeText(kannelConfig); toast.success("Kannel config copied!"); }}><Copy className="w-3 h-3" />Copy</Button>
          </div>
        )}
        {showUfw && (
          <div className="relative">
            <pre className="bg-gray-900 text-yellow-300 text-xs font-mono p-3 rounded overflow-x-auto">{ufwCommands}</pre>
            <Button size="sm" variant="ghost" className="absolute top-1 right-1 text-gray-400 hover:text-white gap-1" onClick={() => { navigator.clipboard.writeText(ufwCommands); toast.success("UFW commands copied!"); }}><Copy className="w-3 h-3" />Copy</Button>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t">
        {onCancel && <Button variant="outline" onClick={onCancel}>Cancel</Button>}
        <Button onClick={handleSave} disabled={smppTaken || httpTaken || !smppValid || !httpValid}>
          {initial ? 'Update Tenant' : 'Create Tenant'}
        </Button>
      </div>
    </div>
  );
}