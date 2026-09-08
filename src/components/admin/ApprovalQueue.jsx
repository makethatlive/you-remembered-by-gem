import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Cake, ChevronRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { daysUntil, LIST_LABEL, formatShortDate, formatDateTime } from "@/lib/format";
import { useAdminData } from "@/lib/useAdminData";
import StatCard from "./StatCard";
import ApprovalDetail from "./ApprovalDetail";

export default function ApprovalQueue({ onGoTab, initialListId }) {
  const { subscribers, recipients, lists, items } = useAdminData();
  const [openListId, setOpenListId] = useState(initialListId || null);

  const subById = (id) => subscribers.find((s) => s.id === id);
  const recById = (id) => recipients.find((r) => r.id === id);
  const itemCount = (id) => items.filter((i) => i.giftListId === id).length;

  const pending = lists
    .filter((l) => l.status === "PENDING_APPROVAL")
    .sort((a, b) => daysUntil(a.birthdayDate) - daysUntil(b.birthdayDate));

  const birthdaysThisWeek = recipients.filter((r) => {
    const d = daysUntil(r.birthday);
    return d != null && d <= 7;
  }).length;
  const feedbackCount = items.filter((i) => i.feedback).length;

  // The bulk "lists" array (useAdminData) can be briefly stale right after a regenerate
  // creates a brand-new GiftList record, which made the detail view fall back to the
  // queue instead of showing the fresh list. Fetch the open list directly by id as a
  // fallback so it's always found regardless of that cache timing.
  const { data: fetchedOpenList } = useQuery({
    queryKey: ["giftlist-single", openListId],
    queryFn: () => base44.entities.GiftList.get(openListId),
    enabled: !!openListId,
  });
  const openList = openListId
    ? lists.find((l) => l.id === openListId) || fetchedOpenList || null
    : null;
  if (openList) {
    return (
      <ApprovalDetail
        list={openList}
        subscriber={subById(openList.subscriberId)}
        recipient={recById(openList.recipientId)}
        onBack={() => setOpenListId(null)}
        onRegenerated={setOpenListId}
      />
    );
  }

  return (
    <div className="max-w-8xl mx-auto px-8 sm:px-12 lg:px-16 pt-6 pb-16">
      <h1 className="font-display text-3xl text-brand-dark text-center mb-6">Approval Queue</h1>

      <div className="grid grid-cols-4 gap-2.5 sm:gap-3 mb-5">
        <StatCard value={subscribers.filter((s) => {
          const status = s.subscriptionStatus || s.subscription_status;
          return status === "ACTIVE" || status === "active";
        }).length} label="Active Subscribers" onClick={() => onGoTab?.("subscribers")} />
        <StatCard value={pending.length} label="Pending Approvals" onClick={() => onGoTab?.("approvals")} />
        <StatCard value={birthdaysThisWeek} label="Birthday This Week" onClick={() => onGoTab?.("calendar")} />
        <StatCard value={feedbackCount} label="Feedback Items" onClick={() => onGoTab?.("insights")} />
      </div>

      <div className="space-y-3">
        {pending.map((l) => {
          const recipient = recById(l.recipientId);
          const subscriber = subById(l.subscriberId);
          const count = itemCount(l.id);
          return (
            <button
              key={l.id}
              onClick={() => setOpenListId(l.id)}
              className="w-full text-left bg-brand-cream-card rounded-2xl shadow-sm p-5 flex items-center justify-between gap-3 hover:shadow-md transition-shadow"
            >
              <div className="min-w-0">
                <p className="font-display text-base text-brand-dark font-semibold">{recipient?.name}</p>
                <p className="font-body text-sm text-brand-dark/50 truncate">
                  For {subscriber?.name} · {LIST_LABEL[l.listType]} · {count} {count === 1 ? "gift" : "gifts"}
                </p>
                <p className="font-body text-xs text-brand-dark/40 mt-1">
                  Generated {formatDateTime(l.generatedAt || l.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="flex items-center gap-1 font-body text-sm text-brand-dark/60">
                  <Cake className="w-4 h-4 text-brand-gold" /> {formatShortDate(l.birthdayDate)}
                </span>
                <ChevronRight className="w-5 h-5 text-brand-dark/30" />
              </div>
            </button>
          );
        })}

        {pending.length === 0 && (
          <div className="flex flex-col items-center text-center py-14">
            <p className="font-body text-sm text-brand-dark/50">
              You're all caught up — no lists waiting for review.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}