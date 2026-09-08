import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import SubscriberHeader from "./SubscriberHeader";
import BottomTabBar from "./BottomTabBar";
import Dashboard from "./Dashboard";
import MyPeople from "./MyPeople";
import RecipientForm from "./RecipientForm";
import GiftListsTab from "./GiftListsTab";
import GiftListView from "./GiftListView";
import AccountTab from "./AccountTab";

export default function SubscriberView({ initialTab = "dashboard", initialEditRecipientId = null }) {
  const [tab, setTab] = useState(initialTab);
  const [viewingListId, setViewingListId] = useState(null);
  const [editingRecipient, setEditingRecipient] = useState(null); // null | {} | record
  const [pendingEditId, setPendingEditId] = useState(initialEditRecipientId);

  const { user } = useAuth();
  // Match by auth user id first, falling back to email — mirrors Home.jsx's lookup so
  // a subscriber only ever found by email still renders here instead of getting stuck
  // on "Setting up your account...".
  const { data: subscriber = null, isLoading } = useQuery({
    queryKey: ["my-subscriber", user?.id],
    queryFn: async () => {
      const ownedByUser = await base44.entities.Subscriber.filter({ created_by_id: user.id });
      if (ownedByUser.length > 0) return ownedByUser[0];
      // A record created by the Stripe webhook is owned by the service, so this user
      // cannot read it — never gate linkage on being able to see it. Link server-side
      // unconditionally, then re-check for an owned record.
      try {
        await base44.functions.invoke("completePaidSignup", {});
      } catch {
        // Linkage is best-effort — fall through to the lookups below.
      }
      const linked = await base44.entities.Subscriber.filter({ created_by_id: user.id });
      if (linked.length > 0) return linked[0];
      // By-email match purely as a display fallback — fine for this to come back empty.
      const byEmail = user?.email ? await base44.entities.Subscriber.filter({ email: user.email }) : [];
      if (byEmail.length === 0) return null;
      return byEmail[0];
    },
    enabled: !!user,
  });

  // Deep-link support: emails link straight to a specific recipient's edit form
  // (e.g. "Update [Name]'s profile"). Once the subscriber is loaded, open it directly.
  // The recipient must belong to this subscriber — otherwise the URL param is ignored.
  useEffect(() => {
    if (!pendingEditId || !subscriber) return;
    let active = true;
    base44.entities.Recipient.get(pendingEditId)
      .then((r) => {
        if (active && r && r.subscriberId === subscriber.id) {
          setEditingRecipient(r);
          setTab("people");
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setPendingEditId(null);
      });
    return () => {
      active = false;
    };
  }, [pendingEditId, subscriber]);

  const openList = (id) => {
    setViewingListId(id);
    setTab("giftlists");
  };
  const goTab = (t) => {
    setViewingListId(null);
    setEditingRecipient(null);
    setTab(t);
  };

  const renderContent = () => {
    if (!subscriber) {
      return (
        <p className="text-center text-brand-dark/40 font-body pt-20">
          {isLoading ? "Loading…" : "Setting up your account…"}
        </p>
      );
    }
    if (tab === "dashboard") {
      return <Dashboard subscriber={subscriber} onOpenList={openList} onGoTab={goTab} />;
    }
    if (tab === "people") {
      if (editingRecipient !== null) {
        return (
          <RecipientForm
            subscriber={subscriber}
            recipient={editingRecipient}
            onDone={() => setEditingRecipient(null)}
          />
        );
      }
      return (
        <MyPeople
          subscriber={subscriber}
          onEdit={(r) => setEditingRecipient(r)}
          onAdd={() => setEditingRecipient({})}
        />
      );
    }
    if (tab === "giftlists") {
      if (viewingListId) {
        return (
          <GiftListView
            listId={viewingListId}
            onBack={() => setViewingListId(null)}
            onEditProfile={(r) => {
              setViewingListId(null);
              setEditingRecipient(r);
              setTab("people");
            }}
          />
        );
      }
      return <GiftListsTab subscriber={subscriber} onOpen={openList} />;
    }
    return <AccountTab subscriber={subscriber} />;
  };

  return (
    <div className="pb-24">
      <SubscriberHeader />
      {renderContent()}
      <BottomTabBar active={tab} onChange={goTab} />
    </div>
  );
}