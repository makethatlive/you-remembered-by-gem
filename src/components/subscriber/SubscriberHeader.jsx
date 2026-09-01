import React from "react";
import { LogOut } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

export default function SubscriberHeader() {
  const { logout } = useAuth();
  return (
    <header className="sticky top-0 z-40 bg-brand-teal">
      <div className="max-w-3xl mx-auto px-5 h-16 flex items-center justify-between">
        <div className="flex items-center">
          <img
            src="https://media.base44.com/images/public/6a1e06f4f6a04e07fc73780a/96fb8be3d_yourememberedbygem1.png"
            alt="You Remembered, by Gem"
            className="h-12 w-auto"
          />
        </div>
        <button
          onClick={() => logout()}
          className="flex items-center gap-1.5 text-brand-gold/80 hover:text-brand-gold font-body text-sm font-medium min-h-[44px]"
        >
          <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Log out</span>
        </button>
      </div>
    </header>
  );
}