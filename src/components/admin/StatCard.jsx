import React from "react";

export default function StatCard({ value, label, onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`bg-brand-cream-card rounded-2xl shadow-sm px-3 py-5 flex flex-col items-center text-center w-full ${onClick ? "min-h-[44px] transition-transform active:scale-[0.98] hover:shadow-md" : ""}`}
    >
      <span className="font-display text-3xl sm:text-4xl font-bold text-brand-teal leading-none">{value}</span>
      <span className="font-body text-xs text-brand-dark/50 mt-2 leading-tight">{label}</span>
    </Tag>
  );
}