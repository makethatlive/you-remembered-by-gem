import React from "react";
import { LogOut } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

export default function AdminHeader() {
  const { logout } = useAuth();
  return (
    <header className="sticky top-0 z-40 bg-brand-teal">
      <div className="max-w-8xl mx-auto px-5 h-16 flex items-center justify-center relative">
        <h1 className="font-display text-2xl font-semibold text-brand-gold">Gem's View</h1>
        <button
          onClick={() => logout()}
          className="absolute right-5 flex items-center gap-1.5 text-brand-gold/80 hover:text-brand-gold font-body text-sm font-medium min-h-[44px]"
        >
          <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Log out</span>
        </button>
      </div>
    </header>
  );
}