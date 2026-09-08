import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import SubscriberView from "../components/subscriber/SubscriberView";

// Dedicated URL for the "My People" recipient directory. Reuses SubscriberView,
// opened straight on the People tab. Admins have no My People view → send to dashboard.
export default function People() {
  const { user } = useAuth();
  const urlParams = new URLSearchParams(window.location.search);
  const editRecipientId = urlParams.get("edit") || null;

  if (user?.role === "admin") {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="app-scroll bg-brand-cream font-body text-brand-dark">
      <SubscriberView initialTab="people" initialEditRecipientId={editRecipientId} />
    </div>
  );
}