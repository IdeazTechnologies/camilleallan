"use client";

import { useActionState } from "react";
import { FieldError, FormMessage } from "@/components/forms/FormMessage";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { initialActionState } from "@/lib/forms";
import { saveProductAction } from "./actions";

type Product = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  description: string | null;
  price: string;
  compareAt: string;
  sku: string | null;
  stockQty: number;
  oneOfAKind: boolean;
  status: string;
  featured: boolean;
  categoryId: string | null;
  weightGrams: number | null;
  sortOrder: number;
};

export function ProductForm({ product, categories }: { product?: Product; categories: Array<{ id: string; name: string }> }) {
  const [state, action] = useActionState(saveProductAction, initialActionState);
  const v = (k: keyof Product, fallback = "") => state.values?.[k] ?? (product ? String(product[k] ?? "") : fallback);
  const checked = (k: "oneOfAKind" | "featured") => (state.values ? state.values[k] === "on" : (product?.[k] ?? k === "oneOfAKind"));

  return (
    <form action={action} className="form">
      <FormMessage state={state} />
      {product && <input type="hidden" name="id" value={product.id} />}
      <div className="split">
        <div className="stack">
          <div className="field">
            <label htmlFor="title">Title</label>
            <input id="title" name="title" required defaultValue={v("title")} />
            <FieldError state={state} name="title" />
          </div>
          <div className="field">
            <label htmlFor="summary">Short summary</label>
            <input id="summary" name="summary" maxLength={400} defaultValue={v("summary")} />
            <span className="hint">One or two sentences shown near the price.</span>
          </div>
          <div className="field">
            <label htmlFor="description">Description</label>
            <textarea id="description" name="description" rows={12} defaultValue={v("description")} />
            <span className="hint">Supports Markdown: **bold**, *italic*, lists, and links.</span>
          </div>
          <div className="form-row">
            <div className="field">
              <label htmlFor="price">Price (USD)</label>
              <input id="price" name="price" inputMode="decimal" required defaultValue={v("price")} />
              <FieldError state={state} name="price" />
            </div>
            <div className="field">
              <label htmlFor="compareAt">Compare-at price</label>
              <input id="compareAt" name="compareAt" inputMode="decimal" defaultValue={v("compareAt")} />
              <span className="hint">Optional original price, shows as a sale.</span>
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="field">
            <label htmlFor="status">Status</label>
            <select id="status" name="status" defaultValue={v("status", "draft")}>
              <option value="draft">Draft (hidden)</option>
              <option value="published">Published</option>
              <option value="archived">Archived (hidden)</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="stockQty">Quantity in stock</label>
            <input id="stockQty" name="stockQty" type="number" min={0} required defaultValue={v("stockQty", "1")} />
            <FieldError state={state} name="stockQty" />
          </div>
          <label className="check">
            <input type="checkbox" name="oneOfAKind" defaultChecked={checked("oneOfAKind")} />
            One of a kind (shows a badge, quantity fixed at 1 per order)
          </label>
          <label className="check">
            <input type="checkbox" name="featured" defaultChecked={checked("featured")} />
            Feature on the home page
          </label>
          <div className="field">
            <label htmlFor="categoryId">Category</label>
            <select id="categoryId" name="categoryId" defaultValue={v("categoryId")}>
              <option value="">None</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="sku">SKU</label>
            <input id="sku" name="sku" defaultValue={v("sku")} />
          </div>
          <div className="field">
            <label htmlFor="slug">URL slug</label>
            <input id="slug" name="slug" defaultValue={v("slug")} placeholder="auto from title" />
          </div>
          <div className="form-row">
            <div className="field">
              <label htmlFor="weightGrams">Weight (g)</label>
              <input id="weightGrams" name="weightGrams" type="number" min={0} defaultValue={v("weightGrams")} />
            </div>
            <div className="field">
              <label htmlFor="sortOrder">Sort order</label>
              <input id="sortOrder" name="sortOrder" type="number" defaultValue={v("sortOrder", "0")} />
            </div>
          </div>
          <SubmitButton pendingLabel="Saving…">{product ? "Save changes" : "Create product"}</SubmitButton>
        </div>
      </div>
    </form>
  );
}
