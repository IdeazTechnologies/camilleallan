"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import type { ActionState } from "@/lib/forms";

const MAX_DIMENSION = 2400;
const MAX_BYTES = 3.8 * 1024 * 1024;
const BATCH_BYTES = 4 * 1024 * 1024;

type Resized = { file: File; width: number; height: number };

async function resize(file: File): Promise<Resized> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  if (scale === 1 && file.size <= MAX_BYTES && /^image\/(jpeg|png|webp)$/.test(file.type)) {
    bitmap.close();
    return { file, width, height };
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  let quality = 0.86;
  let blob: Blob | null = null;
  while (quality > 0.4) {
    blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", quality));
    if (blob && blob.size <= MAX_BYTES) break;
    quality -= 0.12;
  }
  if (!blob) throw new Error(`Could not process ${file.name}`);
  const name = file.name.replace(/\.[^.]+$/, "") + ".webp";
  return { file: new File([blob], name, { type: "image/webp" }), width, height };
}

type Props = {
  ownerId: string;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  label?: string;
};

export function ImageUploader({ ownerId, action, label = "Upload images" }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setStatus(null);
    startTransition(async () => {
      try {
        const resized: Resized[] = [];
        for (const [i, f] of Array.from(files).entries()) {
          setProgress(`Preparing ${i + 1} of ${files.length}…`);
          resized.push(await resize(f));
        }
        // Send in batches that stay under the request size limit.
        const batches: Resized[][] = [[]];
        let size = 0;
        for (const r of resized) {
          if (size + r.file.size > BATCH_BYTES && batches.at(-1)!.length > 0) {
            batches.push([]);
            size = 0;
          }
          batches.at(-1)!.push(r);
          size += r.file.size;
        }
        let uploaded = 0;
        for (const [i, batch] of batches.entries()) {
          setProgress(`Uploading ${batches.length > 1 ? `batch ${i + 1} of ${batches.length}` : ""}…`);
          const fd = new FormData();
          fd.set("ownerId", ownerId);
          for (const r of batch) {
            fd.append("files", r.file);
            fd.append("widths", String(r.width));
            fd.append("heights", String(r.height));
          }
          const result = await action({}, fd);
          if (!result.ok) throw new Error(result.message ?? "Upload failed");
          uploaded += batch.length;
        }
        setStatus({ ok: true, message: `${uploaded} image${uploaded === 1 ? "" : "s"} uploaded.` });
        router.refresh();
      } catch (err) {
        setStatus({ ok: false, message: err instanceof Error ? err.message : "Upload failed" });
      } finally {
        setProgress(null);
        if (inputRef.current) inputRef.current.value = "";
      }
    });
  }

  return (
    <div
      className="panel stack stack-sm"
      style={{ border: "2px dashed var(--color-border-strong)", textAlign: "center" }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        void upload(e.dataTransfer.files);
      }}
    >
      <p className="muted" style={{ fontSize: "var(--step--1)" }}>
        Drag photos here, or
      </p>
      <label className="btn btn-outline btn-sm" style={{ justifySelf: "center" }} aria-disabled={pending || undefined}>
        {pending ? (progress ?? "Working…") : label}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          multiple
          className="sr-only"
          disabled={pending}
          onChange={(e) => void upload(e.target.files)}
        />
      </label>
      <p className="muted" style={{ fontSize: "0.75rem" }}>
        Large photos are resized automatically (max {MAX_DIMENSION}px).
      </p>
      {status && (
        <p className={`alert ${status.ok ? "success" : "error"}`} role="status">
          {status.message}
        </p>
      )}
    </div>
  );
}
