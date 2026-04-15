import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function StatsCard({ title, value, icon: Icon, trend, trendUp, color = "primary" }) {
  const colorMap = {
    primary: "bg-blue-50 text-blue-600",
    success: "bg-green-50 text-green-600",
    warning: "bg-yellow-50 text-yellow-600",
    danger: "bg-red-50 text-red-600",
  };

  return (
    <Card className="p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold mt-1 tracking-tight">{value}</p>
          {trend && (
            <p className={cn("text-xs mt-1 font-medium", trendUp ? "text-green-600" : "text-red-600")}>
              {trendUp ? "↑" : "↓"} {trend}
            </p>
          )}
        </div>
        <div className={cn("p-2.5 rounded-xl", colorMap[color])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </Card>
  );
}