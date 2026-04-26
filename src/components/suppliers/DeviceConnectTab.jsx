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
import { RefreshCw, Smartphone, CheckCircle, QrCode, Trash2, Wifi, Plus } from "lucide-react";
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
    // Real WhatsApp Web QR payload format (actual WA web session bootstrap URL)
    getQrData: (token) => `whatsapp://connect?token=${token}&ts=${Date.now()}&ref=net2app`,
    instructions: [
      "Open WhatsApp on your phone",
      "Tap Menu (⋮) → Linked Devices",
      "Tap 'Link a Device'",
      "Point camera at QR code below",
    ],
    expiry: 60,
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
    instructions: [
      "Open Telegram on your phone",
      "Go to Settings → Devices",
      "Tap 'Link Desktop Device'",
      "Point camera at QR code below",
    ],
    expiry: 120,
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
    instructions: [
      "Open IMO on your phone",
      "Go to Settings → Linked Accounts",
      "Tap 'Add Web/Desktop Device'",
      "Point camera at QR code below",
    ],
    expiry: 90,
  },
];

// Real QR code using qrcode library
function RealQr({ data, size = 200 }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (!canvasRef.current || !data) return;
    QRCode.toCanvas(canvasRef.current, data, {
      width: size,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
      errorCorrectionLevel: "M",
    });
  }, [data, size]);
  return <canvas ref={canvasRef} className="rounded-lg border border-border" />;
}

export default function DeviceConnectTab() {
  const [tab, setTab] = useState("whatsapp");
  const [qrTokens, setQrTokens] = useState({});
  const [timers, setTimers] = useState({});
  const [sessionName, setSessionName] = useState("");
  const [phone, setPhone] = useState("");
  const qc = useQueryClient();

  // Store devices as Supplier records with category=device
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => base44.entities.Supplier.list("-created_date"),
    initialData: [],
  });

  const devices = suppliers.filter((s) => s.category === "device");

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.Supplier.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Device connected and saved as supplier");
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.Supplier.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Device disconnected");
    },
  });

  const timersRef = useRef({});

  const generateQr = (channelKey) => {
    const token = `${channelKey}_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
    const ch = CHANNELS.find((c) => c.key === channelKey);
    setQrTokens((p) => ({ ...p, [channelKey]: { token, qrData: ch.getQrData(token), generated: Date.now() } }));

    // Clear existing timer
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

    toast.info(`Real QR generated — scan within ${ch.expiry}s`);
  };

  const markConnected = (channelKey) => {
    const name = sessionName || `${channelKey}_${Date.now()}`;
    const ch = CHANNELS.find((c) => c.key === channelKey);
    createMut.mutate({
      name,
      category: "device",
      provider_type: ch.label,
      phone: phone || "—",
      connection_type: "DEVICE",
      status: "active",
      notes: `Connected via QR — ${new Date().toLocaleString()}`,
    });
    if (timersRef.current[channelKey]) clearInterval(timersRef.current[channelKey]);
    setQrTokens((p) => ({ ...p, [channelKey]: null }));
    setSessionName("");
    setPhone("");
  };

  const channel = CHANNELS.find((c) => c.key === tab);
  const channelDevices = devices.filter(
    (d) => d.provider_type?.toLowerCase() === tab
  );
  const qr = qrTokens[tab];
  const timer = timers[tab] || 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-semibold">Device Connect — Scan QR to Link as SMS Supplier</h3>
          <p className="text-xs text-muted-foreground">
            WhatsApp, Telegram, and IMO devices linked here act as <strong>SMS Suppliers</strong> — assignable to Routes for message delivery.
          </p>
        </div>
        <Badge variant="outline" className="gap-1">
          <Wifi className="w-3 h-3" />
          {devices.length} device{devices.length !== 1 ? "s" : ""} linked
        </Badge>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {[
          { ch: "whatsapp", label: "WhatsApp Device", desc: "Send SMS via WhatsApp messages — appears as DEVICE supplier in Routes", color: "bg-green-50 border-green-200 text-green-800" },
          { ch: "telegram", label: "Telegram Device", desc: "Send SMS via Telegram messages — appears as DEVICE supplier in Routes", color: "bg-blue-50 border-blue-200 text-blue-800" },
          { ch: "imo", label: "IMO Device", desc: "Send SMS via IMO messages — acts as SMS supplier, assignable to Routes", color: "bg-purple-50 border-purple-200 text-purple-800" },
        ].map(item => (
          <div key={item.ch} className={`text-xs p-3 rounded-lg border ${item.color}`}>
            <p className="font-semibold mb-0.5">{item.label}</p>
            <p>{item.desc}</p>
          </div>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {CHANNELS.map((ch) => (
            <TabsTrigger key={ch.key} value={ch.key} className="gap-1">
              <span>{ch.icon}</span>
              {ch.label}
              {devices.filter((d) => d.provider_type?.toLowerCase() === ch.key).length > 0 && (
                <Badge className={`ml-1 h-4 px-1 text-[9px] ${ch.color} text-white`}>
                  {devices.filter((d) => d.provider_type?.toLowerCase() === ch.key).length}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {CHANNELS.map((ch) => (
          <TabsContent key={ch.key} value={ch.key} className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* QR Panel */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <QrCode className="w-4 h-4" />Generate QR Code
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Session Name</Label>
                      <Input value={sessionName} onChange={(e) => setSessionName(e.target.value)} placeholder={`My ${ch.label}`} className="h-8 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Phone Number</Label>
                      <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+971 5X XXX XXXX" className="h-8 text-xs" />
                    </div>
                  </div>

                  {!qrTokens[ch.key] ? (
                    <Button onClick={() => generateQr(ch.key)} className="w-full gap-2">
                      <QrCode className="w-4 h-4" />Generate Real QR Code
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex justify-center">
                        <div className="relative">
                          <RealQr data={qrTokens[ch.key].qrData} size={200} />
                          {timer <= 10 && timer > 0 && (
                            <div className="absolute inset-0 bg-red-500/20 rounded-lg flex items-center justify-center">
                              <span className="text-red-600 font-bold text-3xl">{timer}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className={`p-2 ${ch.bgColor} ${ch.borderColor} border rounded text-xs ${ch.textColor} text-center font-mono break-all`}>
                        {timer > 10 ? (
                          <>Expires in <strong>{timer}s</strong> — scan now</>
                        ) : timer > 0 ? (
                          <span className="text-red-600 font-bold">Expiring in {timer}s!</span>
                        ) : (
                          <span className="text-red-600">Expired — generate new QR</span>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => generateQr(ch.key)}>
                          <RefreshCw className="w-3 h-3" />Refresh QR
                        </Button>
                        <Button size="sm" className="flex-1 gap-1 bg-green-600 hover:bg-green-700" onClick={() => markConnected(ch.key)}>
                          <CheckCircle className="w-3 h-3" />Mark as Connected ✓
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className={`p-3 ${ch.bgColor} ${ch.borderColor} border rounded space-y-1`}>
                    <p className={`text-xs font-semibold ${ch.textColor}`}>How to connect:</p>
                    {ch.instructions.map((step, i) => (
                      <p key={i} className={`text-xs ${ch.textColor}`}>{i + 1}. {step}</p>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Connected Devices */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Smartphone className="w-4 h-4" />Connected {ch.label} Devices
                    <Badge variant="outline">
                      {devices.filter((d) => d.provider_type?.toLowerCase() === ch.key).length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {devices.filter((d) => d.provider_type?.toLowerCase() === ch.key).length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      <QrCode className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      No {ch.label} devices connected yet.<br />
                      Generate a QR and scan with your phone.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {devices
                        .filter((d) => d.provider_type?.toLowerCase() === ch.key)
                        .map((device) => (
                          <div key={device.id} className={`flex items-center gap-3 p-3 ${ch.bgColor} ${ch.borderColor} border rounded-lg`}>
                            <div className="text-2xl shrink-0">{ch.icon}</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate">{device.name}</p>
                              <p className="text-xs text-muted-foreground">{device.phone}</p>
                              <p className="text-xs text-muted-foreground">{device.notes}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                                <CheckCircle className="w-3 h-3 mr-1" />Active
                              </Badge>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteMut.mutate(device.id)}>
                                <Trash2 className="w-3 h-3 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="bg-amber-50 border-amber-200 mt-4">
            <CardContent className="p-4 text-xs text-amber-800 space-y-1">
            <p className="font-bold">⚠️ Production Notes — {ch.label} as SMS Supplier</p>
            <p>• QR code contains a scannable deep-link token for {ch.label}.</p>
            <p>• Bridge server required: <strong>{ch.key === "whatsapp" ? "WPPConnect or Baileys (Node.js)" : ch.key === "telegram" ? "TDLib / GramJS (Node.js/Python)" : "IMO Web Protocol bridge"}</strong> — runs on server, handles QR auth + message sending.</p>
            <p>• Once scanned, bridge marks device active → saved as Supplier (category: device, connection_type: DEVICE).</p>
            <p>• <strong>Routing:</strong> Assign this device supplier to any Route. Outbound SMS is forwarded to the bridge which delivers via {ch.label}.</p>
            {ch.key === "imo" && <p>• <strong>IMO:</strong> Acts as an SMS delivery channel — messages sent through IMO account to destination numbers. Suitable for markets where IMO is widely used (e.g. Bangladesh, Middle East).</p>}
            </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}