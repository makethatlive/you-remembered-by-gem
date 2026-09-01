import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import SubscriberView from "../components/subscriber/SubscriberView";
import AdminView from "../components/admin/AdminView";
import RoleSwitcher from "../components/RoleSwitcher";

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ensuringSubscriber, setEnsuringSubscriber] = useState(true);
  // Admin-only view toggle: lets Gem preview exactly what a subscriber sees.
  const [viewRole, setViewRole] = useState("admin");

  // Silently ensure a Subscriber record exists for the logged-in user on first login
  // (covers Google sign-up, which never hits the Register flow). No screen, no prompt.
  // For non-admin subscribers with no recipients yet, send them to onboarding.
  useEffect(() => {
    let active = true;
    const ensureSubscriber = async () => {
      if (!user) return;
      try {
let subscriber;
        // Id of the pre-linkage record, if we started from a by-email match.
        let priorSubscriberId;
        // 1. Match by auth user id first.
        const ownedByUser = await base44.entities.Subscriber.filter({ created_by_id: user.id });
        if (ownedByUser.length > 0) {
          subscriber = ownedByUser[0];
        } else {
          // 2. No record owned by this user yet. A record created at checkout (Stripe
          //    webhook) is owned by the service, so this user cannot read it — never
          //    gate linkage on being able to see it. Link server-side unconditionally,
          //    then re-check for an owned record.
          try {
            await base44.functions.invoke("completePaidSignup", {});
          } catch (linkErr) {
            // Linkage is best-effort — fall through to the lookups below.
            console.error("subscriber linkage failed:", linkErr);
          }
          const linked = await base44.entities.Subscriber.filter({ created_by_id: user.id });
          if (linked.length > 0) {
            subscriber = linked[0];
          } else {
            // 3. Still nothing owned. Try a by-email match purely as a display
            //    fallback — it is fine for this to come back empty.
            const byEmail = user.email
              ? await base44.entities.Subscriber.filter({ email: user.email })
              : [];
            if (byEmail.length > 0) {
              subscriber = byEmail[0];
              priorSubscriberId = subscriber.id;
            } else {
              // 4. No record at all — create one silently from the auth profile.
              subscriber = await base44.entities.Subscriber.create({
                name: user.full_name || user.email,
                email: user.email,
                subscription_status: "trialling",
              });
            }
          }
        }

        // Admins always go to AdminView — never onboarding.
        if (user.role !== "admin" && subscriber?.id) {
          const recipients = await base44.entities.Recipient.filter({ subscriber_id: subscriber.id });
          let hasRecipients = recipients.length > 0;
          if (!hasRecipients && priorSubscriberId && priorSubscriberId !== subscriber.id) {
            // completePaidSignup migrates recipients onto the newly owned record on a
            // best-effort basis. If that migration failed, they still carry the prior
            // subscriber id — check it before sending an existing user to onboarding.
            const priorRecipients = await base44.entities.Recipient.filter({
              subscriber_id: priorSubscriberId,
            });
            hasRecipients = priorRecipients.length > 0;
          }
          if (active && !hasRecipients) {
            navigate("/onboarding", { replace: true });
            return;
          }
        }
      } catch (err) {
        // A failed subscriber lookup/creation must never bounce the user back to login.
        // Swallow the error and let routing resolve to the dashboard.
        console.error("ensureSubscriber failed:", err);
      } finally {
        if (active) setEnsuringSubscriber(false);
      }
    };
    ensureSubscriber();
    return () => {
      active = false;
    };
  }, [user, navigate]);

  if (ensuringSubscriber) {
    return (
      <div className="app-scroll bg-brand-cream font-body text-brand-dark flex items-center justify-center min-h-[100dvh]">
        <div className="w-8 h-8 border-4 border-brand-gold/30 border-t-brand-teal rounded-full animate-spin" />
      </div>
    );
  }

  const isAdmin = user?.role === "admin";

  return (
    <div className="app-scroll bg-brand-cream font-body text-brand-dark">
      {isAdmin && <RoleSwitcher role={viewRole} setRole={setViewRole} />}
      {isAdmin && viewRole === "admin" ? <AdminView /> : <SubscriberView />}
    </div>
  );
}