import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import { format } from "date-fns";

export default function SmsLogs() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: logs = [] } = useQuery({
    queryKey: ['sms-logs'],
    queryFn: () => base44.entities.SmsLog.list('-created_date', 100),
    initialData: [],
    refetchInterval: 5000,
  });

  const filtered = logs.filter(l => {
    const matchSearch = !search || l.destination?.includes(search) || l.client_name?.toLowerCase().includes(search.toLowerCase()) || l.message_id?.includes(search);
    const matchStatus = statusFilter === 'all' || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <PageHeader title="SMS Logs" description="Real-time message tracking and history" />

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
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Msg ID</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Sender</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Content</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dest Msg ID</TableHead>
                  <TableHead>Fail Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs whitespace-nowrap">{format(new Date(log.created_date), 'HH:mm:ss')}</TableCell>
                    <TableCell className="font-mono text-xs">{log.message_id?.slice(0, 8)}</TableCell>
                    <TableCell className="font-mono text-sm">{log.destination}</TableCell>
                    <TableCell className="text-sm">{log.client_name}</TableCell>
                    <TableCell className="text-sm">{log.supplier_name}</TableCell>
                    <TableCell className="text-sm">{log.sender_id}</TableCell>
                    <TableCell className="text-sm">{log.country}</TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{log.content}</TableCell>
                    <TableCell><StatusBadge status={log.status} /></TableCell>
                    <TableCell className="font-mono text-xs">{log.dest_message_id?.slice(0, 10)}</TableCell>
                    <TableCell className="text-xs text-destructive">{log.fail_reason}</TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-12">No SMS logs found</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}