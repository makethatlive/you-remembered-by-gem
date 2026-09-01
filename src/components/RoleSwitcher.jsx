import React from "react";
import { Crown, Eye } from "lucide-react";

export default function RoleSwitcher({ role, setRole }) {
  const isAdmin = role === "admin";
  return (
    <button
      onClick={() => setRole(isAdmin ? "subscriber" : "admin")}
      className="fixed top-3 right-3 z-[60] flex items-center gap-2 rounded-full bg-brand-cream-card/95 backdrop-blur px-3 py-2 shadow-lg ring-1 ring-brand-gold/40 min-h-[44px] transition-transform active:scale-95"
      aria-label="Switch role"
    >
      {isAdmin ? (
        <Eye className="w-4 h-4 text-brand-teal" />
      ) : (
        <Crown className="w-4 h-4 text-brand-gold" />
      )}
      <span className="font-body text-xs font-semibold text-brand-dark hidden sm:inline">
        {isAdmin ? "View as Subscriber" : "Switch to Gem"}
      </span>
      <span className="font-body text-xs font-semibold text-brand-dark sm:hidden">
        {isAdmin ? "Member" : "Gem"}
      </span>
    </button>
  );
}