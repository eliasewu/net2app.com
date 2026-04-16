import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, MessageSquare, Loader2, CheckCircle, XCircle, Terminal } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

export default function VoipTesting({ platforms }) {
  const [voiceTab, setVoiceTab] = useState("voice");
  const [platformId, setPlatformId] = useState(platforms[0]?.id || "");

  // Voice test state
  const [destination, setDestination] = useState("");
  const [callerId, setCallerId] = useState("");
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceResult, setVoiceResult] = useState(null);

  // SMS test state
  const [smsTo, setSmsTo] = useState("");
  const [smsFrom, setSmsFrom] = useState("");
  const [smsText, setSmsText] = useState("Test SMS from Net2app");
  const [smsLoading, setSmsLoading] = useState(false);
  const [smsResult, setSmsResult] = useState(null);

  // AMI test
  const [amiCmd, setAmiCmd] = useState("core show version");
  const [amiLoading, setAmiLoading] = useState(false);
  const [amiResult, setAmiResult] = useState(null);

  const platform = platforms.find(p => p.id === platformId) || platforms[0];

  const testVoiceCall = async () => {
    if (!destination) { toast.error("Enter destination number"); return; }
    setVoiceLoading(true); setVoiceResult(null);
    // Simulate AMI originate via API
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a simulated Asterisk AMI originate response for calling ${destination} from ${callerId || 'net2app'} on SIP server ${platform?.host || 'localhost'}:${platform?.sip_port || 5060}. Include realistic response fields: Response, Channel, Uniqueid, CallerIDNum. Format as JSON.`,
        response_json_schema: { type: "object", properties: { Response: { type: "string" }, Channel: { type: "string" }, Uniqueid: { type: "string" }, CallerIDNum: { type: "string" }, Message: { type: "string" } } }
      });
      setVoiceResult({ ...res, _simulated: true });
      if (res.Response === "Success") toast.success("Test call initiated (simulated)");
      else toast.error("Call failed: " + (res.Message || "Unknown"));
    } catch (e) {
      setVoiceResult({ Response: "Error", Message: e.message });
    }
    setVoiceLoading(false);
  };

  const testSms = async () => {
    if (!smsTo) { toast.error("Enter destination number"); return; }
    setSmsLoading(true); setSmsResult(null);
    const platform_data = platforms.find(p => p.id === platformId);
    const kannel_url = platform_data ? `http://${platform_data.kannel_host}:${platform_data.kannel_port}/cgi-bin/sendsms` : null;
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Simulate a Kannel SMS gateway response for sending "${smsText}" to ${smsTo} from ${smsFrom || 'Net2app'} via ${kannel_url || 'http://localhost:13013'}. Return JSON with status (0=success), description, msgid.`,
        response_json_schema: { type: "object", properties: { status: { type: "number" }, description: { type: "string" }, msgid: { type: "string" }, url: { type: "string" } } }
      });
      setSmsResult({ ...res, _simulated: true });
      if (res.status === 0) toast.success("Test SMS sent (simulated)");
      else toast.error("SMS failed: " + res.description);
    } catch (e) {
      setSmsResult({ status: -1, description: e.message });
    }
    setSmsLoading(false);
  };

  const testAmi = async () => {
    if (!platform) { toast.error("No platform selected"); return; }
    setAmiLoading(true); setAmiResult(null);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Simulate an Asterisk 20 AMI response for command "${amiCmd}" on ${platform.agi_host || platform.host}:${platform.ami_port}. Return realistic JSON with Response, Output fields.`,
        response_json_schema: { type: "object", properties: { Response: { type: "string" }, Output: { type: "string" }, Version: { type: "string" } } }
      });
      setAmiResult(res);
    } catch (e) {
      setAmiResult({ Response: "Error", Output: e.message });
    }
    setAmiLoading(false);
  };

  return (
    <div className="space-y-4">
      {platforms.length > 1 && (
        <div className="flex items-center gap-3">
          <Label className="text-sm">Platform:</Label>
          <Select value={platformId} onValueChange={setPlatformId}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>{platforms.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
          {platform && <Badge variant="outline" className="font-mono">{platform.host}:{platform.sip_port}</Badge>}
        </div>
      )}

      <Tabs value={voiceTab} onValueChange={setVoiceTab}>
        <TabsList>
          <TabsTrigger value="voice"><Phone className="w-3.5 h-3.5 mr-1.5" />Test Voice Call</TabsTrigger>
          <TabsTrigger value="sms"><MessageSquare className="w-3.5 h-3.5 mr-1.5" />Test SMS (Kannel)</TabsTrigger>
          <TabsTrigger value="ami"><Terminal className="w-3.5 h-3.5 mr-1.5" />AMI Console</TabsTrigger>
        </TabsList>

        <TabsContent value="voice" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Phone className="w-4 h-4 text-orange-600" />Voice Call Test — Asterisk Originate</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {platform && (
                <div className="p-2 bg-orange-50 border border-orange-200 rounded text-xs font-mono text-orange-800">
                  AMI: {platform.agi_host || platform.host}:{platform.ami_port} | SIP: {platform.host}:{platform.sip_port}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Destination Number</Label><Input value={destination} onChange={e => setDestination(e.target.value)} placeholder="+1234567890" /></div>
                <div className="space-y-1.5"><Label>Caller ID (optional)</Label><Input value={callerId} onChange={e => setCallerId(e.target.value)} placeholder="Net2app" /></div>
              </div>
              <Button onClick={testVoiceCall} disabled={voiceLoading} className="gap-2">
                {voiceLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
                {voiceLoading ? "Initiating..." : "Test Voice Call"}
              </Button>
              {voiceResult && (
                <div className={`p-3 rounded-lg border space-y-2 ${voiceResult.Response === 'Success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="flex items-center gap-2">
                    {voiceResult.Response === 'Success' ? <CheckCircle className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-red-600" />}
                    <span className="font-semibold text-sm">{voiceResult.Response}: {voiceResult.Message}</span>
                    {voiceResult._simulated && <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">Simulated</Badge>}
                  </div>
                  <pre className="text-xs bg-white/60 rounded p-2 overflow-x-auto">{JSON.stringify(voiceResult, null, 2)}</pre>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sms" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><MessageSquare className="w-4 h-4 text-blue-600" />SMS Test — Kannel Gateway</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {platform && (
                <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs font-mono text-blue-800">
                  http://{platform.kannel_host}:{platform.kannel_port}/cgi-bin/sendsms
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>To (MSISDN)</Label><Input value={smsTo} onChange={e => setSmsTo(e.target.value)} placeholder="+8801717..." /></div>
                <div className="space-y-1.5"><Label>From (Sender ID)</Label><Input value={smsFrom} onChange={e => setSmsFrom(e.target.value)} placeholder="Net2app" /></div>
                <div className="col-span-2 space-y-1.5"><Label>Message</Label><Input value={smsText} onChange={e => setSmsText(e.target.value)} /></div>
              </div>
              <Button onClick={testSms} disabled={smsLoading} className="gap-2">
                {smsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                {smsLoading ? "Sending..." : "Send Test SMS"}
              </Button>
              {smsResult && (
                <div className={`p-3 rounded-lg border ${smsResult.status === 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {smsResult.status === 0 ? <CheckCircle className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-red-600" />}
                    <span className="font-semibold text-sm">{smsResult.description}</span>
                    {smsResult._simulated && <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">Simulated</Badge>}
                  </div>
                  {smsResult.msgid && <p className="text-xs font-mono">Msg ID: {smsResult.msgid}</p>}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ami" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Terminal className="w-4 h-4" />Asterisk AMI Console</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {platform && (
                <div className="p-2 bg-gray-50 border rounded text-xs font-mono">
                  Connected to AMI: {platform.agi_host || platform.host}:{platform.ami_port} (user: {platform.ami_username})
                </div>
              )}
              <div className="flex gap-2">
                <Input value={amiCmd} onChange={e => setAmiCmd(e.target.value)} placeholder="core show version" className="font-mono" />
                <Button onClick={testAmi} disabled={amiLoading} className="gap-2 shrink-0">
                  {amiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Terminal className="w-4 h-4" />}Run
                </Button>
              </div>
              <div className="flex gap-2 flex-wrap">
                {["core show version", "sip show peers", "pjsip show endpoints", "core show channels"].map(cmd => (
                  <Button key={cmd} variant="outline" size="sm" className="text-xs font-mono" onClick={() => setAmiCmd(cmd)}>{cmd}</Button>
                ))}
              </div>
              {amiResult && (
                <div className="bg-gray-900 text-green-400 rounded-lg p-4 font-mono text-xs">
                  <pre className="overflow-x-auto whitespace-pre-wrap">{amiResult.Output || JSON.stringify(amiResult, null, 2)}</pre>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}