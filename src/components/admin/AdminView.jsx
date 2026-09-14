import React, { useState } from "react";
import AdminHeader from "./AdminHeader";
import AdminNav from "./AdminNav";
import AdminDashboard from "./AdminDashboard";
import ApprovalQueue from "./ApprovalQueue";
import SubscribersTab from "./SubscribersTab";
import RetailersTab from "./RetailersTab";
import ProductsTab from "./ProductsTab";
import BirthdayCalendar from "./BirthdayCalendar";
import SentHistory from "./SentHistory";
import FeedbackInsights from "./FeedbackInsights";
import UsersTab from "./UsersTab";
import ForensicsAuditPanel from "./ForensicsAuditPanel";
import HelpTab from "@/components/admin/HelpTab";
import AICallLogs from "./AICallLogs";

export default function AdminView() {
  // Deep-link support: admin alert emails link to /?tab=approvals&list=<id>.
  const urlParams = new URLSearchParams(window.location.search);
  const [tab, setTab] = useState(urlParams.get("tab") || "dashboard");
  const initialListId = urlParams.get("list") || null;

  return (
    <div className="min-h-screen">
      <AdminHeader />
      <AdminNav active={tab} onChange={setTab} />
      {tab === "dashboard" && <AdminDashboard onGoTab={setTab} />}
      {tab === "approvals" && <ApprovalQueue onGoTab={setTab} initialListId={initialListId} />}
      {tab === "subscribers" && <SubscribersTab />}
      {tab === "retailers" && <RetailersTab />}
      {tab === "products" && <ProductsTab />}
      {tab === "calendar" && <BirthdayCalendar />}
      {tab === "sent" && <SentHistory />}
      {tab === "insights" && <FeedbackInsights />}
      {tab === "audit" && <ForensicsAuditPanel />}
      {tab === "ai-logs" && <AICallLogs />}
      {/* {tab === "users" && <UsersTab />} */} {/* Hidden per admin request */}
      {tab === "help" && <HelpTab />}
    </div>
  );
}