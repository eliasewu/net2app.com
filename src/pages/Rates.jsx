import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import MccMncPickerDialog from "@/components/rates/MccMncPickerDialog";
import BulkRateUpload from "@/components/rates/BulkRateUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Upload, Download, Globe, CheckCircle, Mail } from "lucide-react";
import { toast } from "sonner";
import RateEmailDialog from "@/components/rates/RateEmailDialog";

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "AED", "BDT"];

export default function Rates() {
  const [tab, setTab] = useState("client");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ type: "client", entity_id: "", mcc: "", mnc: "", country: "", network: "", prefix: "", rate: "", currency: "USD", status: "active" });
  const [selectedRows, setSelectedRows] = useState([]);
  const [editingCell, setEditingCell] = useState(null); // {id, field}
  const [cellValue, setCellValue] = useState("");
  const [emailDialog, setEmailDialog] = useState(null); // { entityId, entityName, email, type }
  const [showInactive, setShowInactive] = useState(false);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const qc = useQueryClient();

  const { data: rates = [] } = useQuery({ queryKey: ["rates"], queryFn: () => base44.entities.Rate.list("-created_date", 500), initialData: [] });
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: () => base44.entities.Client.list(), initialData: [] });
  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers"], queryFn: () => base44.entities.Supplier.list(), initialData: [] });

  const createMut = useMutation({
    mutationFn: async (d) => {
      // Auto-deactivate old rate for same entity+mcc+mnc
      const existing = rates.filter(r => r.type === d.type && r.entity_id === d.entity_id && r.mcc === d.mcc && r.mnc === d.mnc && r.status === "active");
      for (const old of existing) {
        await base44.entities.Rate.update(old.id, { status: "inactive" });
      }
      return base44.entities.Rate.create({ ...d, status: d.active_from ? "scheduled" : "active", version: (existing[0]?.version || 0) + 1 });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rates"] }); toast.success(form.active_from ? "Rate scheduled — old rate deactivated" : "Rate added"); }
  });
  const updateMut = useMutation({ mutationFn: ({ id, data }) => base44.entities.Rate.update(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ["rates"] }); toast.success("Updated"); } });
  const deleteMut = useMutation({ mutationFn: (id) => base44.entities.Rate.delete(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ["rates"] }); toast.success("Deleted"); } });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // Inline cell editing
  const startEdit = (id, field, value) => { setEditingCell({ id, field }); setCellValue(value ?? ""); };
  const commitEdit = (id) => {
    if (!editingCell) return;
    updateMut.mutate({ id, data: { [editingCell.field]: editingCell.field === "rate" ? parseFloat(cellValue) : cellValue } });
    setEditingCell(null);
  };

  const handlePickerSelect = (destinations) => {
    setPickerOpen(false);
    if (destinations.length === 0) return;
    const entityList = tab === "client" ? clients : suppliers;
    const first = destinations[0];
    setForm({ type: tab, entity_id: "", mcc: first.mcc, mnc: first.mnc, country: first.country, network: first.network, prefix: first.prefix || "", rate: "", currency: "USD", status: "active" });
    setEditing(null);
    setEditDialogOpen(true);
    // Store all for bulk if needed
    if (destinations.length > 1) {
      // will create multiple on submit
      setForm(prev => ({ ...prev, _bulk: destinations }));
    }
  };

  const handleSubmit = async () => {
    const entityList = tab === "client" ? clients : suppliers;
    const entity = entityList.find(e => e.id === form.entity_id);
    const bulk = form._bulk;
    const base = { type: form.type || tab, entity_id: form.entity_id, entity_name: entity?.name || "", rate: parseFloat(form.rate) || 0, currency: form.currency, status: form.status };

    if (editing) {
      updateMut.mutate({ id: editing.id, data: { ...base, mcc: form.mcc, mnc: form.mnc, country: form.country, network: form.network, prefix: form.prefix } });
    } else if (bulk) {
      for (const dest of bulk) {
        await base44.entities.Rate.create({ ...base, mcc: dest.mcc, mnc: dest.mnc, country: dest.country, network: dest.network, prefix: dest.prefix || "" });
      }
      qc.invalidateQueries({ queryKey: ["rates"] });
      toast.success(`${bulk.length} rates added`);
    } else {
      createMut.mutate({ ...base, mcc: form.mcc, mnc: form.mnc, country: form.country, network: form.network, prefix: form.prefix });
    }
    setEditDialogOpen(false);
  };

  const downloadCsv = () => {
    const filtered = rates.filter(r => r.type === tab);
    const headers = "type,entity_id,entity_name,mcc,mnc,country,network,prefix,rate,currency,status";
    const rows = filtered.map(r => `${r.type},${r.entity_id},${r.entity_name},${r.mcc},${r.mnc},${r.country},${r.network},${r.prefix},${r.rate},${r.currency},${r.status}`);
    const blob = new Blob([headers + "\n" + rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `rates_${tab}.csv`; a.click();
  };

  const deleteSelected = async () => {
    for (const id of selectedRows) await base44.entities.Rate.delete(id);
    qc.invalidateQueries({ queryKey: ["rates"] });
    setSelectedRows([]);
    toast.success("Deleted selected");
  };

  const allTabRates = rates.filter(r => r.type === tab);
  const filteredRates = showInactive ? allTabRates : allTabRates.filter(r => r.status === "active" || r.status === "scheduled");
  const inactiveCount = allTabRates.filter(r => r.status === "inactive").length;
  const entityList = tab === "client" ? clients : suppliers;

  // Group rates by entity for email send button
  const entitiesWithRates = [...new Set(filteredRates.map(r => r.entity_id))].map(id => {
    const entity = entityList.find(e => e.id === id);
    const entityRates = filteredRates.filter(r => r.entity_id === id);
    return { id, name: entity?.name || id, email: entity?.email || '', rates: entityRates };
  }).filter(e => e.rates.length > 0);

  return (
    <div className="space-y-4">
      <PageHeader title="Rate Management" description="MCC/MNC based rate cards — Excel-style editing">
        <Button variant="outline" size="sm" onClick={downloadCsv}><Download className="w-4 h-4 mr-1" />Export CSV</Button>
        <Button variant="outline" size="sm" onClick={() => setBulkUploadOpen(true)}><Upload className="w-4 h-4 mr-1" />Bulk Import CSV</Button>
        <Button size="sm" onClick={() => setPickerOpen(true)}><Globe className="w-4 h-4 mr-1" />Pick Destinations</Button>
        <Button size="sm" onClick={() => { setEditing(null); setForm({ type: tab, entity_id: "", mcc: "", mnc: "", country: "", network: "", prefix: "", rate: "", currency: "USD", status: "active" }); setEditDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-1" />Add Rate
        </Button>
      </PageHeader>

      {/* Send Rate Card buttons per entity */}
      {entitiesWithRates.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <span className="text-xs font-semibold text-blue-800 w-full">Send Rate Card via Email:</span>
          {entitiesWithRates.map(e => (
            <Button key={e.id} size="sm" variant="outline" className="gap-1 text-xs h-7 border-blue-300 text-blue-700 hover:bg-blue-100"
              onClick={() => setEmailDialog({ entityId: e.id, entityName: e.name, email: e.email, type: tab, rates: e.rates })}>
              <Mail className="w-3 h-3" />{e.name}
            </Button>
          ))}
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="client">Client Rates</TabsTrigger>
          <TabsTrigger value="supplier">Supplier Rates</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            {selectedRows.length > 0 && (
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <span className="text-sm font-medium text-blue-700">{selectedRows.length} selected</span>
                <Button size="sm" variant="destructive" onClick={deleteSelected}><Trash2 className="w-3 h-3 mr-1" />Delete Selected</Button>
                <Button size="sm" variant="outline" onClick={() => setSelectedRows([])}>Clear</Button>
              </div>
            )}
            {inactiveCount > 0 && (
              <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => setShowInactive(v => !v)}>
                {showInactive ? "Hide" : "Show"} {inactiveCount} Superseded/Inactive Rate{inactiveCount !== 1 ? "s" : ""}
              </Button>
            )}
          </div>

          {/* Excel-style table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-muted border-b">
                    <th className="w-10 p-2 text-center border-r"><input type="checkbox" onChange={e => setSelectedRows(e.target.checked ? filteredRates.map(r => r.id) : [])} checked={selectedRows.length === filteredRates.length && filteredRates.length > 0} /></th>
                    <th className="p-2 text-left font-semibold border-r min-w-[140px]">{tab === "client" ? "Client" : "Supplier"}</th>
                    <th className="p-2 text-left font-semibold border-r min-w-[110px]">Country</th>
                    <th className="p-2 text-left font-semibold border-r min-w-[120px]">Network</th>
                    <th className="p-2 text-left font-semibold border-r w-20">MCC</th>
                    <th className="p-2 text-left font-semibold border-r w-20">MNC</th>
                    <th className="p-2 text-left font-semibold border-r w-24">Prefix</th>
                    <th className="p-2 text-left font-semibold border-r w-28">Rate</th>
                    <th className="p-2 text-left font-semibold border-r w-20">Currency</th>
                    <th className="p-2 text-left font-semibold border-r w-20">Status</th>
                    <th className="p-2 text-center w-20">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRates.map((r, idx) => (
                    <tr key={r.id} className={`border-b hover:bg-accent/30 ${r.status === "inactive" ? "opacity-50 bg-gray-50" : idx % 2 === 0 ? "" : "bg-muted/20"} ${selectedRows.includes(r.id) ? "bg-blue-50" : ""}`}>
                      <td className="p-2 text-center border-r">
                        <input type="checkbox" checked={selectedRows.includes(r.id)} onChange={e => setSelectedRows(prev => e.target.checked ? [...prev, r.id] : prev.filter(id => id !== r.id))} />
                      </td>
                      <td className="p-1 border-r">
                        {editingCell?.id === r.id && editingCell.field === "entity_name" ? (
                          <select className="w-full text-xs border rounded px-1 py-0.5" value={cellValue} onChange={e => setCellValue(e.target.value)} onBlur={() => commitEdit(r.id)} autoFocus>
                            {entityList.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
                          </select>
                        ) : (
                          <span className="block px-2 py-1 cursor-pointer hover:bg-blue-50 rounded min-h-[24px]" onDoubleClick={() => startEdit(r.id, "entity_name", r.entity_name)}>{r.entity_name || <span className="text-muted-foreground text-xs">—</span>}</span>
                        )}
                      </td>
                      <td className="p-1 border-r"><span className="block px-2 py-1">{r.country}</span></td>
                      <td className="p-1 border-r"><span className="block px-2 py-1">{r.network}</span></td>
                      <td className="p-1 border-r font-mono text-xs"><span className="block px-2 py-1">{r.mcc}</span></td>
                      <td className="p-1 border-r font-mono text-xs"><span className="block px-2 py-1">{r.mnc}</span></td>
                      <td className="p-1 border-r font-mono text-xs">
                        {editingCell?.id === r.id && editingCell.field === "prefix" ? (
                          <input className="w-full text-xs border rounded px-1 py-0.5 font-mono" value={cellValue} onChange={e => setCellValue(e.target.value)} onBlur={() => commitEdit(r.id)} onKeyDown={e => e.key === "Enter" && commitEdit(r.id)} autoFocus />
                        ) : (
                          <span className="block px-2 py-1 cursor-pointer hover:bg-blue-50 rounded min-h-[24px]" onDoubleClick={() => startEdit(r.id, "prefix", r.prefix)}>{r.prefix}</span>
                        )}
                      </td>
                      <td className="p-1 border-r font-mono text-xs font-bold text-green-700">
                        {editingCell?.id === r.id && editingCell.field === "rate" ? (
                          <input type="number" step="0.00001" className="w-full text-xs border rounded px-1 py-0.5 font-mono" value={cellValue} onChange={e => setCellValue(e.target.value)} onBlur={() => commitEdit(r.id)} onKeyDown={e => e.key === "Enter" && commitEdit(r.id)} autoFocus />
                        ) : (
                          <span className="block px-2 py-1 cursor-pointer hover:bg-blue-50 rounded min-h-[24px]" onDoubleClick={() => startEdit(r.id, "rate", r.rate)}>{r.rate?.toFixed(5)}</span>
                        )}
                      </td>
                      <td className="p-1 border-r text-xs">
                        {editingCell?.id === r.id && editingCell.field === "currency" ? (
                          <select className="w-full text-xs border rounded px-1 py-0.5" value={cellValue} onChange={e => setCellValue(e.target.value)} onBlur={() => commitEdit(r.id)} autoFocus>
                            {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                          </select>
                        ) : (
                          <span className="block px-2 py-1 cursor-pointer hover:bg-blue-50 rounded min-h-[24px]" onDoubleClick={() => startEdit(r.id, "currency", r.currency)}>{r.currency}</span>
                        )}
                      </td>
                      <td className="p-1 border-r"><StatusBadge status={r.status} /></td>
                      <td className="p-1 text-center">
                        <div className="flex gap-1 justify-center">
                          <button onClick={() => { setEditing(r); setForm({ ...r }); setEditDialogOpen(true); }} className="p-1 hover:bg-muted rounded"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => deleteMut.mutate(r.id)} className="p-1 hover:bg-muted rounded"><Trash2 className="w-3.5 h-3.5 text-destructive" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredRates.length === 0 && (
                    <tr><td colSpan={11} className="text-center text-muted-foreground py-12">No rates yet. Click "Pick Destinations" or "Import CSV" to add rates.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {filteredRates.length > 0 && (
              <div className="px-4 py-2 text-xs text-muted-foreground border-t bg-muted/30">
                {filteredRates.filter(r => r.status === 'active').length} active + {filteredRates.filter(r => r.status === 'inactive').length} superseded shown • Double-click any cell to edit inline • When a new rate is added for same MCC/MNC, old rate is auto-deactivated but kept for history.
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Bulk CSV Upload */}
      <BulkRateUpload open={bulkUploadOpen} onClose={() => { setBulkUploadOpen(false); qc.invalidateQueries({ queryKey: ["rates"] }); }} />

      {/* Rate Email Dialog */}
      {emailDialog && (
        <RateEmailDialog
          open={!!emailDialog}
          onClose={() => setEmailDialog(null)}
          entityName={emailDialog.entityName}
          entityEmail={emailDialog.email}
          rates={emailDialog.rates}
          entityType={emailDialog.type}
        />
      )}

      {/* MCC/MNC Picker */}
      <MccMncPickerDialog open={pickerOpen} onOpenChange={setPickerOpen} onSelect={handlePickerSelect} />

      {/* Add/Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit Rate" : "Add Rate"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={form.type || tab} onValueChange={v => set("type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="client">Client</SelectItem><SelectItem value="supplier">Supplier</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{form.type === "supplier" ? "Supplier" : "Client"}</Label>
              <Select value={form.entity_id || ""} onValueChange={v => { const e = (form.type === "supplier" ? suppliers : clients).find(x => x.id === v); set("entity_id", v); if (e) set("entity_name", e.name); }}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>{(form.type === "supplier" ? suppliers : clients).map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>MCC</Label><Input value={form.mcc || ""} onChange={e => set("mcc", e.target.value)} /></div>
            <div className="space-y-1"><Label>MNC</Label><Input value={form.mnc || ""} onChange={e => set("mnc", e.target.value)} /></div>
            <div className="space-y-1"><Label>Country</Label><Input value={form.country || ""} onChange={e => set("country", e.target.value)} /></div>
            <div className="space-y-1"><Label>Network</Label><Input value={form.network || ""} onChange={e => set("network", e.target.value)} /></div>
            <div className="space-y-1"><Label>Prefix</Label><Input value={form.prefix || ""} onChange={e => set("prefix", e.target.value)} /></div>
            <div className="space-y-1"><Label>Rate</Label><Input type="number" step="0.00001" value={form.rate || ""} onChange={e => set("rate", e.target.value)} /></div>
            <div className="space-y-1">
              <Label>Currency</Label>
              <Select value={form.currency || "USD"} onValueChange={v => set("currency", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={form.status || "active"} onValueChange={v => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
            <p className="text-xs font-semibold text-blue-800">⏰ Schedule (optional — leave blank for immediate activation)</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Active From</Label><Input type="datetime-local" value={form.active_from || ""} onChange={e => set("active_from", e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs">Active Until</Label><Input type="datetime-local" value={form.active_until || ""} onChange={e => set("active_until", e.target.value)} /></div>
            </div>
            <p className="text-xs text-amber-700">⚠️ When saved, any existing active rate for the same MCC/MNC will be automatically deactivated.</p>
          </div>
          <div className="p-3 bg-muted/40 rounded text-xs text-muted-foreground">
            {form._bulk ? `Will create ${form._bulk.length} rates for selected destinations` : `Destination: ${form.country || "—"} / ${form.network || "—"}`}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit}><CheckCircle className="w-4 h-4 mr-1" />{editing ? "Update Rate" : "Verify & Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}