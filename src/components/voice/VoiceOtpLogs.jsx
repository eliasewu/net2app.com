import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import StatusBadge from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Phone } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function VoiceOtpLogs() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ client_id: "", destination: "", otp_code: "", otp_type: "numeric", max_retries: 2, supplier_id: "" });
  const qc = useQueryClient();

  const { data: otps = [] } = useQuery({ queryKey: ["voice-otps"], queryFn: () => base44.entities.VoiceOtp.list("-created_date", 100), initialData: [] });
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: () => base44.entities.Client.list(), initialData: [] });
  const { data: voiceSuppliers = [] } = useQuery({ queryKey: ["voice-suppliers"], queryFn: () => base44.entities.VoiceSupplier.list(), initialData: [] });

  const createMut = useMutation({
    mutationFn: (d) => {
      const client = clients.find(c => c.id === d.client_id);
      const supplier = voiceSuppliers.find(s => s.id === d.supplier_id);
      return base44.entities.VoiceOtp.create({ ...d, client_name: client?.name || "", supplier_name: supplier?.name || "", status: "pending" });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["voice-otps"] }); setDialogOpen(false); toast.success("Voice OTP initiated"); },
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4 mr-2" />New Voice OTP</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>OTP Code</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Retries</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {otps.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="text-xs">{format(new Date(o.created_date), "MMM d HH:mm")}</TableCell>
                  <TableCell>{o.client_name}</TableCell>
                  <TableCell className="font-mono">{o.destination}</TableCell>
                  <TableCell className="font-mono font-bold">{o.otp_code}</TableCell>
                  <TableCell className="capitalize">{o.otp_type}</TableCell>
                  <TableCell className="text-sm">{o.supplier_name || "—"}</TableCell>
                  <TableCell>{o.retry_count}/{o.max_retries}</TableCell>
                  <TableCell>{o.duration ? `${o.duration}s` : "—"}</TableCell>
                  <TableCell><StatusBadge status={o.status} /></TableCell>
                </TableRow>
              ))}
              {otps.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-12">No voice OTP records</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Send Voice OTP</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Client</Label>
              <Select value={form.client_id} onValueChange={v => set("client_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Voice Supplier</Label>
              <Select value={form.supplier_id} onValueChange={v => set("supplier_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select voice supplier" /></SelectTrigger>
                <SelectContent>{voiceSuppliers.filter(s => s.status === "active").map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.country || "Global"})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Destination Number</Label><Input value={form.destination} onChange={e => set("destination", e.target.value)} placeholder="+1234567890" /></div>
            <div className="space-y-1"><Label>OTP Code</Label><Input value={form.otp_code} onChange={e => set("otp_code", e.target.value)} placeholder="123456" /></div>
            <div className="space-y-1">
              <Label>OTP Type</Label>
              <Select value={form.otp_type} onValueChange={v => set("otp_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="numeric">Numeric</SelectItem><SelectItem value="alpha">Alpha</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Max Retries</Label><Input type="number" value={form.max_retries} onChange={e => set("max_retries", Number(e.target.value))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => createMut.mutate(form)}><Phone className="w-4 h-4 mr-2" />Send OTP</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}