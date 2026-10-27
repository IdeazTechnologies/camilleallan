import { SiteImage } from "@/components/SiteImage";
import { ConfirmButton } from "./ConfirmButton";

type Img = { id: string; url: string; alt: string | null; caption?: string | null };

/** Grid of existing images with alt/caption editing, ordering and delete. */
export function ImageList({
  images,
  action,
  withCaption = false,
}: {
  images: Img[];
  action: (formData: FormData) => Promise<void>;
  withCaption?: boolean;
}) {
  if (images.length === 0) return <p className="muted">No images yet.</p>;
  return (
    <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "var(--space-4)", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))" }}>
      {images.map((img, i) => (
        <li key={img.id} className="card stack stack-sm" style={{ padding: "var(--space-3)" }}>
          <div style={{ position: "relative", aspectRatio: "1", borderRadius: "var(--radius)", overflow: "hidden", background: "var(--color-surface-strong)" }}>
            <SiteImage src={img.url} alt={img.alt ?? ""} fill sizes="200px" style={{ objectFit: "cover" }} />
            {i === 0 && (
              <span className="badge accent" style={{ position: "absolute", top: 6, left: 6 }}>
                Main
              </span>
            )}
          </div>
          <form action={action} className="stack stack-sm">
            <input type="hidden" name="id" value={img.id} />
            <input type="hidden" name="intent" value="alt" />
            <input className="input" name="alt" placeholder="Alt text (describe the image)" defaultValue={img.alt ?? ""} style={{ minHeight: 36, fontSize: "0.85rem" }} />
            {withCaption && (
              <input className="input" name="caption" placeholder="Caption (optional)" defaultValue={img.caption ?? ""} style={{ minHeight: 36, fontSize: "0.85rem" }} />
            )}
            <button type="submit" className="btn btn-ghost btn-sm">
              Save text
            </button>
          </form>
          <div className="cluster" style={{ gap: "var(--space-1)", justifyContent: "space-between" }}>
            <div className="cluster" style={{ gap: "var(--space-1)" }}>
              {i > 0 && (
                <form action={action}>
                  <input type="hidden" name="id" value={img.id} />
                  <button type="submit" name="intent" value="up" className="btn btn-ghost btn-sm" aria-label="Move earlier">
                    ←
                  </button>
                </form>
              )}
              {i < images.length - 1 && (
                <form action={action}>
                  <input type="hidden" name="id" value={img.id} />
                  <button type="submit" name="intent" value="down" className="btn btn-ghost btn-sm" aria-label="Move later">
                    →
                  </button>
                </form>
              )}
              {i > 0 && (
                <form action={action}>
                  <input type="hidden" name="id" value={img.id} />
                  <button type="submit" name="intent" value="first" className="btn btn-ghost btn-sm">
                    Make main
                  </button>
                </form>
              )}
            </div>
            <form action={action}>
              <input type="hidden" name="id" value={img.id} />
              <input type="hidden" name="intent" value="delete" />
              <ConfirmButton message="Delete this image?" className="btn-ghost" style={{ color: "var(--color-danger)" }}>
                Delete
              </ConfirmButton>
            </form>
          </div>
        </li>
      ))}
    </ul>
  );
}
