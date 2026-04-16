import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";

export default function VoipRates({ voipClients }) {
  const [search, setSearch] = useState("");

  const filtered = voipClients.filter(c =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.username?.includes(search)
  );

  const totalMargin = voipClients.reduce((s, c) => s + ((c.sell_rate || 0) - (c.buy_rate || 0)), 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-50 border border-red-200"><TrendingDown className="w-4 h-4 text-red-600" /></div>
          <div>
            <p className="text-xs text-muted-foreground">Avg Buy Rate</p>
            <p className="text-xl font-bold text-red-700">
              {voipClients.length ? (voipClients.reduce((s, c) => s + (c.buy_rate || 0), 0) / voipClients.length).toFixed(5) : '0.00000'}
            </p>
          </div>
        </div>
        <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-50 border border-blue-200"><TrendingUp className="w-4 h-4 text-blue-600" /></div>
          <div>
            <p className="text-xs text-muted-foreground">Avg Sell Rate</p>
            <p className="text-xl font-bold text-blue-700">
              {voipClients.length ? (voipClients.reduce((s, c) => s + (c.sell_rate || 0), 0) / voipClients.length).toFixed(5) : '0.00000'}
            </p>
          </div>
        </div>
        <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-50 border border-green-200"><DollarSign className="w-4 h-4 text-green-600" /></div>
          <div>
            <p className="text-xs text-muted-foreground">Total Margin</p>
            <p className={`text-xl font-bold ${totalMargin >= 0 ? 'text-green-700' : 'text-red-700'}`}>{totalMargin.toFixed(5)}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Input placeholder="Search clients..." className="max-w-xs" value={search} onChange={e => setSearch(e.target.value)} />
        <p className="text-xs text-muted-foreground">Rates are managed per client. Edit them in the SIP Clients tab.</p>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Voice Rate Card — Buy / Sell</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Traffic</TableHead>
                <TableHead>Buy Rate</TableHead>
                <TableHead>Sell Rate</TableHead>
                <TableHead>Margin</TableHead>
                <TableHead>Margin %</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Billing</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(c => {
                const margin = (c.sell_rate || 0) - (c.buy_rate || 0);
                const marginPct = c.buy_rate ? ((margin / c.buy_rate) * 100).toFixed(1) : '—';
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        c.traffic_type === 'voice' ? "bg-orange-50 text-orange-700 border-orange-200" :
                        c.traffic_type === 'sms' ? "bg-blue-50 text-blue-700 border-blue-200" :
                        "bg-purple-50 text-purple-700 border-purple-200"
                      }>
                        {c.traffic_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm font-bold text-red-700">{(c.buy_rate || 0).toFixed(5)}</TableCell>
                    <TableCell className="font-mono text-sm font-bold text-blue-700">{(c.sell_rate || 0).toFixed(5)}</TableCell>
                    <TableCell className={`font-mono text-sm font-bold ${margin >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {margin >= 0 ? '+' : ''}{margin.toFixed(5)}
                    </TableCell>
                    <TableCell className={`text-sm ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>{marginPct}%</TableCell>
                    <TableCell>{c.currency}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize text-xs">{c.billing_cycle}</Badge></TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-12">No clients found</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}