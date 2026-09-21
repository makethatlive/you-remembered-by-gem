import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, Loader2, ImageOff, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { STATUS_LABEL } from "./ProductEditForm";
import { getAllowedAgeBands } from "@/lib/ageRangeUtils";

// Get the 13 allowed age bands from onboarding form
const { all: AGE_BANDS } = getAllowedAgeBands();

// Manually add a product straight to the database so it becomes eligible for gift
// recommendations. Defaults to active, BUT (per the no-image-in-gift-lists rule) a
// product can only be saved active once its image_url actually loads in the browser
// preview. If the image is missing/broken, it can only be saved as "needs_review".
export default function ProductAddForm({ retailers, onDone }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    retailer_id: "",
    product_url: "",
    image_url: "",
    price: "",
    category: "",
    gender_applies_to: "",
    suitable_age_bands: [],
  });
  const [errors, setErrors] = useState({});
  // null = no url yet · "ok" = loaded · "broken" = failed to load
  const [imageState, setImageState] = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const toggleBand = (band) =>
    setForm((f) => ({
      ...f,
      suitable_age_bands: f.suitable_age_bands.includes(band)
        ? f.suitable_age_bands.filter((b) => b !== band)
        : [...f.suitable_age_bands, band],
    }));

  const imageOk = imageState === "ok";

  const mutation = useMutation({
    mutationFn: (payload) => base44.entities.Product.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      onDone();
    },
  });

  const submit = (e) => {
    e.preventDefault();
    const er = {};
    if (!form.name.trim()) er.name = "Name is required";
    if (!form.retailer_id) er.retailer_id = "Choose a retailer";
    if (!form.product_url.trim()) er.product_url = "Product URL is required";
    if (form.price === "" || isNaN(Number(form.price))) er.price = "Enter a price";
    setErrors(er);
    if (Object.keys(er).length) return;

    // Active only if the image preview actually loaded; otherwise needs_review.
    const status = imageOk ? "active" : "needs_review";
    mutation.mutate({
      name: form.name.trim(),
      retailer_id: form.retailer_id,
      product_url: form.product_url.trim(),
      affiliate_url: form.product_url.trim(), // Use product URL as affiliate URL by default
      image_url: form.image_url.trim(),
      price: Number(form.price),
      category: form.category.trim(),
      gender_applies_to: form.gender_applies_to.trim(),
      suitable_age_bands: form.suitable_age_bands,
      // Manually added by Gem — personally curated provenance.
      source_type: "curated_product",
      status,
      added_date: new Date().toISOString(),
    });
  };

  return (
    <div className="max-w-2xl mx-auto px-8 sm:px-12 lg:px-16 pt-6 pb-16">
      <button
        onClick={onDone}
        className="flex items-center gap-1.5 text-brand-teal font-body text-sm font-medium mb-4 min-h-[44px]"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Products
      </button>
      <h1 className="font-display text-2xl text-brand-dark mb-6">Add Product</h1>

      <form onSubmit={submit} className="space-y-5">
        <FormField label="Name" error={errors.name}>
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} className="h-12" placeholder="Product name" />
        </FormField>

        <FormField label="Retailer" error={errors.retailer_id}>
          <Select value={form.retailer_id} onValueChange={(v) => set("retailer_id", v)}>
            <SelectTrigger className="h-12"><SelectValue placeholder="Choose a retailer" /></SelectTrigger>
            <SelectContent>
              {retailers.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}{r.active === false ? " (inactive)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField label="Product URL" error={errors.product_url}>
          <Input value={form.product_url} onChange={(e) => set("product_url", e.target.value)} className="h-12" placeholder="https://…" />
        </FormField>

        {/* Live image preview — gates whether the product can go active */}
        <div className="space-y-1.5">
          <Label className="font-body text-sm text-brand-dark/80">Image URL</Label>
          {form.image_url && imageState !== "broken" && (
            <img
              src={form.image_url}
              alt=""
              onLoad={() => setImageState("ok")}
              onError={() => setImageState("broken")}
              className="max-h-[200px] rounded-xl object-contain bg-brand-cream-card shadow-sm"
            />
          )}
          {form.image_url && imageState === "broken" && (
            <div className="h-[200px] rounded-xl bg-brand-dark/10 flex flex-col items-center justify-center gap-2">
              <ImageOff className="w-6 h-6 text-brand-dark/30" />
              <p className="font-body text-sm text-brand-dark/50">Image not found — this product can only be saved for review</p>
            </div>
          )}
          <Input
            value={form.image_url}
            onChange={(e) => { set("image_url", e.target.value); setImageState(null); }}
            placeholder="https://…"
            className="h-12"
          />
          {imageOk && (
            <p className="flex items-center gap-1.5 font-body text-xs text-emerald-600">
              <CheckCircle2 className="w-3.5 h-3.5" /> Image loads — product will be saved as Active.
            </p>
          )}
          {!imageOk && (
            <p className="font-body text-xs text-brand-dark/45">
              A working image is required before a product can go active. Without one it saves as “Needs review”.
            </p>
          )}
        </div>

        <FormField label="Price (GBP)" error={errors.price}>
          <Input type="number" step="0.01" value={form.price} onChange={(e) => set("price", e.target.value)} className="h-12" placeholder="49.99" />
        </FormField>

        <FormField label="Category">
          <Input value={form.category} onChange={(e) => set("category", e.target.value)} className="h-12" placeholder="e.g. Home & Living" />
        </FormField>

        <FormField label="Gender Applies To">
          <Input value={form.gender_applies_to} onChange={(e) => set("gender_applies_to", e.target.value)} className="h-12" placeholder="e.g. Women, Men, Unisex" />
        </FormField>

        <div className="space-y-1.5">
          <Label className="font-body text-sm text-brand-dark/80">Suitable Age Bands</Label>
          <p className="font-body text-xs text-brand-dark/50 mb-2">
            Select all age ranges this product is suitable for. These match the onboarding form options.
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

        <p className="font-body text-sm text-brand-dark/55 bg-brand-cream-card rounded-xl px-4 py-3">
          This product will be saved as{" "}
          <b className="text-brand-dark">{imageOk ? STATUS_LABEL.active : STATUS_LABEL.needs_review}</b>.
        </p>

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full bg-brand-teal text-brand-cream font-body font-medium rounded-xl py-3.5 min-h-[44px] flex items-center justify-center gap-2 hover:bg-brand-teal-dark disabled:opacity-60"
        >
          {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          Add Product
        </button>
      </form>
    </div>
  );
}

function FormField({ label, error, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="font-body text-sm text-brand-dark/80">{label}</Label>
      {children}
      {error && <p className="text-xs text-red-500 font-body">{error}</p>}
    </div>
  );
}