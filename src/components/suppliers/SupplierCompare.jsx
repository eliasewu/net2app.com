import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeftRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { subDays } from "date-fns";

function StatRow({ label, a, b, higherIsBetter = true, format = v => v }) {
  const numA = parseFloat(a) || 0;
  const numB = parseFloat(b) || 0;
  const diff = numA - numB;
  const aWins = higherIsBetter ? numA > numB : numA < numB;
  const bWins = higherIsBetter ? numB > numA : numB < numA;

  return (
    <div className="grid grid-cols-3 items-center py-2.5 border-b last:border-0">
      <div className={`text-sm font-semibold text-right pr-4 ${aWins ? "text-green-700" : bWins ? "text-muted-foreground" : ""}`}>
        {format(numA)}
        {aWins && <TrendingUp className="inline w-3 h-3 ml-1 text-green-600" />}
      </div>
      <div className="text-xs text-center text-muted-foreground font-medium px-2">{label}</div>
      <div className={`text-sm font-semibold pl-4 ${bWins ? "text-green-700" : aWins ? "text-muted-foreground" : ""}`}>
        {format(numB)}
        {bWins && <TrendingUp className="inline w-3 h-3 ml-1 text-green-600" />}
      </div>
    </div>
  );
}

export default function SupplierCompare() {
  const [supA, setSupA] = useState("");
  const [supB, setSupB] = useState("");

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => base44.entities.Supplier.list(),
    initialData: [],
  });

  const { data: smsLogs = [] } = useQuery({
    queryKey: ["sms-logs-compare"],
    queryFn: () => base44.entities.SmsLog.list("-created_date", 5000),
    initialData: [],
  });

  const { data: rates = [] } = useQuery({
    queryKey: ["rates"],
    queryFn: () => base44.entities.Rate.list("-created_date", 500),
    initialData: [],
  });

  const monthAgo = subDays(new Date(), 30);

  function getStats(supplierId) {
    if (!supplierId) return null;
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier) return null;

    const logs = smsLogs.filter(l =>
      l.supplier_id === supplierId &&
      l.created_date &&
      new Date(l.created_date) >= monthAgo
    );

    const total = logs.length;
    const delivered = logs.filter(l => l.status === "delivered").length;
    const failed = logs.filter(l => l.status === "failed" || l.status === "rejected").length;
    const deliveryRate = total > 0 ? (delivered / total) * 100 : 0;
    const failRate = total > 0 ? (failed / total) * 100 : 0;
    const totalCost = logs.reduce((s, l) => s + (l.cost || 0), 0);
    const avgCost = total > 0 ? totalCost / total : 0;

    // Avg latency
    const withTimes = logs.filter(l => l.submit_time && l.delivery_time);
    const avgLatency = withTimes.length > 0
      ? withTimes.reduce((s, l) => s + (new Date(l.delivery_time) - new Date(l.submit_time)), 0) / withTimes.length / 1000
      : null;

    // Avg rate from Rate entity
    const supplierRates = rates.filter(r => r.type === "supplier" && r.entity_id === supplierId && r.status === "active");
    const avgRate = supplierRates.length > 0
      ? supplierRates.reduce((s, r) => s + (r.rate || 0), 0) / supplierRates.length
      : null;

    return { supplier, total, delivered, failed, deliveryRate, failRate, totalCost, avgCost, avgLatency, avgRate };
  }

  const statsA = getStats(supA);
  const statsB = getStats(supB);
  const ready = statsA && statsB;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <ArrowLeftRight className="w-4 h-4 text-blue-600" />
          Supplier Comparison — Last 30 Days
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Supplier selectors */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1.5">Supplier A</p>
            <Select value={supA} onValueChange={setSupA}>
              <SelectTrigger><SelectValue placeholder="Select supplier..." /></SelectTrigger>
              <SelectContent>
                {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1.5">Supplier B</p>
            <Select value={supB} onValueChange={setSupB}>
              <SelectTrigger><SelectValue placeholder="Select supplier..." /></SelectTrigger>
              <SelectContent>
                {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!ready && (
          <div className="text-center text-muted-foreground text-sm py-8">
            Select two suppliers above to compare their performance
          </div>
        )}

        {ready && (
          <>
            {/* Supplier name headers */}
            <div className="grid grid-cols-3 items-center pt-2">
              <div className="text-right pr-4">
                <Badge className="bg-blue-100 text-blue-700 border-blue-200">{statsA.supplier.name}</Badge>
              </div>
              <div className="text-center">
                <ArrowLeftRight className="w-4 h-4 text-muted-foreground mx-auto" />
              </div>
              <div className="pl-4">
                <Badge className="bg-purple-100 text-purple-700 border-purple-200">{statsB.supplier.name}</Badge>
              </div>
            </div>

            {/* Comparison rows */}
            <div className="border rounded-lg px-4">
              <StatRow label="Total Messages" a={statsA.total} b={statsB.total} format={v => v.toLocaleString()} />
              <StatRow label="Delivered" a={statsA.delivered} b={statsB.delivered} format={v => v.toLocaleString()} />
              <StatRow label="Delivery Rate" a={statsA.deliveryRate} b={statsB.deliveryRate} format={v => `${v.toFixed(1)}%`} />
              <StatRow label="Failure Rate" a={statsA.failRate} b={statsB.failRate} higherIsBetter={false} format={v => `${v.toFixed(1)}%`} />
              <StatRow label="Total Cost" a={statsA.totalCost} b={statsB.totalCost} higherIsBetter={false} format={v => `$${v.toFixed(4)}`} />
              <StatRow label="Avg Cost/SMS" a={statsA.avgCost} b={statsB.avgCost} higherIsBetter={false} format={v => `$${v.toFixed(5)}`} />
              {(statsA.avgLatency != null || statsB.avgLatency != null) && (
                <StatRow label="Avg Latency" a={statsA.avgLatency ?? 0} b={statsB.avgLatency ?? 0} higherIsBetter={false} format={v => v > 0 ? `${v.toFixed(1)}s` : "—"} />
              )}
              {(statsA.avgRate != null || statsB.avgRate != null) && (
                <StatRow label="Avg Rate Card" a={statsA.avgRate ?? 0} b={statsB.avgRate ?? 0} higherIsBetter={false} format={v => v > 0 ? `$${v.toFixed(5)}` : "—"} />
              )}
            </div>

            {/* Winner summary */}
            {statsA.deliveryRate !== statsB.deliveryRate && (
              <div className={`p-3 rounded-lg border text-xs font-medium ${statsA.deliveryRate > statsB.deliveryRate ? "bg-blue-50 border-blue-200 text-blue-800" : "bg-purple-50 border-purple-200 text-purple-800"}`}>
                🏆 <strong>{statsA.deliveryRate > statsB.deliveryRate ? statsA.supplier.name : statsB.supplier.name}</strong> leads in delivery rate
                {" "}({Math.abs(statsA.deliveryRate - statsB.deliveryRate).toFixed(1)}% higher)
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}