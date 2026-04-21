import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RefreshCw, Smartphone, CheckCircle, XCircle, Wifi, QrCode, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

// Simulated QR code image using a canvas-based generator
function QrDisplay({ value, size = 200 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    canvas.width = size;
    canvas.height = size;

    // Draw placeholder QR pattern (grid-based visual)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);

    const cellSize = size / 25;
    ctx.fillStyle = "#000000";

    // Use value as seed for deterministic pattern
    const seed = value.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const rng = (i) => ((seed * 9301 + i * 49297) % 233280) / 233280;

    for (let row = 0; row < 25; row++) {
      for (let col = 0; col < 25; col++) {
        // Corner finder patterns
        const isCornerFinder =
          (row < 7 && col < 7) ||
          (row < 7 && col > 17) ||
          (row > 17 && col < 7);
        if (isCornerFinder) {
          const r = row % 7, c = col % 7;
          const isEdge = r === 0 || r === 6 || c === 0 || c === 6;
          const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          if (isEdge || isInner) ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
          continue;
        }
        if (rng(row * 25 + col) > 0.5) {
          ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
        }
      }
    }
    // White border inside corner finders
    ctx.fillStyle = "#ffffff";
    [[0,0],[0,18],[18,0]].forEach(([r,c]) => {
      ctx.fillRect((c+1)*cellSize, (r+1)*cellSize, 5*cellSize, 5*cellSize);
    });
    ctx.fillStyle = "#000000";
    [[0,0],[0,18],[18,0]].forEach(([r,c]) => {
      ctx.fillRect((c+2)*cellSize, (r+2)*cellSize, 3*cellSize, 3*cellSize);
    });
  }, [value, size]);

  return <canvas ref={canvasRef} className="rounded-lg border border-border" />;
}

const CHANNELS = [
  {
    key: "whatsapp",
    label: "WhatsApp",
    color: "bg-green-500",
    textColor: "text-green-700",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    icon: "💬",
    instructions: [
      "Open WhatsApp on your phone",
      "Tap Menu (⋮) → Linked Devices",
      "Tap 'Link a Device'",
      "Scan the QR code below",
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
    instructions: [
      "Open Telegram on your phone",
      "Go to Settings → Devices",
      "Tap 'Link Desktop Device'",
      "Scan the QR code below",
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
    instructions: [
      "Open IMO on your phone",
      "Go to Settings → Linked Accounts",
      "Tap 'Add Web/Desktop Device'",
      "Scan the QR code below",
    ],
    expiry: 90,
  },
];

export default function DeviceConnect() {
  const [tab, setTab] = useState("whatsapp");
  const [devices, setDevices] = useState(() => {
    try { return JSON.parse(localStorage.getItem("connected_devices") || "[]"); } catch { return []; }
  });
  const [qrTokens, setQrTokens] = useState({});
  const [timers, setTimers] = useState({});
  const [sessionName, setSessionName] = useState("");

  const saveDevices = (d) => {
    setDevices(d);
    localStorage.setItem("connected_devices", JSON.stringify(d));
  };

  const generateQr = (channelKey) => {
    const token = `${channelKey}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    setQrTokens(p => ({ ...p, [channelKey]: { token, generated: Date.now() } }));
    // Countdown timer
    const ch = CHANNELS.find(c => c.key === channelKey);
    let remaining = ch.expiry;
    const interval = setInterval(() => {
      remaining--;
      setTimers(p => ({ ...p, [channelKey]: remaining }));
      if (remaining <= 0) {
        clearInterval(interval);
        setQrTokens(p => ({ ...p, [channelKey]: null }));
        setTimers(p => ({ ...p, [channelKey]: 0 }));
      }
    }, 1000);
    setTimers(p => ({ ...p, [channelKey]: ch.expiry }));
    toast.info(`QR code generated — scan within ${ch.expiry} seconds`);
  };

  const simulateConnect = (channelKey) => {
    // Simulate a successful scan (in real integration, this comes from the WA/TG API webhook)
    const name = sessionName || `${channelKey}_session_${Date.now()}`;
    const newDevice = {
      id: `${channelKey}_${Date.now()}`,
      channel: channelKey,
      name,
      phone: "+880 1XXX-XXXXXX",
      connectedAt: new Date().toISOString(),
      status: "connected",
    };
    saveDevices([...devices, newDevice]);
    setQrTokens(p => ({ ...p, [channelKey]: null }));
    setSessionName("");
    toast.success(`${channelKey} device connected: ${name}`);
  };

  const disconnectDevice = (id) => {
    saveDevices(devices.filter(d => d.id !== id));
    toast.success("Device disconnected");
  };

  const channel = CHANNELS.find(c => c.key === tab);
  const channelDevices = devices.filter(d => d.channel === tab);
  const qr = qrTokens[tab];
  const timer = timers[tab] || 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Device Connect — QR Code" description="Connect WhatsApp, Telegram & IMO via QR scan (no API integration needed)">
        <Badge variant="outline" className="gap-1">
          <Wifi className="w-3 h-3" />{devices.length} device{devices.length !== 1 ? "s" : ""} connected
        </Badge>
      </PageHeader>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          {CHANNELS.map(ch => (
            <TabsTrigger key={ch.key} value={ch.key} className="gap-1">
              <span>{ch.icon}</span>{ch.label}
              {devices.filter(d => d.channel === ch.key).length > 0 && (
                <Badge className={`ml-1 h-4 px-1 text-[9px] ${ch.color} text-white`}>
                  {devices.filter(d => d.channel === ch.key).length}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {CHANNELS.map(ch => (
          <TabsContent key={ch.key} value={ch.key} className="mt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* QR Code Panel */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <QrCode className="w-4 h-4" />Generate QR Code
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Session Name (optional)</Label>
                    <Input
                      value={sessionName}
                      onChange={e => setSessionName(e.target.value)}
                      placeholder={`e.g. My ${ch.label} Account`}
                    />
                  </div>

                  {!qrTokens[ch.key] ? (
                    <Button onClick={() => generateQr(ch.key)} className="w-full gap-2">
                      <QrCode className="w-4 h-4" />Generate QR Code
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex justify-center">
                        <div className="relative">
                          <QrDisplay value={qrTokens[ch.key].token} size={200} />
                          {timer <= 10 && timer > 0 && (
                            <div className="absolute inset-0 bg-red-500/10 rounded-lg flex items-center justify-center">
                              <span className="text-red-600 font-bold text-2xl">{timer}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className={`p-2 ${ch.bgColor} ${ch.borderColor} border rounded text-xs ${ch.textColor} text-center`}>
                        {timer > 10 ? (
                          <>QR expires in <strong>{timer}s</strong> — scan now</>
                        ) : timer > 0 ? (
                          <span className="text-red-600 font-bold">Expiring in {timer}s! Refresh if needed.</span>
                        ) : (
                          <span className="text-red-600">Expired — generate a new QR code</span>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => generateQr(ch.key)}>
                          <RefreshCw className="w-3 h-3" />Refresh QR
                        </Button>
                        {/* Simulate connect button for demo — in production this is triggered by webhook */}
                        <Button size="sm" className="flex-1 gap-1 bg-green-600 hover:bg-green-700" onClick={() => simulateConnect(ch.key)}>
                          <CheckCircle className="w-3 h-3" />Simulate Scan ✓
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Instructions */}
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
                    <Badge variant="outline">{channelDevices.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {channelDevices.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      <QrCode className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      No {ch.label} devices connected yet.<br />Generate a QR code and scan it with your phone.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {channelDevices.map(device => (
                        <div key={device.id} className={`flex items-center gap-3 p-3 ${ch.bgColor} ${ch.borderColor} border rounded-lg`}>
                          <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {ch.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{device.name}</p>
                            <p className="text-xs text-muted-foreground">{device.phone}</p>
                            <p className="text-xs text-muted-foreground">
                              Connected {new Date(device.connectedAt).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                              <CheckCircle className="w-3 h-3 mr-1" />Active
                            </Badge>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => disconnectDevice(device.id)}>
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

            {/* Info box */}
            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="p-4 text-xs text-amber-800 space-y-1">
                <p className="font-bold">⚠️ Important — Device Connect Mode:</p>
                <p>• This connects YOUR personal {ch.label} account (not a business API). No API key or subscription needed.</p>
                <p>• Messages are sent through your phone just like using {ch.label} Web on a browser.</p>
                <p>• Keep your phone online and connected to internet for sessions to stay active.</p>
                <p>• In production, integrate with <strong>WPPConnect / Baileys</strong> (WhatsApp), <strong>TDLib / GramJS</strong> (Telegram), or <strong>IMO Web protocol</strong> for the actual QR handshake.</p>
                <p>• "Simulate Scan ✓" is a demo button — in real deployment, replace with webhook callback from your local WA/TG session server.</p>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}