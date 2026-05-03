import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Wallet, MessageSquare, Wifi, Plus, Loader2, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const STATUS_COLORS = {
  active: "bg-green-100 text-green-700 border-green-200",
  inactive: "bg-gray-100 text-gray-600 border-gray-200",
  maintenance: "bg-yellow-100 text-yellow-700 border-yellow-200",
  submitted: "bg-blue-100 text-blue-700 border-blue-200",
  delivered: "bg-green-100 text-green-700 border-green-200",
  failed: "bg-red-100 text-red-700 border-red-200",
};

const emptyGateway = { name: "", protocol: "smpp", host: "", port: 2775, status: "active", tenantId: "default" };

export default function TenantDashboard() {
  const [gwOpen, setGwOpen] = useState(false);
  const [gwForm, setGwForm] = useState(emptyGateway);
  const qc = useQueryClient();

  const { data: gateways = [], isLoading: loadingGW } = useQuery({
    queryKey: ["gateways"],
    queryFn: () => base44.entities.Gateway.list("-created_date"),
    initialData: [],
  });

  const { data: cdrLogs = [], isLoading: loadingCDR } = useQuery({
    queryKey: ["cdr_logs"],
    queryFn: () => base44.entities.CdrLog.list("-created_date", 50),
    initialData: [],
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => base44.entities.Client.list(),
    initialData: [],
  });

  const createGwMut = useMutation({
    mutationFn: (data) => base44.entities.Gateway.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gateways"] });
      setGwOpen(false);
      setGwForm(emptyGateway);
      toast.success("Gateway added successfully");
    },
  });

  // Derived metrics
  const totalBalance = clients.reduce((sum, c) => sum + (c.balance || 0), 0);
  const totalSms = cdrLogs.length;
  const activeGateways = gateways.filter((g) => g.status === "active").length;

  const set = (k, v) => setGwForm((p) => ({ ...p, [k]: v }));

  const handleAddGateway = () => {
    if (!gwForm.name || !gwForm.host || !gwForm.port) {
      toast.error("Name, host, and port are required");
      return;
    }
    createGwMut.mutate(gwForm);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tenant Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Real-time gateway, CDR, and billing overview</p>
        </div>
        <Button onClick={() => setGwOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />Add Gateway
        </Button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-green-100">
              <Wallet className="w-5 h-5 text-green-700" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Balance</p>
              <p className="text-2xl font-bold">
                ${totalBalance.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">across {clients.length} clients</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-100">
              <MessageSquare className="w-5 h-5 text-blue-700" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total SMS Logged</p>
              <p className="text-2xl font-bold">{totalSms.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">last 50 entries</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-purple-100">
              <Wifi className="w-5 h-5 text-purple-700" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Active Gateways</p>
              <p className="text-2xl font-bold">{activeGateways}</p>
              <p className="text-xs text-muted-foreground">of {gateways.length} total</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gateways Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Wifi className="w-4 h-4 text-purple-600" />
            Gateways
            <Badge variant="outline">{gateways.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Protocol</TableHead>
                <TableHead>Host</TableHead>
                <TableHead>Port</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingGW ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></TableCell></TableRow>
              ) : gateways.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">No gateways yet — click "Add Gateway"</TableCell></TableRow>
              ) : gateways.map((gw) => (
                <TableRow key={gw.id}>
                  <TableCell className="font-medium">{gw.name}</TableCell>
                  <TableCell><span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{gw.protocol}</span></TableCell>
                  <TableCell className="font-mono text-sm">{gw.host}</TableCell>
                  <TableCell className="font-mono text-sm">{gw.port}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{gw.tenantId || "default"}</TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${STATUS_COLORS[gw.status] || ""}`}>
                      {gw.status}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* CDR Logs Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-blue-600" />
            CDR Message Logs
            <Badge variant="outline">{cdrLogs.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dir</TableHead>
                <TableHead>Sender</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Units</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingCDR ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></TableCell></TableRow>
              ) : cdrLogs.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">No CDR logs yet</TableCell></TableRow>
              ) : cdrLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    {log.direction === "inbound"
                      ? <ArrowDownLeft className="w-4 h-4 text-blue-500" />
                      : <ArrowUpRight className="w-4 h-4 text-green-500" />}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{log.sender || "—"}</TableCell>
                  <TableCell className="font-mono text-sm">{log.recipient}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">{log.message || "—"}</TableCell>
                  <TableCell>{log.units ?? 1}</TableCell>
                  <TableCell className="font-mono text-sm">${(log.cost || 0).toFixed(4)}</TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${STATUS_COLORS[log.status] || ""}`}>
                      {log.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {log.created_date ? format(new Date(log.created_date), "MM/dd HH:mm") : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Gateway Dialog */}
      <Dialog open={gwOpen} onOpenChange={setGwOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Gateway</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-1.5">
              <Label>Gateway Name *</Label>
              <Input value={gwForm.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Primary SMPP" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Protocol</Label>
                <Select value={gwForm.protocol} onValueChange={(v) => set("protocol", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="smpp">SMPP</SelectItem>
                    <SelectItem value="sip">SIP</SelectItem>
                    <SelectItem value="http_api">HTTP API</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={gwForm.status} onValueChange={(v) => set("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Host *</Label>
                <Input value={gwForm.host} onChange={(e) => set("host", e.target.value)} placeholder="192.168.1.1" />
              </div>
              <div className="space-y-1.5">
                <Label>Port *</Label>
                <Input type="number" value={gwForm.port} onChange={(e) => set("port", Number(e.target.value))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Tenant ID</Label>
              <Input value={gwForm.tenantId} onChange={(e) => set("tenantId", e.target.value)} placeholder="default" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGwOpen(false)}>Cancel</Button>
            <Button onClick={handleAddGateway} disabled={createGwMut.isPending}>
              {createGwMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add Gateway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}