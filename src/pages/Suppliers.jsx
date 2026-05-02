import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Phone, MessageSquare, Send, Wifi, BookOpen, Smartphone, TabletSmartphone, Loader2 } from "lucide-react";
import { toast } from "sonner";
import HttpApiTemplates from "@/components/suppliers/HttpApiTemplates";
import DeviceConnectTab from "@/components/suppliers/DeviceConnectTab";

const SUPPLIER_CATEGORIES = [
  { key: "sms", label: "SMS (SMPP/HTTP)", icon: MessageSquare, color: "bg-blue-50 text-blue-700 border-blue-200" },
  { key: "voice_otp", label: "Voice OTP", icon: Phone, color: "bg-green-50 text-green-700 border-green-200" },
  { key: "whatsapp", label: "WhatsApp API", icon: Send, color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { key: "telegram", label: "Telegram API", icon: Wifi, color: "bg-sky-50 text-sky-700 border-sky-200" },
  { key: "device", label: "Device (WA/TG/IMO)", icon: Smartphone, color: "bg-purple-50 text-purple-700 border-purple-200" },
  { key: "android", label: "Android SMS", icon: TabletSmartphone, color: "bg-orange-50 text-orange-700 border-orange-200" },
];

const SMS_PROVIDERS = [
  "Twilio", "Vonage (Nexmo)", "Plivo", "Sinch", "Infobip", "MessageBird (Bird)", "Clickatell",
  "SMSala", "SMSCountry", "Message Central", "Telnyx", "TextMagic", "EasySendSMS", "BulkSMS",
  "ClickSend", "D7 Networks", "SMSGlobal", "Route Mobile", "Cequens", "TextLocal", "Esendex",
  "Amazon SNS", "Telesign", "Kaleyra", "CM.com", "Messente", "Bandwidth", "Prelude", "MSG91",
  "Africa's Talking", "TheTexting", "SendSMSGate", "SMS.to", "Textellent", "iSmartCall",
  "Doo.ae", "Wisoft Solutions", "Siratel", "Bulk SMS Global", "ClockworkSMS", "MessageMedia",
  "Notifyre", "EZ Texting", "SimpleTexting", "Trumpia", "Flowroute", "TrueDialog", "Mitto",
  "2Factor", "Teletalk BD", "Borno API", "Custom HTTP", "SMPP"
];
const VOICE_PROVIDERS = ["Borno VoiceOTP", "Twilio Voice", "Custom SIP", "Asterisk"];
const WHATSAPP_PROVIDERS = ["WhatsApp Business API", "Twilio WhatsApp", "360dialog", "Custom API"];
const TELEGRAM_PROVIDERS = ["Telegram Bot API", "Custom API"];
const DEVICE_PROVIDERS = ["WhatsApp Device", "Telegram Device", "IMO Device"];
const ANDROID_PROVIDERS = ["Android SMS (APK)", "SMS Gateway Android", "Custom Android Webhook"];

const emptySupplier = {
  name: "", category: "sms", provider_type: "", contact_person: "", email: "", phone: "",
  connection_type: "HTTP", smpp_ip: "", smpp_port: 2775,
  smpp_username: "", smpp_password: "",
  http_url: "", http_method: "POST", http_params: "", dlr_url: "",
  api_key: "", api_secret: "", account_sid: "", auth_token: "",
  sip_server: "", sip_port: 5060, sip_username: "", sip_password: "",
  status: "active", priority: 1, tps_limit: 100, notes: ""
};

export default function Suppliers() {
  const [tab, setTab] = useState("sms");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...emptySupplier, category: "sms" });
  const qc = useQueryClient();

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => base44.entities.Supplier.list('-created_date'),
    initialData: [],
  });

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.Supplier.create(data),
    onSuccess: (created, data) => {
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      setDialogOpen(false);
      setEditing(null);
      toast.success("Supplier created successfully!");
      base44.functions.invoke('smppManager', { action: 'sync_supplier', supplier: { ...data, id: created?.id || data.id } }).catch(() => {});
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Supplier.update(id, data),
    onSuccess: (_, { id, data }) => {
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      setDialogOpen(false);
      setEditing(null);
      toast.success("Supplier updated successfully!");
      base44.functions.invoke('smppManager', { action: 'sync_supplier', supplier: { ...data, id } }).catch(() => {});
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.Supplier.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); toast.success("Supplier deleted"); },
  });

  const handleSubmit = () => {
    if (!form.name?.trim()) { toast.error("Supplier Name is required"); return; }
    if (!form.connection_type) { toast.error("Connection Type is required"); return; }
    if (editing) updateMut.mutate({ id: editing.id, data: form });
    else createMut.mutate(form);
  };

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const openAdd = (category) => {
    setEditing(null);
    setForm({ ...emptySupplier, category });
    setDialogOpen(true);
  };

  const openEdit = (s) => {
    setEditing(s);
    setForm({ ...emptySupplier, ...s });
    setDialogOpen(true);
  };

  const getProviderOptions = (cat) => {
    if (cat === "sms") return SMS_PROVIDERS;
    if (cat === "voice_otp") return VOICE_PROVIDERS;
    if (cat === "whatsapp") return WHATSAPP_PROVIDERS;
    if (cat === "telegram") return TELEGRAM_PROVIDERS;
    if (cat === "device") return DEVICE_PROVIDERS;
    if (cat === "android") return ANDROID_PROVIDERS;
    return [];
  };

  const filtered = suppliers.filter(s => (s.category || "sms") === tab);
  const currentCat = SUPPLIER_CATEGORIES.find(c => c.key === tab);

  return (
    <div className="space-y-6">
      <PageHeader title="Suppliers" description="Manage all telecom suppliers — SMS, Voice OTP, WhatsApp & Telegram">
        <Button onClick={() => openAdd(tab)}>
          <Plus className="w-4 h-4 mr-2" />Add Supplier
        </Button>
      </PageHeader>

      {/* Category counts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {SUPPLIER_CATEGORIES.map(cat => {
          const count = suppliers.filter(s => (s.category || "sms") === cat.key).length;
          return (
            <Card key={cat.key} className={`cursor-pointer transition-all hover:shadow-md ${tab === cat.key ? "ring-2 ring-primary" : ""}`} onClick={() => setTab(cat.key)}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg border ${cat.color}`}><cat.icon className="w-4 h-4" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">{cat.label}</p>
                  <p className="text-xl font-bold">{count}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          {SUPPLIER_CATEGORIES.map(cat => (
            <TabsTrigger key={cat.key} value={cat.key}>
              <cat.icon className="w-3.5 h-3.5 mr-1.5" />{cat.label}
            </TabsTrigger>
          ))}
          <TabsTrigger value="http_library">
            <BookOpen className="w-3.5 h-3.5 mr-1.5" />HTTP API Library
          </TabsTrigger>
        </TabsList>

        {SUPPLIER_CATEGORIES.map(cat => (
          <TabsContent key={cat.key} value={cat.key} className="mt-4">
            {(cat.key === "device" || cat.key === "android") ? (
              /* Device + Android tab: show QR/Android connect panel */
              <div className="space-y-4">
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-800">
                  <p className="font-semibold mb-1">📱 Device & Android SMS Connect — Dedicated Suppliers per Destination</p>
                  <p className="text-xs">WhatsApp, Telegram, IMO, and Android SIM devices — each linked device is a <strong>separate dedicated supplier</strong> with its own allowed destinations, fallback reroute settings, and DLR-based billing. Do not mix channels in one route.</p>
                </div>
                <DeviceConnectTab />
              </div>
            ) : (
              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <cat.icon className="w-4 h-4" />{cat.label}
                    <Badge variant="outline">{suppliers.filter(s => (s.category || "sms") === cat.key).length}</Badge>
                  </CardTitle>
                  <Button size="sm" onClick={() => openAdd(cat.key)}><Plus className="w-3.5 h-3.5 mr-1" />Add</Button>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Provider</TableHead>
                        <TableHead>Connection</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>TPS</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {suppliers.filter(s => (s.category || "sms") === cat.key).map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{s.name}</TableCell>
                          <TableCell>
                            <span className="text-xs font-mono bg-muted px-2 py-1 rounded">{s.provider_type || "—"}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs bg-muted px-2 py-1 rounded">{s.connection_type}</span>
                          </TableCell>
                          <TableCell>{s.priority}</TableCell>
                          <TableCell>{s.tps_limit}</TableCell>
                          <TableCell><StatusBadge status={s.status} /></TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="w-4 h-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => deleteMut.mutate(s.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {suppliers.filter(s => (s.category || "sms") === cat.key).length === 0 && (
                        <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                          No {cat.label} suppliers yet. Click "Add" to add one.
                        </TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        ))}

        <TabsContent value="http_library" className="mt-4">
          <HttpApiTemplates />
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Supplier' : `Add ${SUPPLIER_CATEGORIES.find(c => c.key === form.category)?.label || ''} Supplier`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Category */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={v => set('category', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SUPPLIER_CATEGORIES.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Provider / Platform</Label>
                <Select value={form.provider_type} onValueChange={v => set('provider_type', v)}>
                  <SelectTrigger><SelectValue placeholder="Select provider..." /></SelectTrigger>
                  <SelectContent>
                    {getProviderOptions(form.category).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    <SelectItem value="other">Other / Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Supplier Name *</Label><Input value={form.name} onChange={e => set('name', e.target.value)} /></div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => set('status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Contact Person</Label><Input value={form.contact_person} onChange={e => set('contact_person', e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={e => set('email', e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Priority</Label><Input type="number" value={form.priority} onChange={e => set('priority', Number(e.target.value))} /></div>
              <div className="space-y-1.5"><Label>TPS Limit</Label><Input type="number" value={form.tps_limit} onChange={e => set('tps_limit', Number(e.target.value))} /></div>
            </div>

            {/* Connection Type */}
            <div className="space-y-1.5">
              <Label>Connection Type</Label>
              <Select value={form.connection_type} onValueChange={v => set('connection_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="HTTP">HTTP API</SelectItem>
                  <SelectItem value="SMPP">SMPP</SelectItem>
                  <SelectItem value="SIP">SIP / VoIP</SelectItem>
                  <SelectItem value="SDK">SDK / Library</SelectItem>
                  <SelectItem value="DEVICE">Device (WA/TG/IMO)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* HTTP Credentials */}
            {form.connection_type === 'HTTP' && (
              <div className="space-y-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-xs font-semibold text-blue-800">HTTP API Configuration</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1.5"><Label>API Endpoint URL</Label><Input value={form.http_url} onChange={e => set('http_url', e.target.value)} placeholder="https://api.example.com/send" /></div>
                  <div className="space-y-1.5"><Label>API Key</Label><Input value={form.api_key} onChange={e => set('api_key', e.target.value)} placeholder="Your API Key" /></div>
                  <div className="space-y-1.5"><Label>API Secret / Token</Label><Input type="password" value={form.api_secret} onChange={e => set('api_secret', e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Account SID (if applicable)</Label><Input value={form.account_sid} onChange={e => set('account_sid', e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Auth Token (if applicable)</Label><Input type="password" value={form.auth_token} onChange={e => set('auth_token', e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>HTTP Method</Label>
                    <Select value={form.http_method} onValueChange={v => set('http_method', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="GET">GET</SelectItem><SelectItem value="POST">POST</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-1.5"><Label>DLR / Delivery Report URL</Label><Input value={form.dlr_url} onChange={e => set('dlr_url', e.target.value)} placeholder="http://..." /></div>
                  <div className="col-span-2 space-y-1.5"><Label>Extra HTTP Params (JSON)</Label><Textarea value={form.http_params} onChange={e => set('http_params', e.target.value)} rows={2} placeholder='{"from": "sender", "type": "text"}' /></div>
                </div>
                <p className="text-xs text-blue-600 italic">API Key and credentials can be added/updated later.</p>
              </div>
            )}

            {/* SMPP */}
            {form.connection_type === 'SMPP' && (
              <div className="space-y-3 p-3 bg-purple-50 rounded-lg border border-purple-100">
                <p className="text-xs font-semibold text-purple-800">SMPP Configuration</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>SMPP IP / Host</Label><Input value={form.smpp_ip} onChange={e => set('smpp_ip', e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Port</Label><Input type="number" value={form.smpp_port} onChange={e => set('smpp_port', Number(e.target.value))} /></div>
                  <div className="space-y-1.5"><Label>Username</Label><Input value={form.smpp_username} onChange={e => set('smpp_username', e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Password</Label><Input type="password" value={form.smpp_password} onChange={e => set('smpp_password', e.target.value)} /></div>
                </div>
              </div>
            )}

            {/* SIP / VoIP */}
            {form.connection_type === 'SIP' && (
              <div className="space-y-3 p-3 bg-green-50 rounded-lg border border-green-100">
                <p className="text-xs font-semibold text-green-800">SIP / VoIP Configuration (Asterisk)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>SIP Server IP</Label><Input value={form.sip_server} onChange={e => set('sip_server', e.target.value)} placeholder="192.168.1.100" /></div>
                  <div className="space-y-1.5"><Label>Port</Label><Input type="number" value={form.sip_port} onChange={e => set('sip_port', Number(e.target.value))} placeholder="5060" /></div>
                  <div className="space-y-1.5"><Label>SIP Username (optional)</Label><Input value={form.sip_username} onChange={e => set('sip_username', e.target.value)} placeholder="Leave blank if no auth" /></div>
                  <div className="space-y-1.5"><Label>SIP Password (optional)</Label><Input type="password" value={form.sip_password} onChange={e => set('sip_password', e.target.value)} /></div>
                </div>
                <p className="text-xs text-green-700">No authentication required — calls will pass directly to SIP server via IP:Port.</p>
              </div>
            )}

            {/* OTP Unicode Preset */}
            <div className="space-y-3 p-3 bg-orange-50 rounded-lg border border-orange-100">
              <p className="text-xs font-semibold text-orange-800">🔡 OTP Unicode Digit Replacement</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">OTP Unicode Preset Name</Label>
                  <Input value={form.otp_unicode_preset || ""} onChange={e => set('otp_unicode_preset', e.target.value)} placeholder="e.g. Style-A (must match preset name)" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Enable OTP Unicode on this Supplier</Label>
                  <Select value={form.otp_unicode_enabled ? "yes" : "no"} onValueChange={v => set('otp_unicode_enabled', v === "yes")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Enabled</SelectItem>
                      <SelectItem value="no">Disabled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-orange-700">Manage presets in Content → OTP Presets (DB) tab. Enter exact preset name above.</p>
            </div>
            <div className="space-y-1.5"><Label>Notes</Label><Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending}>
              {(createMut.isPending || updateMut.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}