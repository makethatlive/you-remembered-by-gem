import React, { useState } from "react";
import { Users, ChevronRight, UserPlus } from "lucide-react";
import { STATUS_LABEL, formatDate } from "@/lib/format";
import { useAdminData } from "@/lib/useAdminData";
import SubscriberDetail from "./SubscriberDetail";
import InviteUserForm from "./InviteUserForm";

const statusColor = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  TRIALLING: "bg-blue-100 text-blue-700",
  PAST_DUE: "bg-amber-100 text-amber-700",
  CANCELLED: "bg-red-100 text-red-700",
  // Legacy lowercase support
  active: "bg-emerald-100 text-emerald-700",
  trialling: "bg-blue-100 text-blue-700",
  past_due: "bg-amber-100 text-amber-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function SubscribersTab() {
  const { subscribers, recipients, lists } = useAdminData();
  const [openId, setOpenId] = useState(null);
  const [inviting, setInviting] = useState(false);
  const countRecip = (id) => recipients.filter((r) => r.subscriber_id === id).length;
  const countLists = (id) => lists.filter((l) => l.subscriber_id === id).length;

  const openSub = openId ? subscribers.find((s) => s.id === openId) : null;
  if (openSub) {
    return <SubscriberDetail subscriber={openSub} onBack={() => setOpenId(null)} />;
  }

  return (
    <div className="max-w-8xl mx-auto px-5 pt-6 pb-16">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl text-brand-dark">Subscribers</h1>
        {!inviting && (
          <button
            onClick={() => setInviting(true)}
            className="inline-flex items-center gap-1.5 bg-brand-teal text-brand-cream font-body text-sm font-medium rounded-full px-4 py-2.5 min-h-[44px] hover:bg-brand-teal-dark"
          >
            <UserPlus className="w-4 h-4" /> Invite Person
          </button>
        )}
      </div>

      {inviting && <InviteUserForm onDone={() => setInviting(false)} />}

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {subscribers.map((s) => (
          <button key={s.id} onClick={() => setOpenId(s.id)} className="w-full text-left bg-brand-cream-card rounded-2xl shadow-sm p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-display text-lg text-brand-dark">{s.name}</p>
                <p className="font-body text-sm text-brand-dark/50">{s.email}</p>
              </div>
              <span className={`text-xs font-body font-medium px-2.5 py-1 rounded-full ${statusColor[s.subscriptionStatus] || statusColor.ACTIVE}`}>
                {STATUS_LABEL[s.subscriptionStatus]}
              </span>
            </div>
            <div className="flex gap-6 mt-3 font-body text-sm text-brand-dark/60">
              <span><b className="text-brand-teal">{countRecip(s.id)}</b> people</span>
              <span><b className="text-brand-teal">{countLists(s.id)}</b> lists</span>
              <span className="ml-auto text-brand-dark/40">Since {formatDate(s.subscribed_since)}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-brand-cream-card rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="text-left font-body text-xs uppercase tracking-wide text-brand-dark/40 border-b border-brand-gold/15">
              <th className="px-5 py-3">Member</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">People</th>
              <th className="px-5 py-3">Lists</th>
              <th className="px-5 py-3">Since</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {subscribers.map((s) => (
              <tr key={s.id} onClick={() => setOpenId(s.id)} className="border-b border-brand-gold/10 last:border-0 cursor-pointer hover:bg-brand-gold-soft/20">
                <td className="px-5 py-4">
                  <p className="font-display text-base text-brand-dark">{s.name}</p>
                  <p className="font-body text-xs text-brand-dark/50">{s.email}</p>
                </td>
                <td className="px-5 py-4">
                  <span className={`text-xs font-body font-medium px-2.5 py-1 rounded-full ${statusColor[s.subscriptionStatus] || statusColor.ACTIVE}`}>
                    {STATUS_LABEL[s.subscriptionStatus]}
                  </span>
                </td>
                <td className="px-5 py-4 font-body text-sm text-brand-dark">{countRecip(s.id)}</td>
                <td className="px-5 py-4 font-body text-sm text-brand-dark">{countLists(s.id)}</td>
                <td className="px-5 py-4 font-body text-sm text-brand-dark/50">{formatDate(s.subscribed_since)}</td>
                <td className="px-5 py-4 text-right"><ChevronRight className="w-5 h-5 text-brand-dark/30 inline" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {subscribers.length === 0 && (
        <div className="flex flex-col items-center py-14 text-brand-dark/40">
          <Users className="w-8 h-8 mb-2" />
          <p className="font-body text-sm">No subscribers yet.</p>
        </div>
      )}
    </div>
  );
}