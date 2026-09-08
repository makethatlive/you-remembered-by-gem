import React, { useState } from "react";
import { ImageOff } from "lucide-react";

// Manual gift entry form used in the Swap flow's "Manual" mode.
// Gem fills in a gift by hand; on submit it is saved as the replacement GiftItem.
// Collects every column needed to populate a GiftItem row.
const FIELDS = [
  { key: "title", label: "Product name", type: "text", required: true },
  { key: "product_url", label: "Product link", type: "url", required: true },
  { key: "image_url", label: "Image link", type: "url", required: true },
  { key: "price", label: "Price (GBP)", type: "number", required: true },
  { key: "retailer_name", label: "Retailer", type: "text" },
  { key: "affiliate_url", label: "Affiliate link (optional)", type: "url" },
  { key: "description", label: "Short description", type: "textarea" },
  { key: "why_this_gift", label: "Why this gift", type: "textarea" },
];

export default function ManualGiftForm({ onSubmit, onCancel, busy }) {
  const [values, setValues] = useState({});
  const [preview, setPreview] = useState(false);
  // If the previewed URL fails to load, swap the <img> for a clear placeholder so Gem
  // knows the link is bad. onError fires once and removes the <img>, so it can never loop.
  const [previewBroken, setPreviewBroken] = useState(false);

  const set = (k, v) => setValues((prev) => ({ ...prev, [k]: v }));

  const canSubmit =
    values.title?.trim() &&
    values.product_url?.trim() &&
    values.image_url?.trim() &&
    values.price !== "" &&
    values.price != null &&
    !isNaN(Number(values.price));

  const submit = () => {
    if (!canSubmit || busy) return;
    onSubmit({
      title: values.title.trim(),
      product_url: values.product_url.trim(),
      image_url: values.image_url.trim(),
      price: Number(values.price),
      retailer_name: values.retailer_name?.trim() || undefined,
      affiliate_url: values.affiliate_url?.trim() || values.product_url.trim(),
      description: values.description?.trim() || "",
      why_this_gift: values.why_this_gift?.trim() || "",
    });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {FIELDS.map((f) => (
          <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
            <label className="block font-body text-xs font-semibold text-brand-dark/60 mb-1">
              {f.label}
              {f.required && <span className="text-brand-teal"> *</span>}
            </label>
            {f.type === "textarea" ? (
              <textarea
                value={values[f.key] || ""}
                onChange={(e) => set(f.key, e.target.value)}
                className="w-full min-h-20 rounded-xl border border-brand-teal/20 bg-white px-3 py-2 font-body text-sm text-brand-dark outline-none focus:border-brand-teal"
              />
            ) : (
              <input
                type={f.type}
                value={values[f.key] || ""}
                onChange={(e) => {
                  set(f.key, e.target.value);
                  if (f.key === "image_url") {
                    setPreview(false);
                    setPreviewBroken(false);
                  }
                }}
                className="w-full rounded-xl border border-brand-teal/20 bg-white px-3 py-2 font-body text-sm text-brand-dark outline-none focus:border-brand-teal"
              />
            )}
          </div>
        ))}
      </div>

      {values.image_url?.trim() && (
        <div>
          <button
            type="button"
            onClick={() => setPreview(true)}
            className="font-body text-xs text-brand-teal font-medium underline"
          >
            Preview image
          </button>
          {preview && (
            <div className="h-32 w-32 rounded-xl overflow-hidden bg-brand-gold-soft/30 mt-2">
              {previewBroken ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                  <ImageOff className="w-6 h-6 text-brand-dark/30" />
                  <p className="font-body text-sm text-brand-dark/50">Image failed to load</p>
                </div>
              ) : (
                <img
                  src={values.image_url}
                  alt="Preview"
                  onError={() => setPreviewBroken(true)}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 pt-1">
        <button
          disabled={!canSubmit || busy}
          onClick={submit}
          className="bg-brand-teal text-brand-cream font-body font-medium rounded-xl py-3 min-h-[44px] hover:bg-brand-teal-dark disabled:opacity-50"
        >
          Swap in this gift
        </button>
        <button
          disabled={busy}
          onClick={onCancel}
          className="border border-brand-teal/30 text-brand-teal font-body font-medium rounded-xl py-3 min-h-[44px] hover:bg-brand-teal/5 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}