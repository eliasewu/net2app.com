import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusStyles = {
  active: "bg-green-50 text-green-700 border-green-200",
  inactive: "bg-gray-100 text-gray-600 border-gray-200",
  blocked: "bg-red-50 text-red-700 border-red-200",
  delivered: "bg-green-50 text-green-700 border-green-200",
  sent: "bg-blue-50 text-blue-700 border-blue-200",
  pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
  failed: "bg-red-50 text-red-700 border-red-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  paid: "bg-green-50 text-green-700 border-green-200",
  overdue: "bg-red-50 text-red-700 border-red-200",
  draft: "bg-gray-100 text-gray-600 border-gray-200",
  cancelled: "bg-gray-100 text-gray-600 border-gray-200",
  connected: "bg-green-50 text-green-700 border-green-200",
  ringing: "bg-blue-50 text-blue-700 border-blue-200",
  undelivered: "bg-red-50 text-red-700 border-red-200",
  busy: "bg-yellow-50 text-yellow-700 border-yellow-200",
  no_answer: "bg-yellow-50 text-yellow-700 border-yellow-200",
  success: "bg-green-50 text-green-700 border-green-200",
};

export default function StatusBadge({ status }) {
  return (
    <Badge variant="outline" className={cn("text-xs font-medium capitalize", statusStyles[status] || statusStyles.pending)}>
      {status?.replace(/_/g, ' ')}
    </Badge>
  );
}