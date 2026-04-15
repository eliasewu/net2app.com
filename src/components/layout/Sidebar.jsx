import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Building2, Route, DollarSign,
  MessageSquare, BarChart3, FileText, Settings, Shield,
  Phone, Bell, FileCode, Monitor, ChevronLeft, ChevronRight,
  Radio, Zap, ArrowRightLeft, ShieldCheck, Megaphone
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/" },
  { label: "Live Monitor", icon: Monitor, path: "/monitoring" },
  { label: "Clients", icon: Users, path: "/clients" },
  { label: "Suppliers", icon: Building2, path: "/suppliers" },
  { label: "Routes", icon: Route, path: "/routes" },
  { label: "Rates", icon: DollarSign, path: "/rates" },
  { label: "MCC/MNC", icon: Radio, path: "/mccmnc" },
  { label: "Translation", icon: ArrowRightLeft, path: "/translation" },
  { label: "IP Mgmt", icon: ShieldCheck, path: "/ip-management" },
  { label: "SMS Logs", icon: MessageSquare, path: "/sms-logs" },
  { label: "Voice OTP", icon: Phone, path: "/voice-otp" },
  { label: "Campaigns", icon: Megaphone, path: "/campaigns" },
  { label: "Content", icon: FileCode, path: "/content" },
  { label: "Reports", icon: BarChart3, path: "/reports" },
  { label: "Invoices", icon: FileText, path: "/invoices" },
  { label: "Notifications", icon: Bell, path: "/notifications" },
  { label: "Test SMS", icon: Zap, path: "/test-sms" },
  { label: "Settings", icon: Settings, path: "/settings" },
  { label: "User Mgmt", icon: Shield, path: "/users" },
];

export default function Sidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={cn(
      "fixed left-0 top-0 h-screen bg-sidebar text-sidebar-foreground z-50 transition-all duration-300 flex flex-col",
      collapsed ? "w-16" : "w-60"
    )}>
      <div className="flex items-center justify-between px-4 h-16 border-b border-sidebar-border">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">SMS Gateway</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-md hover:bg-sidebar-accent transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="w-4.5 h-4.5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-3 border-t border-sidebar-border">
        {!collapsed && (
          <div className="flex items-center gap-2 px-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-sidebar-foreground/60">System Online</span>
          </div>
        )}
      </div>
    </aside>
  );
}