import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { RefreshCw, Smartphone, CheckCircle, QrCode, Trash2, Wifi, Pencil, BarChart3, AlertTriangle, ArrowRightLeft, Globe } from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";

const CHANNELS = [
  {
    key: "whatsapp",
    label: "WhatsApp",
    color: "bg-green-500",
    textColor: "text-green-700",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    icon: "💬",
    getQrData: (token) => `whatsapp://connect?token=${token}&ts=${Date.now()}&ref=net2app`,
    instructions: ["Open WhatsApp on your phone", "Tap Menu (⋮) → Linked Devices", "Tap 'Link a Device'", "Point camera at QR code below"],
    expiry: 60,
    connection_type: "DEVICE",
    category: "device",
  },
  {
    key: "telegram",
    label: "Telegram",
    color: "bg-blue-500",
    textColor: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    icon: "✈️",
    getQrData: (token) => `tg://login?token=${token}`,
    instructions: ["Open Telegram on your phone", "Go to Settings → Devices", "Tap 'Link Desktop Device'", "Point camera at QR code below"],
    expiry: 120,
    connection_type: "DEVICE",
    category: "device",
  },
  {
    key: "imo",
    label: "IMO",
    color: "bg-purple-500",
    textColor: "text-purple-700",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
    icon: "📱",
    getQrData: (token) => `imo://web?auth=${token}&device=net2app`,
    instructions: ["Open IMO on your phone", "Go to Settings → Linked Accounts", "Tap 'Add Web/Desktop Device'", "Point camera at QR code below"],
    expiry: 90,
    connection_type: "DEVICE",
    category: "device",
  },
  {
    key: "android",
    label: "Android SMS",
    color: "bg-orange-500",
    textColor: "text-orange-700",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    icon: "🤖",
    getQrData: null, // Android uses webhook URL, not QR
    instructions: [
      "Install the Net2app Android APK on the device",
      "Open app → Settings → Enter Server URL & API Token",
      "Tap 'Register Device' — device ID is shown",
      "Enter Device ID and Webhook URL below",
    ],
    expiry: null,
    connection_type: "ANDROID",
    category: "android",
  },
];

function RealQr({ data, size = 200 }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (!canvasRef.current || !data) return;
    QRCode.toCanvas(canvasRef.current, data, {
      width: size, margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
      errorCorrectionLevel: "M",
    });
  }, [data, size]);
  return <canvas ref={canvasRef} className="rounded-lg border border-border" />;
}

function StatsRow({ label, value, color = "" }) {
  return (
    <div className="flex justify-between items-center text-xs py-1 border-b last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold ${color}`}>{value ?? 0}</span>
    </div>
  );
}

const emptyDevice = {
  name: "", phone: "", allowed_prefixes: "", allowed_mcc_mnc: "",
  reroute_on_fail: true, reroute_supplier_id: "", notes: "",
  android_webhook_url: "", android_device_id: "", android_api_token: "",
};

export default function DeviceConnectTab() {
  const [tab, setTab] = useState("whatsapp");
  const [qrTokens, setQrTokens] = useState({});
  const [timers, setTimers] = useState({});
  const [editDialog, setEditDialog] = useState(null); // device being edited
  const [addForm, setAddForm] = useState({ ...emptyDevice });
  const [sessionName, setSessionName] = useState("");
  const [phone, setPhone] = useState("");
  const [allowedPrefixes, setAllowedPrefixes] = useState("");
  const [allowedMccMnc, setAllowedMccMnc] = useState("");
  const [rerouteOnFail, setRerouteOnFail] = useState(true);
  const [rerouteSupplierId, setRerouteSupplierId] = useState("");
  const timersRef = useRef({});
  const qc = useQueryClient();

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => base44.entities.Supplier.list("-created_date"),
    initialData: [],
  });

  const deviceSuppliers = suppliers.filter((s) => s.category === "device" || s.category === "android");
  const fallbackSuppliers = suppliers.filter((s) => s.category === "sms" || s.category === "voice_otp");

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.Supplier.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["suppliers"] }); toast.success("Device connected and saved as supplier"); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Supplier.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["suppliers"] }); setEditDialog(null); toast.success("Device updated"); },
  });
  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.Supplier.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["suppliers"] }); toast.success("Device disconnected"); },
  });

  const generateQr = (channelKey) => {
    const token = `${channelKey}_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
    const ch = CHANNELS.find((c) => c.key === channelKey);
    setQrTokens((p) => ({ ...p, [channelKey]: { token, qrData: ch.getQrData(token), generated: Date.now() } }));
    if (timersRef.current[channelKey]) clearInterval(timersRef.current[channelKey]);
    let remaining = ch.expiry;
    setTimers((p) => ({ ...p, [channelKey]: remaining }));
    timersRef.current[channelKey] = setInterval(() => {
      remaining--;
      setTimers((p) => ({ ...p, [channelKey]: remaining }));
      if (remaining <= 0) {
        clearInterval(timersRef.current[channelKey]);
        setQrTokens((p) => ({ ...p, [channelKey]: null }));
        setTimers((p) => ({ ...p, [channelKey]: 0 }));
      }
    }, 1000);
    toast.info(`QR generated — scan within ${ch.expiry}s`);
  };

  const markConnected = (channelKey) => {
    const ch = CHANNELS.find((c) => c.key === channelKey);
    const name = sessionName || `${ch.label}_${Date.now()}`;
    const rerouteObj = fallbackSuppliers.find(s => s.id === rerouteSupplierId);
    createMut.mutate({
      name,
      category: ch.category,
      provider_type: ch.label,
      phone: phone || "—",
      connection_type: ch.connection_type,
      billing_type: "delivery",
      allowed_prefixes: allowedPrefixes,
      allowed_mcc_mnc: allowedMccMnc,
      reroute_on_fail: rerouteOnFail,
      reroute_supplier_id: rerouteSupplierId || "",
      reroute_supplier_name: rerouteObj?.name || "",
      total_sent: 0, total_delivered: 0, total_failed: 0, total_rerouted: 0,
      status: "active",
      notes: `Connected via QR — ${new Date().toLocaleString()}`,
    });
    if (timersRef.current[channelKey]) clearInterval(timersRef.current[channelKey]);
    setQrTokens((p) => ({ ...p, [channelKey]: null }));
    setSessionName(""); setPhone(""); setAllowedPrefixes(""); setAllowedMccMnc(""); setRerouteSupplierId(""); setRerouteOnFail(true);
  };

  const registerAndroid = () => {
    if (!addForm.name || !addForm.android_webhook_url || !addForm.android_device_id) {
      toast.error("Name, Webhook URL and Device ID are required");
      return;
    }
    const rerouteObj = fallbackSuppliers.find(s => s.id === addForm.reroute_supplier_id);
    createMut.mutate({
      name: addForm.name,
      category: "android",
      provider_type: "Android SMS",
      phone: addForm.phone || "—",
      connection_type: "ANDROID",
      billing_type: "delivery",
      android_webhook_url: addForm.android_webhook_url,
      android_device_id: addForm.android_device_id,
      android_api_token: addForm.android_api_token,
      allowed_prefixes: addForm.allowed_prefixes,
      allowed_mcc_mnc: addForm.allowed_mcc_mnc,
      reroute_on_fail: addForm.reroute_on_fail,
      reroute_supplier_id: addForm.reroute_supplier_id || "",
      reroute_supplier_name: rerouteObj?.name || "",
      total_sent: 0, total_delivered: 0, total_failed: 0, total_rerouted: 0,
      status: "active",
      notes: addForm.notes || `Android device registered — ${new Date().toLocaleString()}`,
    });
    setAddForm({ ...emptyDevice });
  };

  const saveEdit = () => {
    if (!editDialog) return;
    const rerouteObj = fallbackSuppliers.find(s => s.id === editDialog.reroute_supplier_id);
    updateMut.mutate({ id: editDialog.id, data: { ...editDialog, reroute_supplier_name: rerouteObj?.name || "" } });
  };

  const setEdit = (k, v) => setEditDialog(p => ({ ...p, [k]: v }));
  const setAdd = (k, v) => setAddForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {CHANNELS.map(ch => {
          const chDevices = deviceSuppliers.filter(d => d.provider_type === ch.label || (ch.key === "android" && d.category === "android"));
          const totalSent = chDevices.reduce((s, d) => s + (d.total_sent || 0), 0);
          const totalDlv = chDevices.reduce((s, d) => s + (d.total_delivered || 0), 0);
          return (
            <div key={ch.key} className={`p-3 rounded-lg border ${ch.bgColor} ${ch.borderColor} cursor-pointer ${tab === ch.key ? "ring-2 ring-primary" : ""}`} onClick={() => setTab(ch.key)}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm">{ch.icon} {ch.label}</span>
                <Badge variant="outline" className="text-xs">{chDevices.length}</Badge>
              </div>
              <p className={`text-xs ${ch.textColor}`}>Sent: {totalSent} | DLR: {totalDlv}</p>
            </div>
          );
        })}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          {CHANNELS.map((ch) => {
            const count = deviceSuppliers.filter(d => d.provider_type === ch.label || (ch.key === "android" && d.category === "android")).length;
            return (
              <TabsTrigger key={ch.key} value={ch.key} className="gap-1">
                <span>{ch.icon}</span>{ch.label}
                {count > 0 && <Badge className={`ml-1 h-4 px-1 text-[9px] ${ch.color} text-white`}>{count}</Badge>}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {CHANNELS.map((ch) => {
          const chDevices = deviceSuppliers.filter(d =>
            ch.key === "android" ? d.category === "android" : d.provider_type?.toLowerCase() === ch.key
          );
          const qr = qrTokens[ch.key];
          const timer = timers[ch.key] || 0;

          return (
            <TabsContent key={ch.key} value={ch.key} className="mt-4 space-y-4">
              {/* Info bar */}
              <div className={`p-3 rounded-lg border ${ch.bgColor} ${ch.borderColor} text-xs ${ch.textColor} space-y-1`}>
                <p className="font-semibold">
                  {ch.icon} {ch.label} — Dedicated Supplier per Destination
                </p>
                <p>Each device is a <strong>separate supplier</strong>, assigned to its own routes by destination prefix/MCC-MNC. Billing is <strong>DLR-based only</strong>. If delivery fails (number not on {ch.label}), auto-reroute to configured SMPP/HTTP/VoiceOTP fallback.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Add / QR Panel */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      {ch.key === "android" ? <Smartphone className="w-4 h-4" /> : <QrCode className="w-4 h-4" />}
                      {ch.key === "android" ? "Register Android Device" : "Connect via QR"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {ch.key === "android" ? (
                      /* Android registration form */
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Device Name *</Label>
                            <Input value={addForm.name} onChange={e => setAdd("name", e.target.value)} placeholder="e.g. SIM1-Android" className="h-8 text-xs" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">SIM Phone Number</Label>
                            <Input value={addForm.phone} onChange={e => setAdd("phone", e.target.value)} placeholder="+971XXXXXXX" className="h-8 text-xs" />
                          </div>
                          <div className="col-span-2 space-y-1">
                            <Label className="text-xs">Android Webhook URL *</Label>
                            <Input value={addForm.android_webhook_url} onChange={e => setAdd("android_webhook_url", e.target.value)} placeholder="http://DEVICE_IP:8080/send" className="h-8 text-xs" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Device ID *</Label>
                            <Input value={addForm.android_device_id} onChange={e => setAdd("android_device_id", e.target.value)} placeholder="From APK app" className="h-8 text-xs" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">API Token</Label>
                            <Input value={addForm.android_api_token} onChange={e => setAdd("android_api_token", e.target.value)} placeholder="Optional auth token" className="h-8 text-xs" />
                          </div>
                          <div className="col-span-2 space-y-1">
                            <Label className="text-xs flex items-center gap-1"><Globe className="w-3 h-3" />Allowed Destination Prefixes</Label>
                            <Input value={addForm.allowed_prefixes} onChange={e => setAdd("allowed_prefixes", e.target.value)} placeholder="880,971,44 (comma separated)" className="h-8 text-xs" />
                          </div>
                          <div className="col-span-2 space-y-1">
                            <Label className="text-xs">Allowed MCC/MNC (JSON)</Label>
                            <Input value={addForm.allowed_mcc_mnc} onChange={e => setAdd("allowed_mcc_mnc", e.target.value)} placeholder='[{"mcc":"470","mnc":"01"}]' className="h-8 text-xs" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs flex items-center gap-1"><ArrowRightLeft className="w-3 h-3" />Reroute on Fail</Label>
                            <Select value={addForm.reroute_on_fail ? "yes" : "no"} onValueChange={v => setAdd("reroute_on_fail", v === "yes")}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="yes">Yes — reroute</SelectItem>
                                <SelectItem value="no">No — fail</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {addForm.reroute_on_fail && (
                            <div className="space-y-1">
                              <Label className="text-xs">Fallback Supplier</Label>
                              <Select value={addForm.reroute_supplier_id} onValueChange={v => setAdd("reroute_supplier_id", v)}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select fallback..." /></SelectTrigger>
                                <SelectContent>
                                  {fallbackSuppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.connection_type})</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                        <Button onClick={registerAndroid} className="w-full" size="sm">
                          <Smartphone className="w-4 h-4 mr-2" />Register Android Device
                        </Button>
                        <div className={`p-3 ${ch.bgColor} ${ch.borderColor} border rounded space-y-1`}>
                          <p className={`text-xs font-semibold ${ch.textColor}`}>Setup instructions:</p>
                          {ch.instructions.map((step, i) => <p key={i} className={`text-xs ${ch.textColor}`}>{i + 1}. {step}</p>)}
                        </div>
                      </div>
                    ) : (
                      /* QR connect form */
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Session Name</Label>
                            <Input value={sessionName} onChange={e => setSessionName(e.target.value)} placeholder={`My ${ch.label}`} className="h-8 text-xs" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Phone Number</Label>
                            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+971 5X XXX XXXX" className="h-8 text-xs" />
                          </div>
                          <div className="col-span-2 space-y-1">
                            <Label className="text-xs flex items-center gap-1"><Globe className="w-3 h-3" />Allowed Destination Prefixes</Label>
                            <Input value={allowedPrefixes} onChange={e => setAllowedPrefixes(e.target.value)} placeholder="880,971,44 (comma separated — leave blank for all)" className="h-8 text-xs" />
                          </div>
                          <div className="col-span-2 space-y-1">
                            <Label className="text-xs">Allowed MCC/MNC (JSON, optional)</Label>
                            <Input value={allowedMccMnc} onChange={e => setAllowedMccMnc(e.target.value)} placeholder='[{"mcc":"470","mnc":"01"}]' className="h-8 text-xs" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs flex items-center gap-1"><ArrowRightLeft className="w-3 h-3" />Reroute on Fail</Label>
                            <Select value={rerouteOnFail ? "yes" : "no"} onValueChange={v => setRerouteOnFail(v === "yes")}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="yes">Yes — reroute to fallback</SelectItem>
                                <SelectItem value="no">No — mark failed</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {rerouteOnFail && (
                            <div className="space-y-1">
                              <Label className="text-xs">Fallback Supplier</Label>
                              <Select value={rerouteSupplierId} onValueChange={setRerouteSupplierId}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select fallback..." /></SelectTrigger>
                                <SelectContent>
                                  {fallbackSuppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.connection_type})</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>

                        {!qr ? (
                          <Button onClick={() => generateQr(ch.key)} className="w-full gap-2" size="sm">
                            <QrCode className="w-4 h-4" />Generate QR Code
                          </Button>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex justify-center">
                              <div className="relative">
                                <RealQr data={qr.qrData} size={180} />
                                {timer <= 10 && timer > 0 && (
                                  <div className="absolute inset-0 bg-red-500/20 rounded-lg flex items-center justify-center">
                                    <span className="text-red-600 font-bold text-3xl">{timer}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className={`p-2 ${ch.bgColor} ${ch.borderColor} border rounded text-xs ${ch.textColor} text-center`}>
                              {timer > 10 ? <>Expires in <strong>{timer}s</strong> — scan now</>
                                : timer > 0 ? <span className="text-red-600 font-bold">Expiring in {timer}s!</span>
                                : <span className="text-red-600">Expired — generate new QR</span>}
                            </div>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => generateQr(ch.key)}>
                                <RefreshCw className="w-3 h-3" />Refresh
                              </Button>
                              <Button size="sm" className="flex-1 gap-1 bg-green-600 hover:bg-green-700" onClick={() => markConnected(ch.key)}>
                                <CheckCircle className="w-3 h-3" />Mark Connected ✓
                              </Button>
                            </div>
                          </div>
                        )}

                        <div className={`p-3 ${ch.bgColor} ${ch.borderColor} border rounded space-y-1`}>
                          <p className={`text-xs font-semibold ${ch.textColor}`}>How to connect:</p>
                          {ch.instructions.map((step, i) => <p key={i} className={`text-xs ${ch.textColor}`}>{i + 1}. {step}</p>)}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Connected Devices List */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Smartphone className="w-4 h-4" />Connected {ch.label} Devices
                      <Badge variant="outline">{chDevices.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {chDevices.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        <QrCode className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        No {ch.label} devices connected yet.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {chDevices.map((device) => {
                          const dlrRate = device.total_sent > 0 ? Math.round((device.total_delivered / device.total_sent) * 100) : 0;
                          const failRate = device.total_sent > 0 ? Math.round((device.total_failed / device.total_sent) * 100) : 0;
                          return (
                            <div key={device.id} className={`p-3 ${ch.bgColor} ${ch.borderColor} border rounded-lg space-y-2`}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xl">{ch.icon}</span>
                                  <div>
                                    <p className="text-sm font-semibold">{device.name}</p>
                                    <p className="text-xs text-muted-foreground">{device.phone}</p>
                                    {device.allowed_prefixes && (
                                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Globe className="w-3 h-3" />Prefixes: {device.allowed_prefixes}
                                      </p>
                                    )}
                                    {device.reroute_on_fail && device.reroute_supplier_name && (
                                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <ArrowRightLeft className="w-3 h-3" />Fallback: {device.reroute_supplier_name}
                                      </p>
                                    )}
                                    {device.android_device_id && (
                                      <p className="text-xs text-muted-foreground">ID: {device.android_device_id}</p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditDialog({ ...device })}>
                                    <Pencil className="w-3 h-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteMut.mutate(device.id)}>
                                    <Trash2 className="w-3 h-3 text-destructive" />
                                  </Button>
                                </div>
                              </div>
                              {/* Statistics */}
                              <div className={`p-2 rounded bg-white/60 text-xs space-y-0.5`}>
                                <div className="flex items-center gap-1 mb-1 font-semibold text-muted-foreground">
                                  <BarChart3 className="w-3 h-3" />Statistics
                                </div>
                                <StatsRow label="Total Sent" value={device.total_sent} />
                                <StatsRow label="Delivered (DLR)" value={device.total_delivered} color="text-green-600" />
                                <StatsRow label="Failed / Not on App" value={device.total_failed} color="text-red-600" />
                                <StatsRow label="Rerouted to Fallback" value={device.total_rerouted} color="text-orange-600" />
                                <div className="flex justify-between pt-1">
                                  <span className="text-green-600 font-bold">DLR: {dlrRate}%</span>
                                  <span className="text-red-500 font-bold">Fail: {failRate}%</span>
                                  {device.reroute_on_fail && <span className="text-orange-500 flex items-center gap-0.5"><ArrowRightLeft className="w-2.5 h-2.5" />Reroute ON</span>}
                                </div>
                              </div>
                              <Badge className="bg-green-100 text-green-700 border-green-200 text-xs w-fit">
                                <CheckCircle className="w-3 h-3 mr-1" />Active · DLR Billing
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Production note */}
              <Card className="bg-amber-50 border-amber-200">
                <CardContent className="p-3 text-xs text-amber-800 space-y-1">
                  <p className="font-bold flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" />Routing & Billing Rules — {ch.label}</p>
                  <p>• <strong>Dedicated per-destination:</strong> Each {ch.label} device is a separate Supplier. Assign to Routes by MCC/MNC prefix — do NOT mix with other channel routes.</p>
                  <p>• <strong>DLR billing only:</strong> Client is charged only on confirmed delivery (DLR). No DLR = no charge. Failed = no charge.</p>
                  <p>• <strong>Fail handling:</strong> If destination number is not on {ch.label} (unregistered/offline), system marks as failed and reroutes to fallback SMPP/HTTP/VoiceOTP supplier (if reroute enabled).</p>
                  {ch.key === "android" && <p>• <strong>Android APK:</strong> Device sends real SMS via SIM card. Webhook URL receives send requests from the platform. APK source available — integrate DLR callback to platform URL.</p>}
                  {ch.key === "imo" && <p>• <strong>IMO:</strong> Suitable for BD/Middle East where IMO is widely used. Requires IMO bridge server.</p>}
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>

      {/* Edit Device Dialog */}
      <Dialog open={!!editDialog} onOpenChange={(o) => !o && setEditDialog(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Device — {editDialog?.name}</DialogTitle></DialogHeader>
          {editDialog && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Device Name</Label><Input value={editDialog.name} onChange={e => setEdit("name", e.target.value)} className="h-8 text-xs" /></div>
                <div className="space-y-1"><Label className="text-xs">Phone</Label><Input value={editDialog.phone || ""} onChange={e => setEdit("phone", e.target.value)} className="h-8 text-xs" /></div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs flex items-center gap-1"><Globe className="w-3 h-3" />Allowed Destination Prefixes</Label>
                  <Input value={editDialog.allowed_prefixes || ""} onChange={e => setEdit("allowed_prefixes", e.target.value)} placeholder="880,971,44" className="h-8 text-xs" />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Allowed MCC/MNC (JSON)</Label>
                  <Input value={editDialog.allowed_mcc_mnc || ""} onChange={e => setEdit("allowed_mcc_mnc", e.target.value)} placeholder='[{"mcc":"470","mnc":"01"}]' className="h-8 text-xs" />
                </div>
                {editDialog.category === "android" && (
                  <>
                    <div className="col-span-2 space-y-1"><Label className="text-xs">Webhook URL</Label><Input value={editDialog.android_webhook_url || ""} onChange={e => setEdit("android_webhook_url", e.target.value)} className="h-8 text-xs" /></div>
                    <div className="space-y-1"><Label className="text-xs">Device ID</Label><Input value={editDialog.android_device_id || ""} onChange={e => setEdit("android_device_id", e.target.value)} className="h-8 text-xs" /></div>
                    <div className="space-y-1"><Label className="text-xs">API Token</Label><Input value={editDialog.android_api_token || ""} onChange={e => setEdit("android_api_token", e.target.value)} className="h-8 text-xs" /></div>
                  </>
                )}
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1"><ArrowRightLeft className="w-3 h-3" />Reroute on Fail</Label>
                  <Select value={editDialog.reroute_on_fail ? "yes" : "no"} onValueChange={v => setEdit("reroute_on_fail", v === "yes")}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes — reroute</SelectItem>
                      <SelectItem value="no">No — fail</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {editDialog.reroute_on_fail && (
                  <div className="space-y-1">
                    <Label className="text-xs">Fallback Supplier</Label>
                    <Select value={editDialog.reroute_supplier_id || ""} onValueChange={v => setEdit("reroute_supplier_id", v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select fallback..." /></SelectTrigger>
                      <SelectContent>
                        {fallbackSuppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.connection_type})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-xs">Status</Label>
                  <Select value={editDialog.status} onValueChange={v => setEdit("status", v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="blocked">Blocked</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1"><Label className="text-xs">Notes</Label><Input value={editDialog.notes || ""} onChange={e => setEdit("notes", e.target.value)} className="h-8 text-xs" /></div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(null)}>Cancel</Button>
            <Button onClick={saveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}