import React from "react";
import { LayoutDashboard, CheckSquare, Users, CalendarDays, Send, BarChart3, Store, Package, UserCog, ClipboardList, BookOpen, Activity, CalendarClock } from "lucide-react";

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "approvals", label: "Approvals", icon: CheckSquare },
  { id: "subscribers", label: "Subscribers", icon: Users },
  { id: "retailers", label: "Retailers", icon: Store },
  { id: "products", label: "Products", icon: Package },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "occasions", label: "Occasions", icon: CalendarClock },
  { id: "sent", label: "Sent", icon: Send },
  { id: "insights", label: "Insights", icon: BarChart3 },
  { id: "audit", label: "Audit", icon: ClipboardList },
  { id: "ai-logs", label: "AI Logs", icon: Activity },
  // { id: "users", label: "Users", icon: UserCog }, // Hidden per admin request
  { id: "help", label: "Help", icon: BookOpen },
];

export default function AdminNav({ active, onChange }) {
  return (
    <div className="sticky top-16 z-30 bg-brand-cream/95 backdrop-blur border-b border-brand-gold/20">
      <div className="max-w-8xl mx-auto px-8 sm:px-12 lg:px-16 flex gap-1 overflow-x-auto no-scrollbar">
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className={`flex items-center gap-1.5 whitespace-nowrap px-3.5 py-3 min-h-[44px] font-body text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? "border-brand-gold text-brand-teal"
                  : "border-transparent text-brand-dark/50 hover:text-brand-dark"
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}