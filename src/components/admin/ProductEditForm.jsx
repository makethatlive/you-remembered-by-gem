import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, Loader2, ImageOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { SOURCE_LABELS_EDIT } from "@/lib/provenance";
import { getAllowedAgeBands } from "@/lib/ageRangeUtils";

const STATUSES = ["NEEDS_REVIEW", "ACTIVE", "INACTIVE", "REPORTED_BROKEN"];

// Product.jsonc source_type enum — the only way Gem can relabel a legacy record she
// recognises as her own pick so the Gem's Pick badge can appear for it.
const SOURCE_TYPES = ["CURATED_PRODUCT", "CURATED_RETAILER", "SHOPIFY_UPLOAD", "LEGACY_UNKNOWN"];

export default function ProductEditForm({ product, retailerName, onDone }) {
  const queryClient = useQueryClient();
  
  // Normalize status to UPPERCASE for consistency
  const normalizeStatus = (status) => {
    if (!status) return "NEEDS_REVIEW";
    const upper = status.toUpperCase();
    return STATUSES.includes(upper) ? upper : "NEEDS_REVIEW";
  };
  
  // Normalize source type to UPPERCASE for consistency
  const normalizeSourceType = (sourceType) => {
    if (!sourceType) return "LEGACY_UNKNOWN";
    const upper = sourceType.toUpperCase();
    return SOURCE_TYPES.includes(upper) ? upper : "LEGACY_UNKNOWN";
  };
  
  const [form, setForm] = useState({
    name: product.name || "",
    description: product.description || "",
    price: product.price ?? "",
    affiliate_url: product.affiliateUrl || product.affiliate_url || "",
    image_url: product.imageUrl || product.image_url || "",
    category: product.category || "",
    gender_applies_to: product.genderAppliesTo || product.gender_applies_to || "",
    suitable_age_bands: product.suitableAgeBands || product.suitable_age_bands || [],
    age_restricted: product.ageRestricted ?? product.age_restricted ?? false,
    status: normalizeStatus(product.status),
    source_type: normalizeSourceType(product.sourceType || product.source_type),
    notes: product.notes || "",
  });
  const [previewBroken, setPreviewBroken] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const toggleBand = (band) =>
    setForm((f) => ({
      ...f,
      suitable_age_bands: f.suitable_age_bands.includes(band)
        ? f.suitable_age_bands.filter((b) => b !== band)
        : [...f.suitable_age_bands, band],
    }));

  const mutation = useMutation({
    mutationFn: (payload) => base44.entities.Product.update(product.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      onDone();
    },
  });

  const submit = (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      price: form.price === "" ? null : Number(form.price),
    };
    mutation.mutate(payload);
  };

  return (
    <div className="max-w-2xl mx-auto px-8 sm:px-12 lg:px-16 pt-6 pb-16">
      <button
        onClick={onDone}
        className="flex items-center gap-1.5 text-brand-teal font-body text-sm font-medium mb-4 min-h-[44px]"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Products
      </button>
      <h1 className="font-display text-2xl text-brand-dark mb-6">Edit Product</h1>

      {/* Read-only scraper fields */}
      <div className="bg-brand-cream-card rounded-2xl shadow-sm p-5 mb-6 space-y-3">
        <p className="font-body text-xs uppercase tracking-wide text-brand-dark/40">From scraper · read-only</p>
        <ReadOnly label="Retailer" value={retailerName} />
        <ReadOnly label="Product URL" value={product.productUrl || product.product_url} />
      </div>

      <form onSubmit={submit} className="space-y-5">
        <Field label="Name">
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} className="h-12" />
        </Field>
        <Field label="Description">
          <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} />
        </Field>
        <Field label="Price (GBP)">
          <Input type="number" step="0.01" value={form.price} onChange={(e) => set("price", e.target.value)} className="h-12" />
        </Field>
        <Field label="Affiliate URL">
          <Input value={form.affiliate_url} onChange={(e) => set("affiliate_url", e.target.value)} className="h-12" />
        </Field>

        {/* Live image preview above the image_url input */}
        <div className="space-y-1.5">
          <Label className="font-body text-sm text-brand-dark/80">Image</Label>
          {form.image_url && !previewBroken ? (
            <img
              src={form.image_url}
              alt=""
              onError={() => setPreviewBroken(true)}
              className="max-h-[200px] rounded-xl object-contain bg-brand-cream-card shadow-sm"
            />
          ) : form.image_url && previewBroken ? (
            <div className="h-[200px] rounded-xl bg-brand-dark/10 flex flex-col items-center justify-center gap-2">
              <ImageOff className="w-6 h-6 text-brand-dark/30" />
              <p className="font-body text-sm text-brand-dark/50">Image not found — update URL</p>
            </div>
          ) : null}
          <Input
            value={form.image_url}
            onChange={(e) => { set("image_url", e.target.value); setPreviewBroken(false); }}
            placeholder="https://…"
            className="h-12"
          />
        </div>

        <Field label="Category">
          <Input value={form.category} onChange={(e) => set("category", e.target.value)} className="h-12" placeholder="e.g. Home & Living" />
        </Field>
        <Field label="Gender Applies To">
          <Input value={form.gender_applies_to} onChange={(e) => set("gender_applies_to", e.target.value)} className="h-12" />
        </Field>
        
        {/* Suitable Age Bands */}
        <div className="space-y-1.5">
          <Label className="font-body text-sm text-brand-dark/80">Suitable Age Bands</Label>
          <p className="font-body text-xs text-brand-dark/50 mb-2">
            Select all age ranges this product is suitable for.
          </p>
          
          {/* Children age bands */}
          <div className="mb-3">
            <p className="font-body text-xs font-medium text-brand-dark/60 mb-2">Children (Ages 1-17)</p>
            <div className="grid grid-cols-3 gap-x-4 gap-y-2.5">
              {["1-2", "3-4", "5-6", "7-8", "9-11", "12-17"].map((band) => (
                <label key={band} className="flex items-center gap-2.5 font-body text-sm text-brand-dark/80 cursor-pointer">
                  <Checkbox
                    checked={form.suitable_age_bands.includes(band)}
                    onCheckedChange={() => toggleBand(band)}
                    className="border-brand-teal data-[state=checked]:bg-brand-teal data-[state=checked]:border-brand-teal"
                  />
                  <span>{band}</span>
                </label>
              ))}
            </div>
          </div>
          
          {/* Adult age bands */}
          <div>
            <p className="font-body text-xs font-medium text-brand-dark/60 mb-2">Adults (Ages 18+)</p>
            <div className="grid grid-cols-3 gap-x-4 gap-y-2.5">
              {["18-25", "26-35", "36-45", "46-55", "56-65", "66-75", "75+"].map((band) => (
                <label key={band} className="flex items-center gap-2.5 font-body text-sm text-brand-dark/80 cursor-pointer">
                  <Checkbox
                    checked={form.suitable_age_bands.includes(band)}
                    onCheckedChange={() => toggleBand(band)}
                    className="border-brand-teal data-[state=checked]:bg-brand-teal data-[state=checked]:border-brand-teal"
                  />
                  <span>{band}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        
        <Field label="Status">
          <Select value={form.status} onValueChange={(v) => set("status", v)}>
            <SelectTrigger className="h-12">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Provenance">
          <Select value={form.source_type} onValueChange={(v) => set("source_type", v)}>
            <SelectTrigger className="h-12">
              <SelectValue placeholder="Select provenance" />
            </SelectTrigger>
            <SelectContent>
              {SOURCE_TYPES.map((s) => (
                <SelectItem key={s} value={s}>{SOURCE_LABELS_EDIT[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <div className="flex items-center justify-between bg-brand-cream-card rounded-xl shadow-sm px-4 py-3">
          <Label className="font-body text-sm text-brand-dark/80">Age Restricted</Label>
          <Switch checked={form.age_restricted} onCheckedChange={(v) => set("age_restricted", v)} />
        </div>

        <Field label="Notes">
          <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} />
        </Field>

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full bg-brand-teal text-brand-cream font-body font-medium rounded-xl py-3.5 min-h-[44px] flex items-center justify-center gap-2 hover:bg-brand-teal-dark disabled:opacity-60"
        >
          {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          Save Changes
        </button>
      </form>
    </div>
  );
}

export const STATUS_LABEL = {
  // Uppercase (from database)
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  NEEDS_REVIEW: "Needs review",
  REPORTED_BROKEN: "Reported broken",
  // Legacy lowercase support
  active: "Active",
  inactive: "Inactive",
  needs_review: "Needs review",
  reported_broken: "Reported broken",
};

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="font-body text-sm text-brand-dark/80">{label}</Label>
      {children}
    </div>
  );
}

function ReadOnly({ label, value }) {
  return (
    <div>
      <p className="font-body text-xs text-brand-dark/40">{label}</p>
      <p className="font-body text-sm text-brand-dark break-all">{value}</p>
    </div>
  );
}