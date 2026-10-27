"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/forms/FormMessage";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { initialActionState } from "@/lib/forms";
import { saveCategoryAction } from "./actions";

type Category = { id: string; name: string; slug: string; description: string | null; sortOrder: number };

export function CategoryForm({ category }: { category?: Category }) {
  const [state, action] = useActionState(saveCategoryAction, initialActionState);
  return (
    <form action={action} className="stack stack-sm">
      {category && <input type="hidden" name="id" value={category.id} />}
      <div className="form-row">
        <input className="input" name="name" placeholder="Name" required defaultValue={category?.name} />
        <input className="input" name="slug" placeholder="url-slug (auto)" defaultValue={category?.slug} />
        <input className="input" name="sortOrder" type="number" placeholder="Order" defaultValue={category?.sortOrder ?? 0} style={{ maxWidth: 110 }} />
      </div>
      <input className="input" name="description" placeholder="Description (optional)" defaultValue={category?.description ?? ""} />
      <div className="cluster">
        <SubmitButton className="btn-sm" pendingLabel="Saving…">
          {category ? "Save" : "Add category"}
        </SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
