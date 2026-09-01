import React from "react";
import { AlertTriangle } from "lucide-react";

export default function UrgentAlert({ name, days }) {
  return (
    <div className="flex items-center gap-3 bg-brand-amber rounded-xl px-4 py-3.5 shadow-sm">
      <AlertTriangle className="w-5 h-5 text-brand-dark shrink-0" />
      <p className="font-body text-sm text-brand-dark font-medium">
        {name}'s birthday is in {days} days — approve their 30-day email.
      </p>
    </div>
  );
}