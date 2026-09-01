import React, { useState } from "react";

const fields = [
  { key: "title", label: "Title", type: "text" },
  { key: "retailer_name", label: "Retailer", type: "text" },
  { key: "price", label: "Price", type: "number" },
  { key: "product_url", label: "Product URL", type: "text" },
  { key: "image_url", label: "Image URL", type: "text" },
  { key: "description", label: "Description", type: "textarea" },
  { key: "why_this_gift", label: "Gem's note", type: "textarea" },
];

export default function ApprovalItemEditor({ item, onSave, onCancel }) {
  const [draft, setDraft] = useState({ ...item });

  const updateField = (key, value) => {
    setDraft((current) => ({
      ...current,
      [key]: key === "price" ? Number(value) : value,
    }));
  };

  return (
    <div className="mt-3 rounded-xl border border-brand-gold/40 bg-brand-cream-card p-3 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fields.map((field) => (
          <label key={field.key} className={field.type === "textarea" ? "sm:col-span-2" : ""}>
            <span className="block font-body text-xs font-semibold text-brand-dark/60 mb-1">{field.label}</span>
            {field.type === "textarea" ? (
              <textarea
                value={draft[field.key] || ""}
                onChange={(event) => updateField(field.key, event.target.value)}
                className="w-full min-h-20 rounded-lg border border-brand-teal/20 bg-white px-3 py-2 font-body text-sm text-brand-dark outline-none focus:border-brand-teal"
              />
            ) : (
              <input
                type={field.type}
                value={draft[field.key] || ""}
                onChange={(event) => updateField(field.key, event.target.value)}
                className="w-full rounded-lg border border-brand-teal/20 bg-white px-3 py-2 font-body text-sm text-brand-dark outline-none focus:border-brand-teal"
              />
            )}
          </label>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onSave(draft)}
          className="bg-brand-teal text-brand-cream font-body text-sm font-medium rounded-xl py-2.5 min-h-[44px] hover:bg-brand-teal-dark"
        >
          Save Item
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="border border-brand-teal/30 text-brand-teal font-body text-sm font-medium rounded-xl py-2.5 min-h-[44px] hover:bg-brand-teal/5"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}