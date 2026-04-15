import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Phone, CheckCircle, XCircle, Clock, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";

const BORNO_API_KEY = "f72c277482bc1ed6bcb991eee";
const BORNO_SEND_URL = "http://202.126.123.156:8097/voice_otp.php";
const BORNO_DLR_URL = "http://202.126.123.156:8097/check_delivery_otp.php";

export default function BornoVoiceOtp() {
  const [msisdn, setMsisdn] = useState("");
  const [otp, setOtp] = useState("202020");
  const [sending, setSending] = useState(false);
  const [checkingDlr, setCheckingDlr] = useState(false);
  const [result, setResult] = useState(null); // send result
  const [dlrResult, setDlrResult] = useState(null);
  const [logs, setLogs] = useState([]);

  const handleSend = async () => {
    if (!msisdn) { toast.error("Please enter a mobile number"); return; }
    setSending(true);
    setDlrResult(null);
    setResult(null);
    const url = `${BORNO_SEND_URL}?apiKey=${BORNO_API_KEY}&msisdn=${msisdn}&code=${otp}`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      setResult(data);
      if (data.status === "success") {
        toast.success("Voice OTP call initiated!");
        setLogs(prev => [{ msisdn, otp, trans_id: data.transaction_id, status: "calling", time: new Date() }, ...prev.slice(0, 49)]);
        // Auto check DLR after 90s
        setTimeout(() => autoCheckDlr(data.transaction_id), 90000);
      } else {
        toast.error(data.message || "Failed to initiate call");
      }
    } catch (e) {
      toast.error("Network error — could not reach Borno API");
      setResult({ status: "error", message: e.message });
    }
    setSending(false);
  };

  const handleCheckDlr = async (transId) => {
    if (!transId) return;
    setCheckingDlr(true);
    const url = `${BORNO_DLR_URL}?apiKey=${BORNO_API_KEY}&trans_id=${transId}`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      setDlrResult(data);
      if (data.status === "success") {
        setLogs(prev => prev.map(l => l.trans_id === transId ? { ...l, status: "delivered", duration: data.duration, call_end: data.call_end } : l));
        toast.success(`Call delivered — ${data.duration}s`);
      } else {
        toast.info(data.message || "Not found yet — DLR takes 60–90 seconds");
      }
    } catch (e) {
      toast.error("Network error checking DLR");
    }
    setCheckingDlr(false);
  };

  const autoCheckDlr = async (transId) => {
    const url = `${BORNO_DLR_URL}?apiKey=${BORNO_API_KEY}&trans_id=${transId}`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === "success") {
        setLogs(prev => prev.map(l => l.trans_id === transId ? { ...l, status: "delivered", duration: data.duration } : l));
      }
    } catch {}
  };

  return (
    <div className="space-y-6">
      {/* Send OTP Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Phone className="w-5 h-5 text-primary" />
            Borno Voice OTP — Send Call
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs font-semibold text-blue-800">API Endpoint</p>
            <p className="font-mono text-xs text-blue-700 mt-1 break-all">{BORNO_SEND_URL}</p>
            <p className="text-xs text-blue-600 mt-1">API Key: <span className="font-mono">{BORNO_API_KEY}</span></p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>MSISDN (Mobile Number) *</Label>
              <Input value={msisdn} onChange={e => setMsisdn(e.target.value)} placeholder="e.g. 01717420387" />
            </div>
            <div className="space-y-1.5">
              <Label>OTP Code *</Label>
              <Input value={otp} onChange={e => setOtp(e.target.value)} placeholder="e.g. 202020" />
            </div>
          </div>

          <Button onClick={handleSend} disabled={sending} className="gap-2">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
            {sending ? "Initiating Call..." : "Send Voice OTP"}
          </Button>

          {/* Send Result */}
          {result && (
            <div className={`p-4 rounded-lg border space-y-2 ${result.status === "success" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
              <div className="flex items-center gap-2">
                {result.status === "success" ? <CheckCircle className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-red-600" />}
                <span className={`font-semibold text-sm ${result.status === "success" ? "text-green-800" : "text-red-800"}`}>
                  {result.message || result.status}
                </span>
              </div>
              {result.transaction_id && (
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Transaction ID</p>
                    <p className="font-mono text-xs font-bold">{result.transaction_id}</p>
                  </div>
                  <Button size="sm" variant="outline" className="gap-1 ml-auto" onClick={() => handleCheckDlr(result.transaction_id)} disabled={checkingDlr}>
                    {checkingDlr ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    Check DLR
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* DLR Result */}
          {dlrResult && (
            <div className={`p-4 rounded-lg border space-y-2 ${dlrResult.status === "success" ? "bg-green-50 border-green-200" : "bg-yellow-50 border-yellow-200"}`}>
              <div className="flex items-center gap-2">
                {dlrResult.status === "success" ? <CheckCircle className="w-4 h-4 text-green-600" /> : <Clock className="w-4 h-4 text-yellow-600" />}
                <span className="font-semibold text-sm">DLR Result</span>
              </div>
              {dlrResult.status === "success" ? (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><p className="text-xs text-muted-foreground">Call End</p><p className="font-mono">{dlrResult.call_end}</p></div>
                  <div><p className="text-xs text-muted-foreground">Duration</p><p className="font-bold">{dlrResult.duration}s</p></div>
                </div>
              ) : (
                <p className="text-sm text-yellow-800">{dlrResult.message} — DLR takes 60–90 seconds</p>
              )}
              <pre className="text-xs bg-muted/60 rounded p-2 overflow-x-auto">{JSON.stringify(dlrResult, null, 2)}</pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Call Logs */}
      {logs.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Recent Calls (Session)</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-3 text-left font-semibold text-xs">MSISDN</th>
                  <th className="p-3 text-left font-semibold text-xs">OTP</th>
                  <th className="p-3 text-left font-semibold text-xs">Transaction ID</th>
                  <th className="p-3 text-left font-semibold text-xs">Status</th>
                  <th className="p-3 text-left font-semibold text-xs">Duration</th>
                  <th className="p-3 text-left font-semibold text-xs">Actions</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr key={i} className="border-t hover:bg-muted/20">
                    <td className="p-3 font-mono">{log.msisdn}</td>
                    <td className="p-3 font-mono font-bold">{log.otp}</td>
                    <td className="p-3 font-mono text-xs">{log.trans_id}</td>
                    <td className="p-3">
                      <Badge variant="outline" className={
                        log.status === "delivered" ? "bg-green-50 text-green-700 border-green-200" :
                        log.status === "calling" ? "bg-blue-50 text-blue-700 border-blue-200" :
                        "bg-gray-100 text-gray-600"
                      }>
                        {log.status}
                      </Badge>
                    </td>
                    <td className="p-3">{log.duration ? `${log.duration}s` : '—'}</td>
                    <td className="p-3">
                      <Button size="sm" variant="ghost" className="gap-1 h-7" onClick={() => handleCheckDlr(log.trans_id)} disabled={checkingDlr}>
                        <RefreshCw className="w-3 h-3" />DLR
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}