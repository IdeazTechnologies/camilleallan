import Link from "next/link";
import type { ReactNode } from "react";

export function AdminHeader({ title, back, actions, description }: { title: string; back?: { href: string; label: string }; actions?: ReactNode; description?: ReactNode }) {
  return (
    <header className="stack stack-sm" style={{ marginBottom: "var(--space-6)" }}>
      {back && (
        <Link href={back.href} style={{ fontSize: "var(--step--1)" }}>
          ← {back.label}
        </Link>
      )}
      <div className="spread">
        <h1 style={{ fontSize: "var(--step-3)" }}>{title}</h1>
        {actions && <div className="cluster">{actions}</div>}
      </div>
      {description && <p className="muted">{description}</p>}
    </header>
  );
}

export function StatCard({ label, value, href, tone }: { label: string; value: ReactNode; href?: string; tone?: "accent" | "warning" }) {
  const body = (
    <div className="card stack stack-sm" style={{ borderColor: tone === "warning" ? "var(--color-warning)" : undefined }}>
      <span className="muted" style={{ fontSize: "var(--step--1)" }}>
        {label}
      </span>
      <strong style={{ fontSize: "var(--step-3)", fontWeight: 500 }}>{value}</strong>
    </div>
  );
  return href ? (
    <Link href={href} style={{ textDecoration: "none" }}>
      {body}
    </Link>
  ) : (
    body
  );
}

export function Pagination({ page, pageCount, makeHref }: { page: number; pageCount: number; makeHref: (page: number) => string }) {
  if (pageCount <= 1) return null;
  return (
    <nav className="cluster" aria-label="Pagination" style={{ marginTop: "var(--space-5)", justifyContent: "center" }}>
      {page > 1 && (
        <Link className="btn btn-outline btn-sm" href={makeHref(page - 1)}>
          ← Previous
        </Link>
      )}
      <span className="muted">
        Page {page} of {pageCount}
      </span>
      {page < pageCount && (
        <Link className="btn btn-outline btn-sm" href={makeHref(page + 1)}>
          Next →
        </Link>
      )}
    </nav>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="card muted text-center">{children}</p>;
}
