import { useState } from "react";
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
import { Zap, Send } from "lucide-react";
import { toast } from "sonner";

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
      const result = await base44.entities.SmsLog.create({
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
      return result;
    },
    onSuccess: (result) => {
      setResults(prev => [{ ...result, time: new Date().toLocaleTimeString() }, ...prev]);
      toast.success("Test SMS sent");
      qc.invalidateQueries({ queryKey: ['sms-logs'] });
    },
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-6">
      <PageHeader title="Test SMS" description="Send test messages through routes and channels" />

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
              <Send className="w-4 h-4 mr-2" />Send Test SMS
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {results.map((r, i) => (
                <div key={i} className="p-3 rounded-lg bg-muted/50 border">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-sm">{r.destination}</span>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">ID: {r.message_id} • {r.time}</p>
                  <p className="text-sm mt-1 truncate">{r.content}</p>
                </div>
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