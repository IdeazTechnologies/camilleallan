"use client";

import { marked } from "marked";
import { useActionState, useDeferredValue, useState } from "react";
import { FormMessage } from "@/components/forms/FormMessage";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { initialActionState } from "@/lib/forms";
import { savePageAction } from "./actions";

type Page = {
  id: string;
  title: string;
  slug: string;
  body: string;
  metaDescription: string | null;
  published: boolean;
  showInNav: boolean;
  navOrder: number;
};

export function PageForm({ page }: { page?: Page }) {
  const [state, action] = useActionState(savePageAction, initialActionState);
  const [body, setBody] = useState(page?.body ?? "");
  const deferred = useDeferredValue(body);
  // Admin-only preview of the admin's own content; the public page is sanitized server-side.
  const preview = marked.parse(deferred, { async: false });

  return (
    <form action={action} className="form">
      {page && <input type="hidden" name="id" value={page.id} />}
      <FormMessage state={state} />
      <div className="form-row">
        <div className="field">
          <label htmlFor="title">Title</label>
          <input id="title" name="title" required defaultValue={state.values?.title ?? page?.title} />
        </div>
        <div className="field">
          <label htmlFor="slug">URL</label>
          <input id="slug" name="slug" defaultValue={state.values?.slug ?? page?.slug} placeholder="auto from title" />
        </div>
      </div>
      <div className="form-row" style={{ alignItems: "start" }}>
        <div className="field">
          <label htmlFor="body">Content (Markdown)</label>
          <textarea id="body" name="body" className="code" value={body} onChange={(e) => setBody(e.target.value)} rows={20} />
          <span className="hint">
            # Heading, ## Subheading, **bold**, *italic*, - lists, [link text](https://…), ![image alt](image-url)
          </span>
        </div>
        <div className="field">
          <span className="label">Preview</span>
          <div className="prose panel" style={{ minHeight: 260, maxHeight: 640, overflow: "auto" }} dangerouslySetInnerHTML={{ __html: preview }} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="metaDescription">Search engine description</label>
        <input id="metaDescription" name="metaDescription" maxLength={300} defaultValue={state.values?.metaDescription ?? page?.metaDescription ?? ""} />
      </div>
      <div className="cluster">
        <label className="check">
          <input type="checkbox" name="published" defaultChecked={page?.published ?? true} />
          Published
        </label>
        <label className="check">
          <input type="checkbox" name="showInNav" defaultChecked={page?.showInNav ?? false} />
          Show in main menu
        </label>
        <label className="cluster" style={{ gap: "var(--space-2)" }}>
          Menu order
          <input className="input" name="navOrder" type="number" defaultValue={page?.navOrder ?? 0} style={{ width: 90, minHeight: 36 }} />
        </label>
      </div>
      <div>
        <SubmitButton pendingLabel="Saving…">{page ? "Save page" : "Create page"}</SubmitButton>
      </div>
    </form>
  );
}
