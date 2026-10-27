import Link from "next/link";
import { signOutAction } from "../login/actions";

const LINKS = [
  { href: "/account", label: "Orders & details" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/account/cards", label: "Saved cards" },
];

export function AccountNav({ current }: { current: string }) {
  return (
    <nav className="cluster" aria-label="Account" style={{ marginBottom: "var(--space-6)" }}>
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`btn btn-sm ${current === l.href ? "" : "btn-outline"}`}
          aria-current={current === l.href ? "page" : undefined}
        >
          {l.label}
        </Link>
      ))}
      <form action={signOutAction} style={{ marginLeft: "auto" }}>
        <button type="submit" className="btn btn-ghost btn-sm">
          Sign out
        </button>
      </form>
    </nav>
  );
}
