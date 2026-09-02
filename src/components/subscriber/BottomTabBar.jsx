import React from "react";
import { Home, Users, Gift, User } from "lucide-react";

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "people", label: "My People", icon: Users },
  { id: "giftlists", label: "Gift Lists", icon: Gift },
  { id: "account", label: "Account", icon: User },
];

export default function BottomTabBar({ active, onChange }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-brand-teal border-t border-brand-teal-dark">
      <div className="max-w-6xl mx-auto grid grid-cols-4">
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className="flex flex-col items-center justify-center gap-1 py-2.5 min-h-[56px] transition-colors"
            >
              <Icon className={`w-5 h-5 ${isActive ? "text-brand-gold" : "text-brand-cream/60"}`} />
              <span
                className={`text-[11px] font-body ${
                  isActive ? "text-brand-gold font-semibold" : "text-brand-cream/60"
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}