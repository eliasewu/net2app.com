import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { format } from "date-fns";

function escapeCsv(val) {
  if (val == null) return "";
  const s = String(val);
  return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(headers, rows) {
  const header = headers.join(",");
  const body = rows.map(row => row.map(escapeCsv).join(",")).join("\n");
  return header + "\n" + body;
}

function downloadCsv(filename, content) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExportMetricsButton({ healthRecords = [], routingRules = [], smsLogs = [] }) {
  const handleExport = () => {
    const ts = format(new Date(), "yyyyMMdd_HHmmss");

    // --- Health Logs CSV ---
    const healthHeaders = [
      "Supplier Name", "Status", "Error Rate (%)", "Success Rate (%)",
      "Latency (ms)", "Total Checked", "Total Failed", "Auto Disabled",
      "Threshold Error Rate (%)", "Threshold Min Messages", "Last Checked At"
    ];
    const healthRows = healthRecords.map(h => [
      h.supplier_name, h.status, h.error_rate?.toFixed(2), h.success_rate?.toFixed(2),
      h.latency_ms, h.total_checked, h.total_failed,
      h.auto_disabled ? "Yes" : "No",
      h.threshold_error_rate, h.threshold_min_messages,
      h.last_checked_at ? format(new Date(h.last_checked_at), "yyyy-MM-dd HH:mm:ss") : ""
    ]);
    downloadCsv(`health_logs_${ts}.csv`, toCsv(healthHeaders, healthRows));

    // --- Routing Performance CSV ---
    setTimeout(() => {
      const routeHeaders = [
        "Rule Name", "Rule Type", "Priority", "Match Prefix", "Match MCC", "Match MNC",
        "Match Client", "Supplier IDs", "Hit Count", "Last Hit At", "Is Active", "Notes"
      ];
      const routeRows = routingRules.map(r => [
        r.name, r.rule_type, r.priority, r.match_prefix, r.match_mcc, r.match_mnc,
        r.match_client_name, r.supplier_ids, r.hit_count || 0,
        r.last_hit_at ? format(new Date(r.last_hit_at), "yyyy-MM-dd HH:mm:ss") : "",
        r.is_active !== false ? "Yes" : "No", r.notes
      ]);
      downloadCsv(`routing_performance_${ts}.csv`, toCsv(routeHeaders, routeRows));
    }, 400);
  };

  return (
    <Button size="sm" variant="outline" onClick={handleExport} className="gap-1.5">
      <Download className="w-3.5 h-3.5" />Export CSV
    </Button>
  );
}