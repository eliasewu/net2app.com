import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import StatusBadge from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { MessageSquare, Phone, Send, Zap } from "lucide-react";

const CHANNEL_ICONS = { sms: MessageSquare, whatsapp: Phone, telegram: Send, viber: Zap, imo: Phone };
const CHANNEL_COLORS = {
  sms: "bg-blue-50 text-blue-700 border-blue-200",
  whatsapp: "bg-green-50 text-green-700 border-green-200",
  telegram: "bg-sky-50 text-sky-700 border-sky-200",
  viber: "bg-purple-50 text-purple-700 border-purple-200",
  imo: "bg-orange-50 text-orange-700 border-orange-200",
};

export default function CampaignHistory({ campaigns }) {
  const completed = campaigns.filter(c => ["completed", "failed", "paused"].includes(c.status));

  const summary = {
    total: campaigns.length,
    completed: campaigns.filter(c => c.status === "completed").length,
    totalSent: campaigns.reduce((s, c) => s + (c.sent_count || 0), 0),
    totalDelivered: campaigns.reduce((s, c) => s + (c.delivered_count || 0), 0),
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Campaigns", value: summary.total, color: "text-primary" },
          { label: "Completed", value: summary.completed, color: "text-green-600" },
          { label: "Total Sent", value: summary.totalSent.toLocaleString(), color: "text-blue-600" },
          { label: "Total Delivered", value: summary.totalDelivered.toLocaleString(), color: "text-green-600" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base font-semibold">Campaign History</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Delivered</TableHead>
                <TableHead>Failed</TableHead>
                <TableHead>Delivery Rate</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map(c => {
                const Icon = CHANNEL_ICONS[c.channel] || MessageSquare;
                const rate = c.sent_count > 0 ? ((c.delivered_count || 0) / c.sent_count * 100).toFixed(1) : 0;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs capitalize ${CHANNEL_COLORS[c.channel]}`}>
                        <Icon className="w-3 h-3 mr-1" />{c.channel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{c.client_name}</TableCell>
                    <TableCell>{c.total_numbers}</TableCell>
                    <TableCell className="text-blue-600 font-medium">{c.sent_count || 0}</TableCell>
                    <TableCell className="text-green-600 font-medium">{c.delivered_count || 0}</TableCell>
                    <TableCell className="text-red-600 font-medium">{c.failed_count || 0}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={Number(rate)} className="h-1.5 w-16" />
                        <span className="text-xs">{rate}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{format(new Date(c.created_date), "MMM d, yy HH:mm")}</TableCell>
                    <TableCell><StatusBadge status={c.status} /></TableCell>
                  </TableRow>
                );
              })}
              {campaigns.length === 0 && <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-12">No campaigns yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}