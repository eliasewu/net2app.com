import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Upload, Download, CheckCircle2, AlertTriangle, XCircle, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "AED", "BDT"];

// Parse CSV text into array of objects
function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error("CSV must have a header row and at least one data row");
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_"));
  return lines.slice(1).filter(l => l.trim()).map((line, i) => {
    const vals = line.split(",");
    const obj = { _row: i + 2 };
    headers.forEach((h, idx) => { obj[h] = (vals[idx] || "").trim(); });
    return obj;
  });
}

// Validate a single parsed row
function validateRow(row) {
  const errors = [];
  if (!row.mcc || !/^\d{3}$/.test(row.mcc)) errors.push("MCC must be 3 digits");
  if (!row.mnc) errors.push("MNC required");
  if (!row.rate || isNaN(parseFloat(row.rate)) || parseFloat(row.rate) < 0) errors.push("Rate must be a positive number");
  return errors;
}

const SAMPLE_CSV = `type,entity_id,entity_name,mcc,mnc,country,network,prefix,rate,currency
client,,ClientA,470,01,Bangladesh,Grameenphone,880,0.00450,USD
client,,ClientA,470,02,Bangladesh,Robi,880,0.00430,USD
supplier,,SupplierX,470,01,Bangladesh,Grameenphone,880,0.00300,USD`;

export default function BulkRateUpload({ open, onClose }) {
  const fileRef = useRef();
  const qc = useQueryClient();

  const [rows, setRows] = useState([]);        // parsed + validated rows
  const [entityType, setEntityType] = useState("client");
  const [defaultEntityId, setDefaultEntityId] = useState("");
  const [defaultCurrency, setDefaultCurrency] = useState("USD");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);  // { created, skipped, errors }

  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: () => base44.entities.Client.list(), initialData: [] });
  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers"], queryFn: () => base44.entities.Supplier.list(), initialData: [] });
  const { data: existingRates = [] } = useQuery({ queryKey: ["rates"], queryFn: () => base44.entities.Rate.list("-created_date", 1000), initialData: [] });

  const entityList = entityType === "client" ? clients : suppliers;

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    try {
      const parsed = parseCsv(text);
      const validated = parsed.map(row => {
        const errors = validateRow(row);
        // Match entity by name if no id
        let entityId = row.entity_id || defaultEntityId;
        let entityName = row.entity_name || "";
        if (!entityId && entityName) {
          const match = entityList.find(e => e.name.toLowerCase() === entityName.toLowerCase());
          if (match) { entityId = match.id; entityName = match.name; }
        }
        // Check for conflict with existing active rate
        const conflict = existingRates.find(r =>
          r.type === (row.type || entityType) &&
          r.entity_id === entityId &&
          r.mcc === row.mcc &&
          r.mnc === row.mnc &&
          r.status === "active"
        );
        return {
          ...row,
          _entityId: entityId,
          _entityName: entityName,
          _errors: errors,
          _conflict: conflict ? `Will supersede existing rate ${conflict.rate?.toFixed(5)}` : null,
          _type: row.type || entityType,
          _rate: parseFloat(row.rate) || 0,
          _currency: row.currency || defaultCurrency,
        };
      });
      setRows(validated);
      setResult(null);
    } catch (err) {
      toast.error(err.message);
    }
    e.target.value = "";
  };

  const validRows = rows.filter(r => r._errors.length === 0);
  const invalidRows = rows.filter(r => r._errors.length > 0);
  const conflictRows = rows.filter(r => r._conflict);

  const handleImport = async () => {
    if (validRows.length === 0) { toast.error("No valid rows to import"); return; }
    setImporting(true);
    let created = 0, skipped = 0, errors = [];

    for (const row of validRows) {
      try {
        // Deactivate existing active rate for same entity+mcc+mnc
        const toDeactivate = existingRates.filter(r =>
          r.type === row._type &&
          r.entity_id === row._entityId &&
          r.mcc === row.mcc &&
          r.mnc === row.mnc &&
          r.status === "active"
        );
        for (const old of toDeactivate) {
          await base44.entities.Rate.update(old.id, { status: "inactive" });
        }

        await base44.entities.Rate.create({
          type: row._type,
          entity_id: row._entityId || defaultEntityId,
          entity_name: row._entityName || row.entity_name || "",
          mcc: row.mcc,
          mnc: row.mnc,
          country: row.country || "",
          network: row.network || "",
          prefix: row.prefix || "",
          rate: row._rate,
          currency: row._currency,
          status: "active",
          version: (toDeactivate[0]?.version || 0) + 1,
        });
        created++;
      } catch (err) {
        errors.push(`Row ${row._row}: ${err.message}`);
        skipped++;
      }
    }

    qc.invalidateQueries({ queryKey: ["rates"] });
    setResult({ created, skipped: skipped + invalidRows.length, errors });
    setImporting(false);
    toast.success(`Imported ${created} rates`);
  };

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "rate_card_template.csv"; a.click();
  };

  const reset = () => { setRows([]); setResult(null); };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-4 h-4" />Bulk Rate Upload — CSV Import
          </DialogTitle>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            {/* Controls */}
            <div className="grid grid-cols-3 gap-3 p-3 bg-muted/40 rounded-lg">
              <div className="space-y-1">
                <Label className="text-xs">Default Rate Type</Label>
                <Select value={entityType} onValueChange={v => { setEntityType(v); setDefaultEntityId(""); }}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="client">Client</SelectItem><SelectItem value="supplier">Supplier</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Default Entity (if not in CSV)</Label>
                <Select value={defaultEntityId} onValueChange={setDefaultEntityId}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    {entityList.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Default Currency</Label>
                <Select value={defaultCurrency} onValueChange={setDefaultCurrency}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* Upload area */}
            {rows.length === 0 ? (
              <div
                className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-10 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-all"
                onClick={() => fileRef.current.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) { const dt = new DataTransfer(); dt.items.add(f); fileRef.current.files = dt.files; handleFile({ target: fileRef.current }); }}}
              >
                <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
                <p className="font-semibold text-sm">Drop CSV file here or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">Required columns: mcc, mnc, rate — Optional: type, entity_name, country, network, prefix, currency</p>
                <Button variant="outline" size="sm" className="mt-3 gap-1" onClick={e => { e.stopPropagation(); downloadSample(); }}>
                  <Download className="w-3 h-3" />Download Template CSV
                </Button>
              </div>
            ) : (
              /* Preview Table */
              <div className="space-y-3">
                {/* Summary badges */}
                <div className="flex flex-wrap gap-2 items-center">
                  <Badge className="bg-green-100 text-green-800 border-green-200">{validRows.length} valid rows</Badge>
                  {invalidRows.length > 0 && <Badge className="bg-red-100 text-red-800 border-red-200">{invalidRows.length} invalid (will skip)</Badge>}
                  {conflictRows.length > 0 && <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">{conflictRows.length} will supersede existing rates</Badge>}
                  <Button size="sm" variant="ghost" className="text-xs ml-auto gap-1" onClick={reset}><RefreshCw className="w-3 h-3" />Upload different file</Button>
                </div>

                <div className="overflow-x-auto border rounded-lg max-h-80">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted">
                      <tr>
                        <th className="p-2 text-left font-semibold border-b w-8">#</th>
                        <th className="p-2 text-left font-semibold border-b">Entity</th>
                        <th className="p-2 text-left font-semibold border-b">Country</th>
                        <th className="p-2 text-left font-semibold border-b">Network</th>
                        <th className="p-2 text-left font-semibold border-b">MCC</th>
                        <th className="p-2 text-left font-semibold border-b">MNC</th>
                        <th className="p-2 text-left font-semibold border-b">Prefix</th>
                        <th className="p-2 text-left font-semibold border-b">Rate</th>
                        <th className="p-2 text-left font-semibold border-b">Curr</th>
                        <th className="p-2 text-left font-semibold border-b">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr key={i} className={`border-b ${row._errors.length > 0 ? 'bg-red-50' : row._conflict ? 'bg-yellow-50' : 'hover:bg-accent/20'}`}>
                          <td className="p-2 text-muted-foreground">{row._row}</td>
                          <td className="p-2">{row._entityName || row.entity_name || <span className="text-muted-foreground italic">default</span>}</td>
                          <td className="p-2">{row.country || '—'}</td>
                          <td className="p-2">{row.network || '—'}</td>
                          <td className="p-2 font-mono">{row.mcc}</td>
                          <td className="p-2 font-mono">{row.mnc}</td>
                          <td className="p-2 font-mono">{row.prefix || '—'}</td>
                          <td className="p-2 font-mono font-bold text-green-700">{row._rate?.toFixed(5)}</td>
                          <td className="p-2">{row._currency}</td>
                          <td className="p-2">
                            {row._errors.length > 0 ? (
                              <span className="flex items-center gap-1 text-red-600"><XCircle className="w-3 h-3" />{row._errors[0]}</span>
                            ) : row._conflict ? (
                              <span className="flex items-center gap-1 text-yellow-600"><AlertTriangle className="w-3 h-3" />Supersedes</span>
                            ) : (
                              <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="w-3 h-3" />OK</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
          </div>
        ) : (
          /* Import result */
          <div className="space-y-4 py-4">
            <div className="text-center space-y-2">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
              <h3 className="font-bold text-lg">Import Complete</h3>
              <div className="flex justify-center gap-3">
                <Badge className="bg-green-100 text-green-800 border-green-200 text-sm px-3">{result.created} imported</Badge>
                {result.skipped > 0 && <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 text-sm px-3">{result.skipped} skipped</Badge>}
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 space-y-1">
                {result.errors.map((e, i) => <p key={i}>{e}</p>)}
              </div>
            )}
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={reset}>Upload Another File</Button>
              <Button onClick={onClose}>Done</Button>
            </div>
          </div>
        )}

        {!result && (
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleImport} disabled={importing || validRows.length === 0} className="gap-1 min-w-28">
              {importing ? <><Loader2 className="w-4 h-4 animate-spin" />Importing…</> : <><Upload className="w-4 h-4" />Import {validRows.length} Rates</>}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}