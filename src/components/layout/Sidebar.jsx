import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Building2, Route, DollarSign,
  MessageSquare, BarChart3, FileText, Settings, Shield,
  Phone, Bell, FileCode, Monitor, ChevronLeft, ChevronRight,
  Radio, Zap, ArrowRightLeft, ShieldCheck, Megaphone, Server,
  PhoneCall, ChevronDown, ChevronUp, Wifi, BookOpen, QrCode, GripVertical
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

const DEFAULT_NAV_GROUPS = [
  {
    id: "overview",
    label: "Overview",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, path: "/" },
      { label: "Live Monitor", icon: Monitor, path: "/monitoring" },
    ]
  },
  {
    id: "sms",
    label: "SMS",
    color: "text-blue-400",
    items: [
      { label: "Clients", icon: Users, path: "/clients" },
      { label: "Suppliers", icon: Building2, path: "/suppliers" },
      { label: "Routes", icon: Route, path: "/routes" },
      { label: "Rates", icon: DollarSign, path: "/rates" },
      { label: "MCC/MNC", icon: Radio, path: "/mccmnc" },
      { label: "Translation", icon: ArrowRightLeft, path: "/translation" },
      { label: "SMS Logs", icon: MessageSquare, path: "/sms-logs" },
      { label: "Test SMS", icon: Zap, path: "/test-sms" },
      { label: "Campaigns", icon: Megaphone, path: "/campaigns" },
      { label: "Content", icon: FileCode, path: "/content" },
      { label: "Device Connect", icon: QrCode, path: "/device-connect" },
    ]
  },
  {
    id: "voice",
    label: "Voice / VoIP",
    color: "text-orange-400",
    items: [
      { label: "Voice OTP", icon: Phone, path: "/voice-otp" },
      { label: "VoIP Platform", icon: Server, path: "/voip" },
      { label: "SMPP Gateway", icon: Wifi, path: "/smpp-gateway" },
    ]
  },
  {
    id: "admin",
    label: "Admin",
    color: "text-purple-400",
    items: [
      { label: "Servers", icon: Server, path: "/servers" },
      { label: "IP Mgmt", icon: ShieldCheck, path: "/ip-management" },
      { label: "Reports", icon: BarChart3, path: "/reports" },
      { label: "Invoices", icon: FileText, path: "/invoices" },
      { label: "Billing Engine", icon: FileText, path: "/billing" },
      { label: "Deploy Guide", icon: BookOpen, path: "/deploy-guide" },
      { label: "Notifications", icon: Bell, path: "/notifications" },
      { label: "Settings", icon: Settings, path: "/settings" },
      { label: "Tenants", icon: Users, path: "/tenants" },
      { label: "User Mgmt", icon: Shield, path: "/users" },
    ]
  }
];

const GROUP_ORDER_KEY = "sidebar_group_order_v1";

function loadGroupOrder() {
  try {
    const saved = localStorage.getItem(GROUP_ORDER_KEY);
    if (saved) {
      const order = JSON.parse(saved);
      const sorted = order.map(id => DEFAULT_NAV_GROUPS.find(g => g.id === id)).filter(Boolean);
      // append any new groups not in saved order
      DEFAULT_NAV_GROUPS.forEach(g => { if (!sorted.find(s => s.id === g.id)) sorted.push(g); });
      return sorted;
    }
  } catch (_) {}
  return DEFAULT_NAV_GROUPS;
}

export default function Sidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [closedGroups, setClosedGroups] = useState({});
  const [navGroups, setNavGroups] = useState(loadGroupOrder);
  const [draggingGroupId, setDraggingGroupId] = useState(null);
  const [dragOverGroupId, setDragOverGroupId] = useState(null);

  useEffect(() => {
    localStorage.setItem(GROUP_ORDER_KEY, JSON.stringify(navGroups.map(g => g.id)));
  }, [navGroups]);

  const toggleGroup = (label) => setClosedGroups(p => ({ ...p, [label]: !p[label] }));

  const handleGroupDragStart = (e, id) => {
    setDraggingGroupId(id);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleGroupDragOver = (e, id) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverGroupId(id);
  };
  const handleGroupDrop = (e, targetId) => {
    e.preventDefault();
    if (!draggingGroupId || draggingGroupId === targetId) { setDraggingGroupId(null); setDragOverGroupId(null); return; }
    setNavGroups(prev => {
      const arr = [...prev];
      const fromIdx = arr.findIndex(g => g.id === draggingGroupId);
      const toIdx = arr.findIndex(g => g.id === targetId);
      const [removed] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, removed);
      return arr;
    });
    setDraggingGroupId(null);
    setDragOverGroupId(null);
  };
  const handleGroupDragEnd = () => { setDraggingGroupId(null); setDragOverGroupId(null); };

  return (
    <aside className={cn(
      "fixed left-0 top-0 h-screen bg-sidebar text-sidebar-foreground z-50 transition-all duration-300 flex flex-col",
      collapsed ? "w-16" : "w-60"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-sidebar-border shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center shrink-0">
              <PhoneCall className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-base tracking-tight">Net2app</span>
          </div>
        )}
        {collapsed && (
          <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center mx-auto">
            <PhoneCall className="w-4 h-4 text-white" />
          </div>
        )}
        <button onClick={() => setCollapsed(!collapsed)} className="p-1.5 rounded-md hover:bg-sidebar-accent transition-colors shrink-0">
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {!collapsed && <p className="text-[9px] text-sidebar-foreground/30 px-2 pb-1 uppercase tracking-widest">Drag groups to reorder</p>}
        {navGroups.map((group) => {
          const isOpen = !closedGroups[group.label];
          const isDraggingThis = draggingGroupId === group.id;
          const isDragOver = dragOverGroupId === group.id;
          return (
            <div
              key={group.id}
              className={cn("mb-1 rounded transition-all", isDraggingThis ? "opacity-40" : "", isDragOver ? "ring-1 ring-primary/50 bg-sidebar-accent/30" : "")}
              draggable={!collapsed}
              onDragStart={e => handleGroupDragStart(e, group.id)}
              onDragOver={e => handleGroupDragOver(e, group.id)}
              onDrop={e => handleGroupDrop(e, group.id)}
              onDragEnd={handleGroupDragEnd}
            >
              {!collapsed && group.label && (
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="flex items-center justify-between w-full px-2 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/40 hover:text-sidebar-foreground/60 transition-colors group"
                >
                  <div className="flex items-center gap-1.5">
                    <GripVertical className="w-3 h-3 opacity-30 group-hover:opacity-60 cursor-grab" />
                    <span className={group.color || ""}>{group.label}</span>
                  </div>
                  {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              )}
              {(isOpen || collapsed) && group.items.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150",
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon className="w-3.5 h-3.5 shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="px-3 py-2 border-t border-sidebar-border shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2 px-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-sidebar-foreground/50">www.net2app.com</span>
          </div>
        )}
      </div>
    </aside>
  );
}