import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Eye, GripHorizontal, GripVertical, RefreshCw, Settings2 } from "lucide-react";
import { format } from "date-fns";

const ALL_COLUMNS = [
  { key: "time",           label: "SMS Time OUT",        width: 120, visible: true  },
  { key: "time_in",        label: "SMS Time IN",         width: 120, visible: true  },
  { key: "msg_id",         label: "Msg ID (Customer)",   width: 130, visible: true  },
  { key: "dest_msg_id",    label: "Msg ID (Vendor)",     width: 130, visible: true  },
  { key: "msg_id_int",     label: "Msg ID (Internal)",   width: 130, visible: false },
  { key: "destination",    label: "DST Number OUT",      width: 130, visible: true  },
  { key: "dst_number_in",  label: "DST Number IN",       width: 120, visible: false },
  { key: "client_name",    label: "Customer",            width: 120, visible: true  },
  { key: "supplier_name",  label: "Vendor",              width: 120, visible: true  },
  { key: "sender_id",      label: "SRC Number",          width: 120, visible: true  },
  { key: "country",        label: "DST MCCMNC Name",     width: 130, visible: true  },
  { key: "mcc",            label: "DST MCC",             width: 70,  visible: true  },
  { key: "mnc",            label: "DST MNC",             width: 70,  visible: true  },
  { key: "network",        label: "Network",             width: 120, visible: false },
  { key: "prefix",         label: "DST Prefix",          width: 90,  visible: false },
  { key: "original_content", label: "Msg Body IN",       width: 200, visible: true  },
  { key: "content",        label: "Msg Body OUT",        width: 200, visible: true  },
  { key: "status",         label: "Status",              width: 100, visible: true  },
  { key: "fail_reason",    label: "Response Code",       width: 150, visible: true  },
  { key: "dlr_code",       label: "DLR Code (Vendor)",   width: 120, visible: false },
  { key: "sms_type",       label: "SMS Type",            width: 100, visible: false },
  { key: "parts",          label: "Parts",               width: 70,  visible: false },
  { key: "cost",           label: "Cost (sys)",          width: 90,  visible: false },
  { key: "sell_rate",      label: "Sell Rate",           width: 90,  visible: false },
  { key: "route_id",       label: "Route ID",            width: 110, visible: false },
  { key: "submit_time",    label: "Submit Time",         width: 130, visible: false },
  { key: "delivery_time",  label: "DLR Received",        width: 130, visible: false },
];

const STORAGE_KEY = "smslogs_columns_v2";

function loadColumns() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Merge with ALL_COLUMNS to keep new cols
      return ALL_COLUMNS.map(c => {
        const found = parsed.find(p => p.key === c.key);
        return found ? { ...c, ...found } : c;
      }).sort((a, b) => {
        const ai = parsed.findIndex(p => p.key === a.key);
        const bi = parsed.findIndex(p => p.key === b.key);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });
    }
  } catch (_) {}
  return ALL_COLUMNS;
}

export default function SmsLogs() {
  const [search, setSearch] = useState('');
  const [searchField, setSearchField] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [columns, setColumns] = useState(loadColumns);
  const [detailLog, setDetailLog] = useState(null);
  const [showColManager, setShowColManager] = useState(false);
  const [resizing, setResizing] = useState(null);
  const [draggingCol, setDraggingCol] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const tableRef = useRef();

  // Persist column config
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(columns.map(c => ({ key: c.key, visible: c.visible, width: c.width }))));
  }, [columns]);

  const { data: logs = [], refetch, dataUpdatedAt } = useQuery({
    queryKey: ['sms-logs'],
    queryFn: () => base44.entities.SmsLog.list('-created_date', 500),
    initialData: [],
    refetchInterval: 60000,
  });

  const filtered = logs.filter(l => {
    const q = search.toLowerCase();
    let matchSearch = !search;
    if (search) {
      if (searchField === 'all') {
        matchSearch = (
          l.destination?.includes(search) ||
          l.content?.toLowerCase().includes(q) ||
          l.original_content?.toLowerCase().includes(q) ||
          l.message_id?.includes(search) ||
          l.dest_message_id?.includes(search) ||
          l.client_name?.toLowerCase().includes(q) ||
          l.sender_id?.toLowerCase().includes(q) ||
          l.country?.toLowerCase().includes(q)
        );
      } else if (searchField === 'destination') {
        matchSearch = l.destination?.includes(search);
      } else if (searchField === 'body_in') {
        matchSearch = l.original_content?.toLowerCase().includes(q) || l.content?.toLowerCase().includes(q);
      } else if (searchField === 'body_out') {
        matchSearch = l.content?.toLowerCase().includes(q);
      } else if (searchField === 'msg_id_in') {
        matchSearch = l.message_id?.includes(search);
      } else if (searchField === 'msg_id_out') {
        matchSearch = l.dest_message_id?.includes(search);
      }
    }
    const matchStatus = statusFilter === 'all' || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // Column resize
  const handleMouseDown = (e, key) => {
    const col = columns.find(c => c.key === key);
    setResizing({ key, startX: e.clientX, startWidth: col.width });
    e.preventDefault();
  };
  const handleMouseMove = useCallback((e) => {
    if (!resizing) return;
    const diff = e.clientX - resizing.startX;
    setColumns(prev => prev.map(c => c.key === resizing.key ? { ...c, width: Math.max(60, resizing.startWidth + diff) } : c));
  }, [resizing]);
  const handleMouseUp = () => setResizing(null);

  // Column drag reorder
  const handleDragStart = (key) => setDraggingCol(key);
  const handleDragOver = (e, key) => { e.preventDefault(); setDragOverCol(key); };
  const handleDrop = (e, targetKey) => {
    e.preventDefault();
    if (!draggingCol || draggingCol === targetKey) { setDraggingCol(null); setDragOverCol(null); return; }
    setColumns(prev => {
      const arr = [...prev];
      const fromIdx = arr.findIndex(c => c.key === draggingCol);
      const toIdx = arr.findIndex(c => c.key === targetKey);
      const [removed] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, removed);
      return arr;
    });
    setDraggingCol(null); setDragOverCol(null);
  };

  const toggleColumn = (key) => setColumns(prev => prev.map(c => c.key === key ? { ...c, visible: !c.visible } : c));
  const visibleColumns = columns.filter(c => c.visible);

  const renderCell = (log, key) => {
    switch (key) {
      case "time": return <span className="text-xs whitespace-nowrap">{log.submit_time ? format(new Date(log.submit_time), 'dd/MM HH:mm:ss') : log.created_date ? format(new Date(log.created_date), 'dd/MM HH:mm:ss') : '—'}</span>;
      case "time_in": return <span className="text-xs whitespace-nowrap">{log.created_date ? format(new Date(log.created_date), 'dd/MM HH:mm:ss') : '—'}</span>;
      case "msg_id": return <span className="font-mono text-xs">{log.message_id || '—'}</span>;
      case "dest_msg_id": return <span className="font-mono text-xs">{log.dest_message_id || '—'}</span>;
      case "msg_id_int": return <span className="font-mono text-xs">{log.id?.slice(0, 12) || '—'}</span>;
      case "destination": return <span className="font-mono text-sm font-semibold">{log.destination}</span>;
      case "dst_number_in": return <span className="font-mono text-xs">{log.destination || '—'}</span>;
      case "client_name": return <span className="text-sm">{log.client_name || '—'}</span>;
      case "supplier_name": return <span className="text-sm">{log.supplier_name || '—'}</span>;
      case "sender_id": return <span className="text-sm">{log.sender_id || '—'}</span>;
      case "country": return <span className="text-sm">{log.country || '—'}</span>;
      case "network": return <span className="text-sm">{log.network || '—'}</span>;
      case "mcc": return <span className="font-mono text-xs">{log.mcc || '—'}</span>;
      case "mnc": return <span className="font-mono text-xs">{log.mnc || '—'}</span>;
      case "prefix": return <span className="font-mono text-xs">{log.prefix || '—'}</span>;
      case "original_content": return (
        <span className="text-xs block truncate" title={log.original_content || log.content}>{log.original_content || log.content || '—'}</span>
      );
      case "content": return (
        <span className={`text-xs block truncate ${log.original_content && log.original_content !== log.content ? 'text-amber-700 font-medium' : ''}`} title={log.content}>
          {log.content || '—'}
          {log.original_content && log.original_content !== log.content && (
            <Badge variant="outline" className="ml-1 text-[10px] py-0 px-1 bg-amber-50 text-amber-700 border-amber-200">mod</Badge>
          )}
        </span>
      );
      case "status": return <StatusBadge status={log.status} />;
      case "fail_reason": return <span className="text-xs text-destructive">{log.fail_reason || '—'}</span>;
      case "dlr_code": return <span className="font-mono text-xs">{log.fail_reason || '—'}</span>;
      case "sms_type": return <span className="text-xs">{log.sms_type || '—'}</span>;
      case "parts": return <span className="text-xs text-center">{log.parts || 1}</span>;
      case "cost": return <span className="font-mono text-xs">{log.cost != null ? log.cost.toFixed(5) : '—'}</span>;
      case "sell_rate": return <span className="font-mono text-xs">{log.sell_rate != null ? log.sell_rate.toFixed(5) : '—'}</span>;
      case "route_id": return <span className="font-mono text-xs">{log.route_id || '—'}</span>;
      case "submit_time": return <span className="text-xs whitespace-nowrap">{log.submit_time ? format(new Date(log.submit_time), 'dd/MM HH:mm:ss') : '—'}</span>;
      case "delivery_time": return <span className="text-xs whitespace-nowrap">{log.delivery_time ? format(new Date(log.delivery_time), 'dd/MM HH:mm:ss') : '—'}</span>;
      default: return null;
    }
  };

  const lastUpdated = dataUpdatedAt ? format(new Date(dataUpdatedAt), 'HH:mm:ss') : '—';

  return (
    <div className="space-y-4" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
      <PageHeader title="SMS Logs (MDR)" description={`Real-time message tracking — ${filtered.length} records • Last refresh: ${lastUpdated}`}>
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Refresh
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShowColManager(v => !v)}>
          <Settings2 className="w-3.5 h-3.5 mr-1.5" />Columns
        </Button>
      </PageHeader>

      {/* Column Manager */}
      {showColManager && (
        <Card>
          <CardContent className="p-3">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Toggle & drag columns to reorder</p>
            <div className="flex flex-wrap gap-1.5">
              {columns.map(col => (
                <button key={col.key}
                  draggable
                  onDragStart={() => handleDragStart(col.key)}
                  onDragOver={e => handleDragOver(e, col.key)}
                  onDrop={e => handleDrop(e, col.key)}
                  onClick={() => toggleColumn(col.key)}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs border transition-colors cursor-grab ${col.visible ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-muted-foreground border-border'}`}
                >
                  <GripVertical className="w-2.5 h-2.5 shrink-0 opacity-60" />
                  {col.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search & Filter */}
      <div className="flex gap-2 flex-wrap items-center">
        <Select value={searchField} onValueChange={setSearchField}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Search: All Fields</SelectItem>
            <SelectItem value="destination">Destination Number</SelectItem>
            <SelectItem value="body_in">Message Body IN</SelectItem>
            <SelectItem value="body_out">Message Body OUT</SelectItem>
            <SelectItem value="msg_id_in">Msg ID (Customer)</SelectItem>
            <SelectItem value="msg_id_out">Msg ID (Vendor)</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="blocked">Blocked</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="outline" className="self-center">{filtered.length} / {logs.length}</Badge>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto" ref={tableRef}>
            <table className="w-full text-sm border-collapse" style={{ tableLayout: 'fixed', minWidth: visibleColumns.reduce((a, c) => a + c.width, 44) }}>
              <thead>
                <tr className="bg-muted border-b sticky top-0 z-10">
                  <th className="w-10 p-2 text-center border-r text-muted-foreground shrink-0"><Eye className="w-3.5 h-3.5 mx-auto" /></th>
                  {visibleColumns.map(col => (
                    <th key={col.key}
                      style={{ width: col.width, minWidth: 60 }}
                      className={`p-2 text-left font-semibold text-xs border-r relative select-none ${dragOverCol === col.key ? 'bg-primary/10' : ''}`}
                      draggable
                      onDragStart={() => handleDragStart(col.key)}
                      onDragOver={e => handleDragOver(e, col.key)}
                      onDrop={e => handleDrop(e, col.key)}
                    >
                      <span className="flex items-center gap-1">
                        <GripVertical className="w-2.5 h-2.5 opacity-30 cursor-grab shrink-0" />
                        <span className="truncate">{col.label}</span>
                      </span>
                      <span
                        className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-primary/30"
                        onMouseDown={e => { handleMouseDown(e, col.key); e.stopPropagation(); }}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((log, idx) => (
                  <tr key={log.id} className={`border-b hover:bg-accent/30 cursor-pointer ${idx % 2 === 0 ? '' : 'bg-muted/10'}`} onClick={() => setDetailLog(log)}>
                    <td className="p-2 text-center border-r">
                      <Eye className="w-3.5 h-3.5 text-muted-foreground mx-auto" />
                    </td>
                    {visibleColumns.map(col => (
                      <td key={col.key} style={{ width: col.width, maxWidth: col.width }} className="p-2 border-r overflow-hidden">
                        {renderCell(log, col.key)}
                      </td>
                    ))}
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={visibleColumns.length + 1} className="text-center text-muted-foreground py-12">No SMS logs found</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 text-xs text-muted-foreground border-t bg-muted/20 flex items-center gap-2">
            <GripHorizontal className="w-3 h-3" />
            Drag column headers to reorder • Drag edges to resize • Click any row for full details • Auto-refreshes every 60s
          </div>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!detailLog} onOpenChange={() => setDetailLog(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>SMS Log Detail (MDR)</DialogTitle></DialogHeader>
          {detailLog && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["Msg ID (Customer)", detailLog.message_id],
                  ["Msg ID (Vendor)", detailLog.dest_message_id],
                  ["Internal ID", detailLog.id],
                  ["Destination", detailLog.destination],
                  ["Status", null, <StatusBadge status={detailLog.status} />],
                  ["SMS Type", detailLog.sms_type],
                  ["Client", detailLog.client_name],
                  ["Supplier", detailLog.supplier_name],
                  ["Sender ID", detailLog.sender_id],
                  ["Country", detailLog.country],
                  ["MCC", detailLog.mcc],
                  ["MNC", detailLog.mnc],
                  ["Prefix", detailLog.prefix],
                  ["Parts", detailLog.parts],
                  ["Cost (sys)", detailLog.cost?.toFixed(5)],
                  ["Sell Rate", detailLog.sell_rate?.toFixed(5)],
                  ["Submit Time", detailLog.submit_time ? format(new Date(detailLog.submit_time), 'PPpp') : '—'],
                  ["Delivery Time", detailLog.delivery_time ? format(new Date(detailLog.delivery_time), 'PPpp') : '—'],
                  ["Created", detailLog.created_date ? format(new Date(detailLog.created_date), 'PPpp') : '—'],
                  ["Fail Reason", detailLog.fail_reason],
                ].map(([label, val, jsx]) => (
                  <div key={label}>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    {jsx || <p className="font-mono text-xs">{val || '—'}</p>}
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <div className="p-3 bg-muted/40 rounded-lg">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Message Body IN (Original)</p>
                  <p className="text-sm break-all">{detailLog.original_content || detailLog.content || '—'}</p>
                </div>
                {detailLog.original_content && detailLog.original_content !== detailLog.content && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs font-semibold text-amber-700 mb-1">Message Body OUT (Modified)</p>
                    <p className="text-sm break-all">{detailLog.content}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}