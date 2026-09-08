import React from "react";
import { ChevronRight, Clock, Users, Send, Gift } from "lucide-react";
import { daysUntil } from "@/lib/format";
import { useAdminData } from "@/lib/useAdminData";
import StatCard from "./StatCard";

export default function AdminDashboard({ onGoTab }) {
  const { subscribers, recipients, lists, items } = useAdminData();

  const pending = lists.filter((l) => {
    const status = l.status;
    return status === "PENDING_APPROVAL" || status === "pending_approval";
  });
  const sent = lists.filter((l) => {
    const status = l.status;
    return status === "SENT" || status === "sent";
  });
  const ready = lists.filter((l) => {
    const status = l.status;
    const visible = l.visibleToSubscriber ?? l.visible_to_subscriber;
    return (status === "APPROVED" || status === "approved" || status === "SENT" || status === "sent") && visible !== false;
  });
  const comingSoon = ready.filter((l) => daysUntil(l.birthdayDate || l.birthday_date) > 30);
  const urgentList = pending
    .map((l) => ({ l, d: daysUntil(l.birthdayDate || l.birthday_date) }))
    .filter((x) => x.d != null && x.d <= 31)
    .sort((a, b) => a.d - b.d)[0];
  const urgentRecip = urgentList ? recipients.find((r) => r.id === urgentList.l.recipientId) : null;

  const links = [
    { id: "approvals", label: "Review Approval Queue", icon: Clock, count: pending.length },
    { id: "subscribers", label: "Manage Subscribers", icon: Users, count: subscribers.length },
    { id: "calendar", label: "Birthday Calendar", icon: Gift, count: recipients.length },
    { id: "sent", label: "Sent History", icon: Send, count: sent.length },
  ];

  return (
    <div className="max-w-8xl mx-auto px-8 sm:px-12 lg:px-16 pt-6 pb-16">
      <h1 className="font-display text-3xl text-brand-dark mb-1">Hello Gemma</h1>
      <p className="font-body text-sm text-brand-dark/50 mb-6">Here's how your members are looking today.</p>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-3 mb-5">
        <StatCard value={subscribers.filter((s) => {
          const status = s.subscriptionStatus || s.subscription_status;
          return status === "ACTIVE" || status === "active";
        }).length} label="Active Subscribers" onClick={() => onGoTab("subscribers")} />
        <StatCard value={pending.length} label="Pending Approvals" onClick={() => onGoTab("approvals")} />
        <StatCard value={recipients.filter((r) => { const d = daysUntil(r.birthday); return d != null && d <= 7; }).length} label="Birthday This Week" onClick={() => onGoTab("calendar")} />
        <StatCard value={comingSoon.length} label="Coming Soon" onClick={() => onGoTab("sent")} />
        <StatCard value={items.filter((i) => i.feedback).length} label="Feedback Items" onClick={() => onGoTab("insights")} />
      </div>

      <div className="space-y-3">
        {links.map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            onClick={() => onGoTab(id)}
            className="w-full flex items-center gap-3 bg-brand-cream-card rounded-2xl shadow-sm px-5 py-4 min-h-[44px] text-left hover:bg-brand-gold-soft/20"
          >
            <div className="w-10 h-10 rounded-full bg-brand-teal/10 flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5 text-brand-teal" />
            </div>
            <span className="flex-1 font-body font-medium text-brand-dark">{label}</span>
            <span className="font-display text-lg text-brand-gold font-semibold">{count}</span>
            <ChevronRight className="w-5 h-5 text-brand-dark/30" />
          </button>
        ))}
      </div>
    </div>
  );
}
