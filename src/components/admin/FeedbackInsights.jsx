import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { Heart, ThumbsDown, ShoppingBag, Sparkles } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { formatDateTime } from "@/lib/format";
import { toast } from "@/components/ui/use-toast";
import { useAdminData } from "@/lib/useAdminData";
import StatCard from "./StatCard";

// Local copy — ApprovalDetail's REMOVAL_REASONS is not exported.
const REASON_LABELS = {
  wrong_age: "Wrong age",
  wrong_audience: "Wrong audience",
  not_relevant: "Not relevant",
  too_generic: "Too generic",
  duplicate: "Duplicate",
  poor_quality: "Poor quality",
  bad_link_or_data: "Broken link/data",
  other: "Other",
};

export default function FeedbackInsights() {
  const { items } = useAdminData();
  const queryClient = useQueryClient();
  const [refreshingTrends, setRefreshingTrends] = useState(false);

  const { data } = useQuery({
    queryKey: ["trendstats"],
    queryFn: () => base44.entities.TrendStats.filter({ stat_key: "global" }),
  });
  const trend = data?.[0] || null;

  const purchased = items.filter((i) => {
    const action = i.subscriberAction || i.subscriber_action;
    return action === "PURCHASED" || action === "purchased";
  }).length;
  const loved = items.filter((i) => i.feedback === "LOVED_IT" || i.feedback === "loved_it").length;
  const bad = items.filter((i) => i.feedback === "BAD_SUGGESTION" || i.feedback === "bad_suggestion").length;
  const totalFeedback = loved + bad;
  const qualityScore = totalFeedback ? Math.round((loved / totalFeedback) * 100) : 0;

  const pieData = [
    { name: "Loved It", value: loved, color: "#0d4a4a" },
    { name: "Not Right", value: bad, color: "#c9a96e" },
  ];

  const retailerCounts = items.reduce((acc, i) => {
    const r = i.retailerName || i.retailer_name;
    if (r) acc[r] = (acc[r] || 0) + 1;
    return acc;
  }, {});
  const barData = Object.entries(retailerCounts)
    .map(([name, count]) => ({ name: name.length > 14 ? name.slice(0, 12) + "…" : name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const categoryData = ((trend?.categoryStats || trend?.category_stats) || [])
    .slice()
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 8)
    .map((s) => {
      const name = String(s.key || "");
      return { name: name.length > 14 ? name.slice(0, 12) + "…" : name, score: s.score };
    });

  const reasonRows = ((trend?.rejectionReasonCounts || trend?.rejection_reason_counts) || [])
    .slice()
    .sort((a, b) => (b.count || 0) - (a.count || 0));

  const refreshTrends = async () => {
    setRefreshingTrends(true);
    try {
      const res = await base44.functions.invoke("computeTrendStats", {});
      if (res?.data?.error) throw new Error(res.data.error);
      await queryClient.invalidateQueries({ queryKey: ["trendstats"] });
      toast({ description: "Trend stats refreshed." });
    } catch (err) {
      toast({
        description:
          err?.response?.data?.error ||
          err?.message ||
          "Couldn't refresh trend stats — please try again.",
      });
    } finally {
      setRefreshingTrends(false);
    }
  };

  return (
    <div className="max-w-8xl mx-auto px-8 sm:px-12 lg:px-16 pt-6 pb-16">
      <h1 className="font-display text-3xl text-brand-dark mb-6">Feedback {"&"} Insights</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard value={purchased} label="Items Purchased" />
        <StatCard value={loved} label="Loved It" />
        <StatCard value={bad} label="Not Right" />
        <StatCard value={`${qualityScore}%`} label="AI Quality Score" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-brand-cream-card rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-brand-gold" />
            <h2 className="font-display text-lg text-brand-dark">Curation Quality</h2>
          </div>
          <div className="flex items-center">
            <div className="w-40 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" innerRadius={42} outerRadius={62} paddingAngle={3}>
                    {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3 flex-1">
              <Row icon={Heart} color="text-rose-500" label="Loved It" value={loved} />
              <Row icon={ThumbsDown} color="text-brand-amber" label="Not Right" value={bad} />
              <Row icon={ShoppingBag} color="text-brand-teal" label="Purchased" value={purchased} />
            </div>
          </div>
        </div>

        <div className="bg-brand-cream-card rounded-2xl shadow-sm p-5">
          <h2 className="font-display text-lg text-brand-dark mb-3">Top Retailers Curated</h2>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: "#1a1a2e" }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: "rgba(201,169,110,0.1)" }} />
                <Bar dataKey="count" fill="#c9a96e" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <button
          disabled={refreshingTrends}
          onClick={refreshTrends}
          className="w-full border border-brand-gold/60 text-brand-teal font-body text-sm font-medium rounded-xl py-2.5 min-h-[44px] mb-3 hover:bg-brand-gold-soft/20 disabled:opacity-50"
        >
          {refreshingTrends ? "Refreshing…" : "Refresh trend stats"}
        </button>
        <p className="font-body text-sm text-brand-dark/70">
          {trend ? `Last computed: ${formatDateTime(trend.computedAt || trend.computed_at)}` : "Never computed yet"}
        </p>
      </div>

      {trend && (
        <div className="bg-brand-cream-card rounded-2xl shadow-sm p-5 mt-4">
          <h2 className="font-display text-lg text-brand-dark mb-3">What's Trending</h2>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: "#1a1a2e" }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: "rgba(201,169,110,0.1)" }} />
                <Bar dataKey="score" fill="#0d4a4a" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <h3 className="font-display text-base text-brand-dark font-semibold mt-4 mb-2">Why gifts were removed</h3>
          <div className="space-y-3">
            {reasonRows.map((r) => (
              <Row
                key={r.reason}
                icon={ThumbsDown}
                color="text-brand-amber"
                label={REASON_LABELS[r.reason] || r.reason}
                value={r.count}
              />
            ))}
          </div>

          <h3 className="font-display text-base text-brand-dark font-semibold mt-4 mb-2">Recently loved</h3>
          <div className="space-y-3">
            {((trend.recentLovedTitles || trend.recent_loved_titles) || []).map((title, i) => (
              <Row key={`loved-${i}`} icon={Heart} color="text-rose-500" label={title} value="" />
            ))}
          </div>

          <h3 className="font-display text-base text-brand-dark font-semibold mt-4 mb-2">Recently rejected</h3>
          <div className="space-y-3">
            {((trend.recentRejectedTitles || trend.recent_rejected_titles) || []).map((title, i) => (
              <Row key={`rejected-${i}`} icon={ThumbsDown} color="text-brand-amber" label={title} value="" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ icon: Icon, color, label, value }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className={`w-4 h-4 ${color}`} />
      <span className="font-body text-sm text-brand-dark/70 flex-1">{label}</span>
      <span className="font-display text-base text-brand-dark font-semibold">{value}</span>
    </div>
  );
}