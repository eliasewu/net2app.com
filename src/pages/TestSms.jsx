import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Zap, Send, Loader2, CheckCircle, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";

const POLL_INTERVAL_MS = 4000;
const TIMEOUT_MS = 5 * 60 * 1000;
const FINAL_STATUSES = ["delivered", "failed", "rejected", "blocked", "undelivered"];

function DlrStatusIcon({ status }) {
  if (status === "delivered") return <CheckCircle className="w-4 h-4 text-green-500" />;
  if (["failed", "rejected", "undelivered"].includes(status)) return <XCircle className="w-4 h-4 text-red-500" />;
  return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
}

function useSmsDlrPoller(logId, enabled, onFinal) {
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const [status, setStatus] = useState("sent");
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!enabled || !logId) return;
    startTimeRef.current = Date.now();

    const poll = async () => {
      const elapsedMs = Date.now() - startTimeRef.current;
      setElapsed(Math.floor(elapsedMs / 1000));

      if (elapsedMs >= TIMEOUT_MS) {
        clearInterval(timerRef.current);
        await base44.entities.SmsLog.update(logId, { status: "undelivered", fail_reason: "DLR timeout after 5 minutes" });
        setStatus("undelivered");
        onFinal("undelivered");
        return;
      }

      try {
        const logs = await base44.entities.SmsLog.filter({ id: logId });
        const log = logs[0];
        if (!log) return;
        setStatus(log.status);
        if (FINAL_STATUSES.includes(log.status)) {
          clearInterval(timerRef.current);
          onFinal(log.status);
        }
      } catch (_) {}
    };

    poll();
    timerRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(timerRef.current);
  }, [logId, enabled]);

  return { status, elapsed };
}

function ResultCard({ result, onStatusUpdate }) {
  const isFinal = useRef(false);
  const [finalStatus, setFinalStatus] = useState(
    FINAL_STATUSES.includes(result.status) ? result.status : null
  );

  const handleFinal = (s) => {
    if (isFinal.current) return;
    isFinal.current = true;
    setFinalStatus(s);
    onStatusUpdate(result.id, s);
  };

  const { status, elapsed } = useSmsDlrPoller(
    result.id,
    !finalStatus,
    handleFinal
  );

  const displayStatus = finalStatus || status;
  const polling = !finalStatus;

  return (
    <div className="p-3 rounded-lg bg-muted/50 border space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm font-semibold">{result.destination}</span>
        <div className="flex items-center gap-2">
          <DlrStatusIcon status={displayStatus} />
          <StatusBadge status={displayStatus} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground truncate">{result.content}</p>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>ID: <span className="font-mono">{result.message_id}</span></span>
        <span>{result.time}</span>
      </div>
      {polling && (
        <div className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded px-2 py-1">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Polling DLR every 4s… {elapsed}s / 300s</span>
          <div className="ml-auto flex-1 bg-blue-200 rounded-full h-1.5 max-w-[80px]">
            <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${Math.min((elapsed / 300) * 100, 100)}%` }} />
          </div>
        </div>
      )}
      {displayStatus === "undelivered" && (
        <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
          <XCircle className="w-3 h-3" />No DLR received within 5 minutes — marked as Undelivered
        </div>
      )}
      {displayStatus === "delivered" && (
        <div className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 border border-green-200 rounded px-2 py-1">
          <CheckCircle className="w-3 h-3" />DLR confirmed — Delivered
        </div>
      )}
      {(displayStatus === "failed" || displayStatus === "rejected") && (
        <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
          <XCircle className="w-3 h-3" />DLR confirmed — {displayStatus}
        </div>
      )}
    </div>
  );
}

export default function TestSms() {
  const [form, setForm] = useState({ destination: '', sender_id: 'TEST', content: 'Test message from SMS Gateway', route_id: '', client_id: '' });
  const [results, setResults] = useState([]);
  const qc = useQueryClient();

  const { data: routes = [] } = useQuery({ queryKey: ['routes'], queryFn: () => base44.entities.Route.list(), initialData: [] });
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list(), initialData: [] });

  const sendMut = useMutation({
    mutationFn: async (d) => {
      const route = routes.find(r => r.id === d.route_id);
      const client = clients.find(c => c.id === d.client_id);
      const msgId = `TEST-${Date.now().toString(36)}`;
      return await base44.entities.SmsLog.create({
        message_id: msgId,
        client_id: d.client_id,
        client_name: client?.name || 'Test',
        supplier_id: route?.supplier_id || '',
        supplier_name: route?.supplier_name || '',
        route_id: d.route_id,
        sender_id: d.sender_id,
        destination: d.destination,
        content: d.content,
        status: 'sent',
        sms_type: 'transactional',
        mcc: route?.mcc || '',
        mnc: route?.mnc || '',
        country: route?.country || '',
      });
    },
    onSuccess: (result) => {
      setResults(prev => [{ ...result, time: new Date().toLocaleTimeString() }, ...prev]);
      toast.success("Test SMS sent — polling DLR every 4s");
      qc.invalidateQueries({ queryKey: ['sms-logs'] });
    },
  });

  const handleStatusUpdate = (id, status) => {
    setResults(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    if (status === "delivered") toast.success("DLR: Delivered ✓");
    else if (status === "failed" || status === "rejected") toast.error(`DLR: ${status}`);
    else if (status === "undelivered") toast.warning("DLR timeout — Undelivered");
  };

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-6">
      <PageHeader title="Test SMS" description="Send test messages and auto-poll DLR every 4s (stops on delivered/failed or after 5min)" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Zap className="w-4 h-4" />Send Test Message
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Client</Label>
              <Select value={form.client_id} onValueChange={(v) => set('client_id', v)}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Route</Label>
              <Select value={form.route_id} onValueChange={(v) => set('route_id', v)}>
                <SelectTrigger><SelectValue placeholder="Select route" /></SelectTrigger>
                <SelectContent>{routes.map(r => <SelectItem key={r.id} value={r.id}>{r.name} ({r.supplier_name})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Destination Number</Label>
              <Input value={form.destination} onChange={(e) => set('destination', e.target.value)} placeholder="+1234567890" />
            </div>
            <div className="space-y-2">
              <Label>Sender ID</Label>
              <Input value={form.sender_id} onChange={(e) => set('sender_id', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Content</Label>
              <Textarea value={form.content} onChange={(e) => set('content', e.target.value)} rows={3} />
            </div>
            <Button className="w-full" onClick={() => sendMut.mutate(form)} disabled={sendMut.isPending}>
              {sendMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Send Test SMS
            </Button>
            <div className="p-2 bg-muted/50 rounded text-xs text-muted-foreground space-y-0.5">
              <div className="flex items-center gap-1"><Clock className="w-3 h-3" /><span>Polls DLR every <strong>4 seconds</strong></span></div>
              <div className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-500" /><span>Stops on <strong>delivered</strong> or <strong>failed</strong></span></div>
              <div className="flex items-center gap-1"><XCircle className="w-3 h-3 text-red-500" /><span>Marks <strong>undelivered</strong> after 5 minutes</span></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4" />Test Results
              {results.length > 0 && <span className="ml-auto text-xs font-normal text-muted-foreground">{results.length} sent</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {results.map((r) => (
                <ResultCard key={r.id} result={r} onStatusUpdate={handleStatusUpdate} />
              ))}
              {results.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-8">Send a test message to see results</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}