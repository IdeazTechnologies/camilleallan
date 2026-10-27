"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/forms/FormMessage";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { initialActionState } from "@/lib/forms";
import { saveAlbumAction } from "./actions";

type Album = { id: string; title: string; slug: string; description: string | null; published: boolean; sortOrder: number };

export function AlbumForm({ album }: { album?: Album }) {
  const [state, action] = useActionState(saveAlbumAction, initialActionState);
  return (
    <form action={action} className="form">
      {album && <input type="hidden" name="id" value={album.id} />}
      <FormMessage state={state} />
      <div className="form-row">
        <div className="field">
          <label htmlFor="title">Album title</label>
          <input id="title" name="title" required defaultValue={album?.title} />
        </div>
        <div className="field">
          <label htmlFor="slug">URL slug</label>
          <input id="slug" name="slug" defaultValue={album?.slug} placeholder="auto from title" />
        </div>
        <div className="field" style={{ maxWidth: 140 }}>
          <label htmlFor="sortOrder">Sort order</label>
          <input id="sortOrder" name="sortOrder" type="number" defaultValue={album?.sortOrder ?? 0} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="description">Description</label>
        <input id="description" name="description" defaultValue={album?.description ?? ""} />
      </div>
      <label className="check">
        <input type="checkbox" name="published" defaultChecked={album?.published ?? true} />
        Visible on the website
      </label>
      <div>
        <SubmitButton pendingLabel="Saving…">{album ? "Save album" : "Create album"}</SubmitButton>
      </div>
    </form>
  );
}
