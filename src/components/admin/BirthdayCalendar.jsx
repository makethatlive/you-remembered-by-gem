import React from "react";
import { Cake } from "lucide-react";
import { daysUntil, countdownTone, formatDate } from "@/lib/format";
import { useAdminData } from "@/lib/useAdminData";

const toneDot = { red: "bg-red-500", amber: "bg-brand-amber", green: "bg-emerald-500", neutral: "bg-brand-dark/30" };
const toneText = { red: "text-red-500", amber: "text-brand-amber", green: "text-emerald-600", neutral: "text-brand-dark/40" };

export default function BirthdayCalendar() {
  const { recipients, subscribers } = useAdminData();
  const subName = (id) => subscribers.find((s) => s.id === id)?.name?.split(" ")[0] || "";

  const upcoming = recipients
    .map((r) => ({ ...r, _days: daysUntil(r.birthday) }))
    .filter((r) => r._days != null && r._days <= 60)
    .sort((a, b) => a._days - b._days);

  return (
    <div className="max-w-8xl mx-auto px-5 pt-6 pb-16">
      <h1 className="font-display text-3xl text-brand-dark mb-1">Birthday Calendar</h1>
      <p className="font-body text-sm text-brand-dark/50 mb-6">Next 60 days across all members.</p>

      <div className="relative pl-6">
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-brand-gold/30" />
        <div className="space-y-3">
          {upcoming.map((r) => {
            const tone = countdownTone(r._days);
            return (
              <div key={r.id} className="relative">
                <span className={`absolute -left-[22px] top-5 w-3.5 h-3.5 rounded-full ring-4 ring-brand-cream ${toneDot[tone]}`} />
                <div className="bg-brand-cream-card rounded-2xl shadow-sm p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Cake className="w-5 h-5 text-brand-gold" />
                    <div>
                      <p className="font-display text-base text-brand-dark leading-tight">{r.name}</p>
                      <p className="font-body text-xs text-brand-dark/50">
                        {r.relationship} · {subName(r.subscriber_id)}'s list · {formatDate(r.birthday)}
                      </p>
                    </div>
                  </div>
                  <span className={`font-body text-sm font-semibold ${toneText[tone]}`}>
                    {r._days}d
                  </span>
                </div>
              </div>
            );
          })}
          {upcoming.length === 0 && (
            <p className="font-body text-sm text-brand-dark/50 py-10 text-center">No birthdays in the next 60 days.</p>
          )}
        </div>
      </div>
    </div>
  );
}