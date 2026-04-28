import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { evaluateRules, RULE_TYPE_META } from "@/lib/routingEngine";
import { Zap, ChevronRight } from "lucide-react";

export default function RuleSimulator({ rules, rates, suppliers }) {
  const [ctx, setCtx] = useState({ prefix: "880", mcc: "470", mnc: "01", client_id: "", sender_id: "" });
  const [result, setResult] = useState(null);

  const set = (k, v) => setCtx(p => ({ ...p, [k]: v }));

  const simulate = () => {
    const now = new Date();
    const res = evaluateRules(rules, rates, suppliers, {
      ...ctx,
      nowHour: now.getHours(),
      nowMin: now.getMinutes(),
      nowDay: now.getDay(),
    });
    setResult(res);
  };

  const meta = result?.matchedRule ? RULE_TYPE_META[result.matchedRule.rule_type] : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-500" /> Rule Simulator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <div className="space-y-1"><Label className="text-xs">Prefix</Label><Input className="h-8 text-xs" value={ctx.prefix} onChange={e => set("prefix", e.target.value)} placeholder="880" /></div>
          <div className="space-y-1"><Label className="text-xs">MCC</Label><Input className="h-8 text-xs" value={ctx.mcc} onChange={e => set("mcc", e.target.value)} placeholder="470" /></div>
          <div className="space-y-1"><Label className="text-xs">MNC</Label><Input className="h-8 text-xs" value={ctx.mnc} onChange={e => set("mnc", e.target.value)} placeholder="01" /></div>
          <div className="space-y-1"><Label className="text-xs">Client ID</Label><Input className="h-8 text-xs" value={ctx.client_id} onChange={e => set("client_id", e.target.value)} placeholder="optional" /></div>
          <div className="space-y-1"><Label className="text-xs">Sender ID</Label><Input className="h-8 text-xs" value={ctx.sender_id} onChange={e => set("sender_id", e.target.value)} placeholder="optional" /></div>
        </div>

        <Button size="sm" onClick={simulate} className="gap-1.5">
          <Zap className="w-3.5 h-3.5" /> Simulate Now
        </Button>

        {result && (
          <div className="space-y-3 border-t pt-3">
            {/* Matched rule */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Matched rule:</span>
              {result.matchedRule ? (
                <Badge className={`text-xs border ${meta?.color}`}>
                  {meta?.icon} {result.matchedRule.name}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs">No rule matched — default priority order</Badge>
              )}
              <Badge variant="outline" className="text-xs font-mono">{result.reason}</Badge>
            </div>

            {/* Supplier order */}
            {result.supplierOrder.length === 0 ? (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 font-semibold">
                🚫 Traffic BLOCKED — {result.reason.replace("blocked:", "")}
              </div>
            ) : (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-semibold">Supplier resolution order:</p>
                <div className="flex flex-wrap items-center gap-1">
                  {result.supplierOrder.map((s, i) => (
                    <div key={s.id} className="flex items-center gap-1">
                      {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                      <div className="flex items-center gap-1.5 bg-muted border rounded-lg px-2.5 py-1.5">
                        <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                        <span className="text-xs font-medium">{s.name}</span>
                        {s.weight != null && <Badge variant="outline" className="text-[10px] px-1 h-4">{s.weight}%</Badge>}
                        {s.rate != null && <Badge variant="outline" className="text-[10px] px-1 h-4 font-mono">${Number(s.rate).toFixed(5)}</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rule details */}
            {result.matchedRule && (
              <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 pt-1 border-t">
                <span>Priority: <strong>{result.matchedRule.priority}</strong></span>
                {result.matchedRule.match_prefix && <span>Prefix match: <strong>{result.matchedRule.match_prefix}</strong></span>}
                {result.matchedRule.match_mcc && <span>MCC: <strong>{result.matchedRule.match_mcc}</strong></span>}
                {result.matchedRule.action_on_all_fail && <span>On fail: <strong>{result.matchedRule.action_on_all_fail}</strong></span>}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}