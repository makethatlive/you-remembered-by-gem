import React from "react";
import { Mail, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useAdminData } from "@/lib/useAdminData";
import { formatDate } from "@/lib/format";

const TYPE_LABEL = {
  welcome: "Welcome",
  onboarding_reminder: "Onboarding Reminder",
  "6_week_reminder": "6-Week Reminder",
  "30_day": "30-Day Preview",
  "14_day": "14-Day Reminder",
  "7_day": "7-Day Final Call",
  post_occasion: "Post-Occasion Feedback",
  post_birthday_feedback: "Post-Birthday Feedback",
};
const statusIcon = { sent: CheckCircle2, failed: XCircle, pending: Clock };
const statusColor = { sent: "text-emerald-600", failed: "text-red-500", pending: "text-brand-amber" };

export default function SentHistory() {
  const { emails, subscribers, recipients } = useAdminData();
  const subName = (id) => subscribers.find((s) => s.id === id)?.name || "—";
  const recName = (id) => recipients.find((r) => r.id === id)?.name || "—";

  const sorted = [...emails].sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at));

  return (
    <div className="max-w-8xl mx-auto px-5 pt-6 pb-16">
      <h1 className="font-display text-3xl text-brand-dark mb-6">Sent History</h1>
      <div className="space-y-3">
        {sorted.map((e) => {
          const Icon = statusIcon[e.status] || CheckCircle2;
          return (
            <div key={e.id} className="bg-brand-cream-card rounded-2xl shadow-sm p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-brand-teal/10 flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5 text-brand-teal" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-body font-medium text-brand-dark text-sm">{TYPE_LABEL[e.email_type] || e.email_type || "Unknown type"}</p>
                <p className="font-body text-xs text-brand-dark/50 truncate">
                  {subName(e.subscriber_id)} · for {recName(e.recipient_id)}
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className={`flex items-center gap-1 justify-end font-body text-xs font-medium ${statusColor[e.status]}`}>
                  <Icon className="w-3.5 h-3.5" /> {e.status}
                </span>
                <p className="font-body text-xs text-brand-dark/40 mt-0.5">{formatDate(e.sent_at)}</p>
              </div>
            </div>
          );
        })}
        {sorted.length === 0 && (
          <p className="font-body text-sm text-brand-dark/50 py-10 text-center">No emails sent yet.</p>
        )}
      </div>
    </div>
  );
}