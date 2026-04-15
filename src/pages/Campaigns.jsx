import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import CampaignHistory from "@/components/campaigns/CampaignHistory";
import ChannelSupplierManager from "@/components/campaigns/ChannelSupplierManager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Plus, Upload, Send, Clock, MessageSquare, Phone, Zap, Play, Pause, Settings } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const CHANNEL_ICONS = { sms: MessageSquare, whatsapp: Phone, telegram: Send, viber: Zap, imo: Phone };
const CHANNEL_COLORS = {
  sms: "bg-blue-50 text-blue-700 border-blue-200",
  whatsapp: "bg-green-50 text-green-700 border-green-200",
  telegram: "bg-sky-50 text-sky-700 border-sky-200",
  viber: "bg-purple-50 text-purple-700 border-purple-200",
  imo: "bg-orange-50 text-orange-700 border-orange-200",
};

export default function Campaigns() {
  const [tab, setTab] = useState("campaigns");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [step, setStep] = useState(1); // 1: setup, 2: numbers, 3: schedule
  const [form, setForm] = useState({ name: "", channel: "sms", client_id: "", supplier_id: "", sender_id: "", template_content: "", tps_limit: 10, campaign_type: "immediate", scheduled_at: "" });
  const [numbers, setNumbers] = useState([]);
  const [csvUploading, setCsvUploading] = useState(false);
  const fileRef = useRef();
  const qc = useQueryClient();

  const { data: campaigns = [] } = useQuery({ queryKey: ["campaigns"], queryFn: () => base44.entities.Campaign.list("-created_date", 50), initialData: [] });
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: () => base44.entities.Client.list(), initialData: [] });
  const { data: channelSuppliers = [] } = useQuery({ queryKey: ["channel-suppliers"], queryFn: () => base44.entities.ChannelSupplier.list(), initialData: [] });

  const createMut = useMutation({
    mutationFn: async (d) => {
      const client = clients.find(c => c.id === d.client_id);
      const supplier = channelSuppliers.find(s => s.id === d.supplier_id);
      return base44.entities.Campaign.create({
        ...d, client_name: client?.name || "", supplier_name: supplier?.name || "",
        total_numbers: numbers.length, status: d.campaign_type === "scheduled" ? "scheduled" : "draft"
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["campaigns"] }); setDialogOpen(false); resetForm(); toast.success("Campaign created!"); }
  });

  const updateMut = useMutation({ mutationFn: ({ id, data }) => base44.entities.Campaign.update(id, data), onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] }) });

  const resetForm = () => { setForm({ name: "", channel: "sms", client_id: "", supplier_id: "", sender_id: "", template_content: "", tps_limit: 10, campaign_type: "immediate", scheduled_at: "" }); setNumbers([]); setStep(1); };

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleCsvUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCsvUploading(true);
    const text = await file.text();
    const lines = text.trim().split("\n").slice(1); // skip header
    const nums = lines.map(l => l.split(",")[0]?.trim()).filter(Boolean);
    setNumbers(nums);
    setCsvUploading(false);
    toast.success(`Loaded ${nums.length} numbers from CSV`);
    e.target.value = "";
  };

  const launchCampaign = async (campaign) => {
    await base44.entities.Campaign.update(campaign.id, { status: "running", started_at: new Date().toISOString() });
    qc.invalidateQueries({ queryKey: ["campaigns"] });
    toast.success("Campaign launched!");
  };

  const filteredSuppliers = channelSuppliers.filter(s => s.channel === form.channel && s.status === "active");

  return (
    <div className="space-y-6">
      <PageHeader title="Bulk Campaigns" description="Send bulk SMS, WhatsApp, Telegram, Viber, IMO messages">
        <Button onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4 mr-2" />New Campaign</Button>
      </PageHeader>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="history">History & Reports</TabsTrigger>
          <TabsTrigger value="channels"><Settings className="w-3.5 h-3.5 mr-1" />Channel Suppliers</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="mt-4 space-y-4">
          {campaigns.length === 0 && (
            <Card className="text-center py-16">
              <CardContent>
                <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="font-medium">No campaigns yet</p>
                <p className="text-sm text-muted-foreground mb-4">Create your first bulk campaign across any channel</p>
                <Button onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4 mr-2" />Create Campaign</Button>
              </CardContent>
            </Card>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {campaigns.map(c => {
              const Icon = CHANNEL_ICONS[c.channel] || MessageSquare;
              const progress = c.total_numbers > 0 ? Math.round((c.sent_count / c.total_numbers) * 100) : 0;
              return (
                <Card key={c.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg border text-xs font-bold ${CHANNEL_COLORS[c.channel]}`}><Icon className="w-4 h-4" /></div>
                        <div>
                          <CardTitle className="text-sm font-semibold">{c.name}</CardTitle>
                          <p className="text-xs text-muted-foreground">{c.client_name}</p>
                        </div>
                      </div>
                      <StatusBadge status={c.status} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-muted/50 rounded p-2"><p className="text-xs text-muted-foreground">Total</p><p className="font-bold text-sm">{c.total_numbers}</p></div>
                      <div className="bg-green-50 rounded p-2"><p className="text-xs text-muted-foreground">Sent</p><p className="font-bold text-sm text-green-700">{c.sent_count || 0}</p></div>
                      <div className="bg-red-50 rounded p-2"><p className="text-xs text-muted-foreground">Failed</p><p className="font-bold text-sm text-red-700">{c.failed_count || 0}</p></div>
                    </div>
                    {c.status === "running" && <Progress value={progress} className="h-1.5" />}
                    <div className="flex gap-2">
                      {c.status === "draft" && (
                        <Button size="sm" className="flex-1" onClick={() => launchCampaign(c)}><Play className="w-3.5 h-3.5 mr-1" />Launch</Button>
                      )}
                      {c.status === "running" && (
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => updateMut.mutate({ id: c.id, data: { status: "paused" } })}><Pause className="w-3.5 h-3.5 mr-1" />Pause</Button>
                      )}
                      {c.status === "paused" && (
                        <Button size="sm" className="flex-1" onClick={() => updateMut.mutate({ id: c.id, data: { status: "running" } })}><Play className="w-3.5 h-3.5 mr-1" />Resume</Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{format(new Date(c.created_date), "MMM d, yyyy HH:mm")}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <CampaignHistory campaigns={campaigns} />
        </TabsContent>

        <TabsContent value="channels" className="mt-4">
          <ChannelSupplierManager />
        </TabsContent>
      </Tabs>

      {/* New Campaign Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) resetForm(); setDialogOpen(v); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Bulk Campaign</DialogTitle>
            <div className="flex gap-2 mt-2">
              {[1, 2, 3].map(s => (
                <div key={s} className={`flex-1 h-1.5 rounded-full ${step >= s ? "bg-primary" : "bg-muted"}`} />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{step === 1 ? "Step 1: Campaign Setup" : step === 2 ? "Step 2: Upload Numbers" : "Step 3: Schedule & Launch"}</p>
          </DialogHeader>

          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1"><Label>Campaign Name *</Label><Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. July Promo" /></div>
              <div className="space-y-1">
                <Label>Channel *</Label>
                <div className="grid grid-cols-5 gap-2">
                  {["sms", "whatsapp", "telegram", "viber", "imo"].map(ch => {
                    const Icon = CHANNEL_ICONS[ch];
                    return (
                      <button key={ch} onClick={() => set("channel", ch)} className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all text-xs font-medium capitalize ${form.channel === ch ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground"}`}>
                        <Icon className="w-5 h-5" />{ch}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-1">
                <Label>Client</Label>
                <Select value={form.client_id} onValueChange={v => set("client_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Channel Supplier</Label>
                <Select value={form.supplier_id} onValueChange={v => set("supplier_id", v)}>
                  <SelectTrigger><SelectValue placeholder={filteredSuppliers.length === 0 ? `No ${form.channel} suppliers — add one in Channel Suppliers tab` : "Select supplier"} /></SelectTrigger>
                  <SelectContent>{filteredSuppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Sender ID</Label><Input value={form.sender_id} onChange={e => set("sender_id", e.target.value)} /></div>
              <div className="space-y-1"><Label>Message Template *</Label><Textarea value={form.template_content} onChange={e => set("template_content", e.target.value)} rows={4} placeholder="Use {{name}}, {{otp}} for variables" /></div>
              <div className="space-y-1"><Label>TPS Limit</Label><Input type="number" value={form.tps_limit} onChange={e => set("tps_limit", Number(e.target.value))} /></div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="border-2 border-dashed rounded-xl p-8 text-center space-y-3">
                <Upload className="w-10 h-10 text-muted-foreground mx-auto" />
                <div>
                  <p className="font-medium">Upload CSV file with numbers</p>
                  <p className="text-xs text-muted-foreground mt-1">First column = phone number. Header row is skipped.</p>
                </div>
                <Button variant="outline" onClick={() => fileRef.current.click()} disabled={csvUploading}>
                  <Upload className="w-4 h-4 mr-2" />{csvUploading ? "Loading..." : "Choose CSV"}
                </Button>
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} />
              </div>
              {numbers.length > 0 && (
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <p className="font-semibold text-green-700">{numbers.length} numbers loaded</p>
                  <div className="mt-2 max-h-32 overflow-y-auto">
                    {numbers.slice(0, 10).map((n, i) => <p key={i} className="font-mono text-xs text-green-700">{n}</p>)}
                    {numbers.length > 10 && <p className="text-xs text-muted-foreground">... and {numbers.length - 10} more</p>}
                  </div>
                </div>
              )}
              <div>
                <Label className="mb-2 block">Or paste numbers (one per line)</Label>
                <Textarea placeholder="+8801712345678&#10;+8801812345678&#10;..." rows={6} onChange={e => {
                  const lines = e.target.value.split("\n").map(l => l.trim()).filter(Boolean);
                  setNumbers(lines);
                }} />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Campaign Type</Label>
                <Select value={form.campaign_type} onValueChange={v => set("campaign_type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediate">Send Immediately</SelectItem>
                    <SelectItem value="scheduled">Schedule for Later</SelectItem>
                    <SelectItem value="test">Test (send to first 10)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.campaign_type === "scheduled" && (
                <div className="space-y-1"><Label>Schedule Date/Time</Label><Input type="datetime-local" value={form.scheduled_at} onChange={e => set("scheduled_at", e.target.value)} /></div>
              )}
              <div className="p-4 bg-muted/50 rounded-lg space-y-2 text-sm">
                <p><span className="text-muted-foreground">Campaign:</span> <strong>{form.name}</strong></p>
                <p><span className="text-muted-foreground">Channel:</span> <strong className="capitalize">{form.channel}</strong></p>
                <p><span className="text-muted-foreground">Numbers:</span> <strong>{form.campaign_type === "test" ? Math.min(10, numbers.length) : numbers.length}</strong></p>
                <p><span className="text-muted-foreground">TPS:</span> <strong>{form.tps_limit}/s</strong></p>
                <p><span className="text-muted-foreground">Est. time:</span> <strong>{Math.ceil((form.campaign_type === "test" ? Math.min(10, numbers.length) : numbers.length) / form.tps_limit)}s</strong></p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            {step > 1 && <Button variant="outline" onClick={() => setStep(s => s - 1)}>Back</Button>}
            <Button variant="outline" onClick={() => { resetForm(); setDialogOpen(false); }}>Cancel</Button>
            {step < 3 ? (
              <Button onClick={() => setStep(s => s + 1)} disabled={step === 1 && !form.name || step === 2 && numbers.length === 0}>Next →</Button>
            ) : (
              <Button onClick={() => createMut.mutate(form)} disabled={createMut.isPending}>
                <Send className="w-4 h-4 mr-2" />Create Campaign
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}