import { Bell, Search, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";

export default function TopBar() {
  const { data: notifications = [] } = useQuery({
    queryKey: ['unread-notifications'],
    queryFn: () => base44.entities.Notification.filter({ is_read: false }, '-created_date', 5),
    initialData: [],
    refetchInterval: 30000,
  });

  const unreadCount = notifications.length;

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 sticky top-0 z-40">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search clients, suppliers, routes..."
            className="pl-10 bg-muted/50 border-0 focus-visible:ring-1"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-4.5 h-4.5" />
              {unreadCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-destructive">
                  {unreadCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-sm">No new notifications</div>
            ) : (
              notifications.map((n) => (
                <DropdownMenuItem key={n.id} className="flex flex-col items-start gap-1 p-3">
                  <span className="font-medium text-sm">{n.title}</span>
                  <span className="text-xs text-muted-foreground">{n.message}</span>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <User className="w-4.5 h-4.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => base44.auth.logout()}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}