import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Check, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const severityColors = {
  info: "bg-blue-50 border-blue-200 text-blue-700",
  warning: "bg-yellow-50 border-yellow-200 text-yellow-700",
  critical: "bg-red-50 border-red-200 text-red-700",
};

export default function Notifications() {
  const qc = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => base44.entities.Notification.list('-created_date', 50),
    initialData: [],
  });

  const markRead = useMutation({
    mutationFn: (id) => base44.entities.Notification.update(id, { is_read: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const deleteNot = useMutation({
    mutationFn: (id) => base44.entities.Notification.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifications'] }); toast.success("Deleted"); },
  });

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.is_read);
    for (const n of unread) {
      await base44.entities.Notification.update(n.id, { is_read: true });
    }
    qc.invalidateQueries({ queryKey: ['notifications'] });
    toast.success("All marked as read");
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Notifications" description={`${unreadCount} unread notifications`}>
        <Button variant="outline" onClick={markAllRead} disabled={unreadCount === 0}>
          <Check className="w-4 h-4 mr-2" />Mark All Read
        </Button>
      </PageHeader>

      <div className="space-y-3">
        {notifications.map((n) => (
          <Card key={n.id} className={cn("transition-all", !n.is_read && "ring-1 ring-primary/20")}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className={cn("p-2 rounded-lg border", severityColors[n.severity])}>
                    <Bell className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className={cn("font-medium text-sm", !n.is_read && "font-semibold")}>{n.title}</h3>
                      <Badge variant="outline" className="text-xs capitalize">{n.type?.replace(/_/g, ' ')}</Badge>
                      <Badge variant="outline" className={cn("text-xs capitalize", severityColors[n.severity])}>{n.severity}</Badge>
                      {!n.is_read && <span className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{n.message}</p>
                    <p className="text-xs text-muted-foreground mt-2">{format(new Date(n.created_date), 'MMM d, yyyy HH:mm')}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  {!n.is_read && (
                    <Button variant="ghost" size="icon" onClick={() => markRead.mutate(n.id)}><Check className="w-4 h-4" /></Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => deleteNot.mutate(n.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {notifications.length === 0 && (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No notifications</CardContent></Card>
        )}
      </div>
    </div>
  );
}