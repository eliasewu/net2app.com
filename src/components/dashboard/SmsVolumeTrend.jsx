import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp } from "lucide-react";

// Top N clients by volume, aggregate by hour
const TOP_N = 6;

const COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"
];

export default function SmsVolumeTrend({ smsLogs = [], clients = [] }) {
  const { chartData, topClients } = useMemo(() => {
    // Pick top clients by volume
    const volumeMap = {};
    smsLogs.forEach(l => {
      if (!l.client_name) return;
      volumeMap[l.client_name] = (volumeMap[l.client_name] || 0) + 1;
    });
    const topClients = Object.entries(volumeMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_N)
      .map(([name]) => name);

    // Build hourly buckets for last 12 hours
    const now = new Date();
    const hours = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now);
      d.setHours(now.getHours() - (11 - i), 0, 0, 0);
      return d;
    });

    const chartData = hours.map(h => {
      const label = h.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      const entry = { time: label };
      topClients.forEach(name => { entry[name] = 0; });
      return entry;
    });

    smsLogs.forEach(log => {
      if (!log.client_name || !topClients.includes(log.client_name)) return;
      const logTime = new Date(log.created_date || log.submit_time);
      if (isNaN(logTime)) return;
      const diffH = Math.floor((now - logTime) / 3600000);
      if (diffH < 0 || diffH >= 12) return;
      const idx = 11 - diffH;
      if (chartData[idx]) chartData[idx][log.client_name] = (chartData[idx][log.client_name] || 0) + 1;
    });

    return { chartData, topClients };
  }, [smsLogs, clients]);

  if (topClients.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center gap-2">
        <TrendingUp className="w-4 h-4 text-blue-500" />
        <CardTitle className="text-sm">SMS Volume per Client — Last 12 Hours</CardTitle>
      </CardHeader>
      <CardContent className="p-3">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="time" tick={{ fontSize: 10 }} interval={2} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip contentStyle={{ fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {topClients.map((name, i) => (
              <Bar key={name} dataKey={name} stackId="a" fill={COLORS[i % COLORS.length]} radius={i === topClients.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}