import React from "react";
import { Mail, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useAdminData } from "@/lib/useAdminData";
import { formatDate } from "@/lib/format";

const TYPE_LABEL = {
  WELCOME: "Welcome",
  ONBOARDING_REMINDER: "Onboarding Reminder",
  SIX_WEEK_REMINDER: "6-Week Reminder",
  THIRTY_DAY: "30-Day Preview",
  FOURTEEN_DAY: "14-Day Reminder",
  SEVEN_DAY: "7-Day Final Call",
  POST_OCCASION: "Post-Occasion Feedback",
  POST_BIRTHDAY_FEEDBACK: "Post-Birthday Feedback",
  // Legacy lowercase support
  welcome: "Welcome",
  onboarding_reminder: "Onboarding Reminder",
  "6_week_reminder": "6-Week Reminder",
  "30_day": "30-Day Preview",
  "14_day": "14-Day Reminder",
  "7_day": "7-Day Final Call",
  post_occasion: "Post-Occasion Feedback",
  post_birthday_feedback: "Post-Birthday Feedback",
};
const statusIcon = { SENT: CheckCircle2, FAILED: XCircle, PENDING: Clock, sent: CheckCircle2, failed: XCircle, pending: Clock };
const statusColor = { SENT: "text-emerald-600", FAILED: "text-red-500", PENDING: "text-brand-amber", sent: "text-emerald-600", failed: "text-red-500", pending: "text-brand-amber" };

export default function SentHistory() {
  const { emails, subscribers, recipients } = useAdminData();
  
  // Helper to get subscriber data (from nested or lookup)
  const getSubscriber = (email) => {
    const id = email.subscriberId || email.subscriber_id;
    // First try nested subscriber from API response
    if (email.subscriber) return email.subscriber;
    // Fallback to lookup from subscribers list
    return subscribers.find((s) => s.id === id);
  };
  
  // Helper to get recipient data (from nested or lookup)
  const getRecipient = (email) => {
    const id = email.recipientId || email.recipient_id;
    if (!id) return null;
    // First try nested recipient from API response
    if (email.recipient) return email.recipient;
    // Fallback to lookup from recipients list
    return recipients.find((r) => r.id === id);
  };

  const sorted = [...emails].sort((a, b) => new Date(b.sentAt || b.sent_at) - new Date(a.sentAt || a.sent_at));

  return (
    <div className="max-w-8xl mx-auto px-8 sm:px-12 lg:px-16 pt-6 pb-16">
      <h1 className="font-display text-3xl text-brand-dark mb-6">Sent History</h1>
      {emails.length === 0 ? (
        <p className="font-body text-sm text-brand-dark/50 py-10 text-center">No emails sent yet.</p>
      ) : (
        <div className="space-y-3">
          {sorted.map((e) => {
            const Icon = statusIcon[e.status] || CheckCircle2;
            const emailType = e.emailType || e.email_type;
            const sentAt = e.sentAt || e.sent_at;
            const subscriber = getSubscriber(e);
            const recipient = getRecipient(e);
            
            return (
              <div key={e.id} className="bg-brand-cream-card rounded-2xl shadow-sm p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-brand-teal/10 flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5 text-brand-teal" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-body font-medium text-brand-dark text-sm">
                    {TYPE_LABEL[emailType] || emailType || "Unknown type"}
                  </p>
                  <p className="font-body text-xs text-brand-dark/50 truncate">
                    To: <span className="font-medium">{subscriber?.email || "—"}</span>
                    {subscriber?.name && <> ({subscriber.name})</>}
                    {recipient && <> · Re: {recipient.name}</>}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className={`flex items-center gap-1 justify-end font-body text-xs font-medium ${statusColor[e.status]}`}>
                    <Icon className="w-3.5 h-3.5" /> {e.status}
                  </span>
                  <p className="font-body text-xs text-brand-dark/40 mt-0.5">{formatDate(sentAt)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}