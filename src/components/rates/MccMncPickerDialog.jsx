import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, CheckSquare, Square, Globe } from "lucide-react";

export default function MccMncPickerDialog({ open, onOpenChange, onSelect }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState([]);
  const [expandedCountry, setExpandedCountry] = useState(null);

  const { data: mccmncs = [] } = useQuery({
    queryKey: ["mccmnc"],
    queryFn: () => base44.entities.MccMnc.list("-country", 500),
    initialData: [],
  });

  const grouped = useMemo(() => {
    const filtered = mccmncs.filter(m =>
      !search || m.country?.toLowerCase().includes(search.toLowerCase()) ||
      m.network?.toLowerCase().includes(search.toLowerCase()) ||
      m.mcc?.includes(search)
    );
    const map = {};
    filtered.forEach(m => {
      if (!map[m.country]) map[m.country] = [];
      map[m.country].push(m);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [mccmncs, search]);

  const toggle = (item) => {
    const key = `${item.mcc}-${item.mnc}`;
    setSelected(prev => prev.find(s => `${s.mcc}-${s.mnc}` === key) ? prev.filter(s => `${s.mcc}-${s.mnc}` !== key) : [...prev, item]);
  };

  const toggleCountry = (country, items) => {
    const allSelected = items.every(m => selected.find(s => s.mcc === m.mcc && s.mnc === m.mnc));
    if (allSelected) {
      setSelected(prev => prev.filter(s => s.country !== country));
    } else {
      setSelected(prev => {
        const existing = prev.filter(s => s.country !== country);
        return [...existing, ...items];
      });
    }
  };

  const selectAll = () => setSelected([...mccmncs]);
  const clearAll = () => setSelected([]);

  const handleOk = () => {
    onSelect(selected);
    setSelected([]);
    setSearch("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Globe className="w-5 h-5 text-primary" />Select Destinations</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search country, network, MCC..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Button variant="outline" size="sm" onClick={selectAll}>All</Button>
          <Button variant="outline" size="sm" onClick={clearAll}>None</Button>
        </div>

        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto p-2 bg-blue-50 rounded border border-blue-200">
            {selected.map(s => (
              <Badge key={`${s.mcc}-${s.mnc}`} variant="secondary" className="text-xs cursor-pointer" onClick={() => toggle(s)}>
                {s.country} / {s.network} ✕
              </Badge>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto border rounded-lg divide-y">
          {grouped.map(([country, networks]) => {
            const allSel = networks.every(m => selected.find(s => s.mcc === m.mcc && s.mnc === m.mnc));
            const someSel = networks.some(m => selected.find(s => s.mcc === m.mcc && s.mnc === m.mnc));
            return (
              <div key={country}>
                <div
                  className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/50 bg-muted/20"
                  onClick={() => toggleCountry(country, networks)}
                >
                  {allSel ? <CheckSquare className="w-4 h-4 text-primary shrink-0" /> : someSel ? <CheckSquare className="w-4 h-4 text-primary/40 shrink-0" /> : <Square className="w-4 h-4 text-muted-foreground shrink-0" />}
                  <span className="font-semibold text-sm flex-1">{country}</span>
                  <Badge variant="outline" className="text-xs">{networks[0].mcc}</Badge>
                  <span className="text-xs text-muted-foreground">{networks.length} networks</span>
                  <button onClick={e => { e.stopPropagation(); setExpandedCountry(expandedCountry === country ? null : country); }} className="text-xs text-blue-600 hover:underline ml-2">
                    {expandedCountry === country ? "hide" : "expand"}
                  </button>
                </div>
                {expandedCountry === country && networks.map(m => {
                  const isSel = !!selected.find(s => s.mcc === m.mcc && s.mnc === m.mnc);
                  return (
                    <div key={`${m.mcc}-${m.mnc}`} className={`flex items-center gap-3 pl-10 pr-4 py-2 cursor-pointer hover:bg-muted/30 ${isSel ? "bg-blue-50" : ""}`} onClick={() => toggle(m)}>
                      {isSel ? <CheckSquare className="w-4 h-4 text-primary shrink-0" /> : <Square className="w-4 h-4 text-muted-foreground shrink-0" />}
                      <span className="text-sm flex-1">{m.network}</span>
                      <span className="font-mono text-xs text-muted-foreground">{m.mcc}/{m.mnc}</span>
                      {m.prefix && <span className="font-mono text-xs text-blue-600">+{m.prefix}</span>}
                    </div>
                  );
                })}
              </div>
            );
          })}
          {grouped.length === 0 && <div className="text-center text-muted-foreground py-8 text-sm">No destinations found</div>}
        </div>

        <DialogFooter className="gap-2">
          <span className="text-sm text-muted-foreground flex-1">{selected.length} destination(s) selected</span>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleOk} disabled={selected.length === 0}>OK — Add {selected.length} Rate{selected.length !== 1 ? "s" : ""}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}