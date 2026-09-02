import React from "react";
import { BadgeCheck, CalendarDays } from "lucide-react";
import { STATUS_LABEL, formatDate } from "@/lib/format";

export default function AccountTab({ subscriber }) {
  if (!subscriber) return null;
  return (
    <div className="max-w-6xl mx-auto px-5 pt-6">
      <h1 className="font-display text-2xl sm:text-3xl text-brand-dark mb-6">Account</h1>

      <div className="bg-brand-teal rounded-2xl p-6 text-brand-cream shadow-sm">
        <p className="font-display text-xl">{subscriber.name}</p>
        <p className="font-body text-sm text-brand-cream/70">{subscriber.email}</p>
        <div className="mt-4 inline-flex items-center gap-1.5 bg-brand-gold/90 text-brand-teal rounded-full px-3 py-1">
          <BadgeCheck className="w-4 h-4" />
          <span className="font-body text-xs font-semibold">
            {STATUS_LABEL[subscriber.subscriptionStatus] || "Active"} Membership
          </span>
        </div>
      </div>

      <div className="bg-brand-cream-card rounded-2xl shadow-sm p-5 mt-4 space-y-4">
        <div className="flex items-center gap-3">
          <CalendarDays className="w-5 h-5 text-brand-gold" />
          <div>
            <p className="font-body text-xs text-brand-dark/50">Subscribed since</p>
            <p className="font-body text-sm text-brand-dark font-medium">{formatDate(subscriber.subscribed_since)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}