import { useState, useRef, useCallback } from "react";
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
import { Search, Eye, GripHorizontal } from "lucide-react";
import { format } from "date-fns";

const DEFAULT_COLUMNS = [
  { key: "time", label: "Time", width: 90, visible: true },
  { key: "msg_id", label: "Msg ID", width: 100, visible: true },
  { key: "dest_msg_id", label: "Dest Msg ID", width: 110, visible: true },
  { key: "destination", label: "Destination", width: 120, visible: true },
  { key: "client_name", label: "Client", width: 120, visible: true },
  { key: "supplier_name", label: "Supplier", width: 120, visible: true },
  { key: "sender_id", label: "Sender", width: 110, visible: true },
  { key: "country", label: "Country", width: 90, visible: true },
  { key: "original_content", label: "Original Content", width: 180, visible: true },
  { key: "content", label: "Modified Content", width: 180, visible: true },
  { key: "status", label: "Status", width: 90, visible: true },
  { key: "fail_reason", label: "Fail Reason", width: 130, visible: true },
];

export default function SmsLogs() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [detailLog, setDetailLog] = useState(null);
  const [resizing, setResizing] = useState(null); // {key, startX, startWidth}
  const tableRef = useRef();

  const { data: logs = [] } = useQuery({
    queryKey: ['sms-logs'],
    queryFn: () => base44.entities.SmsLog.list('-created_date', 200),
    initialData: [],
    refetchInterval: 5000,
  });

  const filtered = logs.filter(l => {
    const matchSearch = !search || l.destination?.includes(search) || l.client_name?.toLowerCase().includes(search.toLowerCase()) || l.message_id?.includes(search);
    const matchStatus = statusFilter === 'all' || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const getCol = (key) => columns.find(c => c.key === key);

  const handleMouseDown = (e, key) => {
    const col = getCol(key);
    setResizing({ key, startX: e.clientX, startWidth: col.width });
    e.preventDefault();
  };

  const handleMouseMove = useCallback((e) => {
    if (!resizing) return;
    const diff = e.clientX - resizing.startX;
    setColumns(prev => prev.map(c => c.key === resizing.key ? { ...c, width: Math.max(60, resizing.startWidth + diff) } : c));
  }, [resizing]);

  const handleMouseUp = () => setResizing(null);

  const toggleColumn = (key) => {
    setColumns(prev => prev.map(c => c.key === key ? { ...c, visible: !c.visible } : c));
  };

  const visibleColumns = columns.filter(c => c.visible);

  const renderCell = (log, key) => {
    switch (key) {
      case "time": return <span className="text-xs whitespace-nowrap">{log.created_date ? format(new Date(log.created_date), 'dd/MM HH:mm:ss') : '—'}</span>;
      case "msg_id": return <span className="font-mono text-xs">{log.message_id || '—'}</span>;
      case "dest_msg_id": return <span className="font-mono text-xs">{log.dest_message_id || '—'}</span>;
      case "destination": return <span className="font-mono text-sm font-semibold">{log.destination}</span>;
      case "client_name": return <span className="text-sm">{log.client_name || '—'}</span>;
      case "supplier_name": return <span className="text-sm">{log.supplier_name || '—'}</span>;
      case "sender_id": return <span className="text-sm">{log.sender_id || '—'}</span>;
      case "country": return <span className="text-sm">{log.country || '—'}</span>;
      case "original_content": return (
        <span className="text-xs max-w-full block truncate" title={log.original_content || log.content}>
          {log.original_content || log.content || '—'}
        </span>
      );
      case "content": return (
        <span className={`text-xs max-w-full block truncate ${log.original_content && log.original_content !== log.content ? 'text-amber-700 font-medium' : ''}`} title={log.content}>
          {log.content || '—'}
          {log.original_content && log.original_content !== log.content && (
            <Badge variant="outline" className="ml-1 text-[10px] py-0 px-1 bg-amber-50 text-amber-700 border-amber-200">modified</Badge>
          )}
        </span>
      );
      case "status": return <StatusBadge status={log.status} />;
      case "fail_reason": return <span className="text-xs text-destructive">{log.fail_reason || '—'}</span>;
      default: return null;
    }
  };

  return (
    <div className="space-y-4" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
      <PageHeader title="SMS Logs" description="Real-time message tracking — original & modified content, resizable columns">
        <div className="flex gap-1 flex-wrap">
          {columns.map(col => (
            <Button key={col.key} variant={col.visible ? "default" : "outline"} size="sm"
              className="text-xs h-7 px-2" onClick={() => toggleColumn(col.key)}>
              {col.label}
            </Button>
          ))}
        </div>
      </PageHeader>

      <div className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by number, client, message ID..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
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
        <Badge variant="outline" className="self-center">{filtered.length} records</Badge>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto" ref={tableRef}>
            <table className="w-full text-sm border-collapse" style={{ tableLayout: 'fixed', minWidth: visibleColumns.reduce((a, c) => a + c.width, 60) }}>
              <thead>
                <tr className="bg-muted border-b">
                  <th className="w-10 p-2 text-center border-r text-muted-foreground"><Eye className="w-3.5 h-3.5 mx-auto" /></th>
                  {visibleColumns.map((col) => (
                    <th key={col.key} style={{ width: col.width, minWidth: 60 }}
                      className="p-2 text-left font-semibold text-xs border-r relative select-none">
                      {col.label}
                      <span
                        className="absolute right-0 top-0 h-full w-2 cursor-col-resize flex items-center justify-center hover:bg-primary/20"
                        onMouseDown={(e) => handleMouseDown(e, col.key)}
                      >
                        <GripHorizontal className="w-2 h-2 text-muted-foreground" />
                      </span>
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
          {filtered.length > 0 && (
            <div className="px-4 py-2 text-xs text-muted-foreground border-t bg-muted/20 flex items-center gap-2">
              <GripHorizontal className="w-3 h-3" />
              Drag column edges to resize • Click any row to see full details
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!detailLog} onOpenChange={() => setDetailLog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>SMS Log Detail</DialogTitle></DialogHeader>
          {detailLog && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><p className="text-xs text-muted-foreground">Msg ID</p><p className="font-mono font-semibold">{detailLog.message_id || '—'}</p></div>
                <div><p className="text-xs text-muted-foreground">Dest Msg ID</p><p className="font-mono">{detailLog.dest_message_id || '—'}</p></div>
                <div><p className="text-xs text-muted-foreground">Destination</p><p className="font-mono font-bold">{detailLog.destination}</p></div>
                <div><p className="text-xs text-muted-foreground">Status</p><StatusBadge status={detailLog.status} /></div>
                <div><p className="text-xs text-muted-foreground">Client</p><p>{detailLog.client_name || '—'}</p></div>
                <div><p className="text-xs text-muted-foreground">Supplier</p><p>{detailLog.supplier_name || '—'}</p></div>
                <div><p className="text-xs text-muted-foreground">Sender ID</p><p>{detailLog.sender_id || '—'}</p></div>
                <div><p className="text-xs text-muted-foreground">Country</p><p>{detailLog.country || '—'}</p></div>
                <div><p className="text-xs text-muted-foreground">Time</p><p>{detailLog.created_date ? format(new Date(detailLog.created_date), 'PPpp') : '—'}</p></div>
                {detailLog.fail_reason && <div><p className="text-xs text-muted-foreground">Fail Reason</p><p className="text-destructive">{detailLog.fail_reason}</p></div>}
              </div>
              <div className="space-y-2">
                <div className="p-3 bg-muted/40 rounded-lg">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Original Content</p>
                  <p className="text-sm">{detailLog.original_content || detailLog.content || '—'}</p>
                </div>
                {detailLog.original_content && detailLog.original_content !== detailLog.content && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs font-semibold text-amber-700 mb-1">Modified Content</p>
                    <p className="text-sm">{detailLog.content}</p>
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