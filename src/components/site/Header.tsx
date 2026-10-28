import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import monogram from "@/assets/ca-monogram.png";
import { getNavPages } from "@/lib/catalog";
import { getSettings } from "@/lib/settings";
import { getCartCount } from "@/lib/cart";
import { getCurrentUser } from "@/lib/dal";
import { BagIcon, MenuIcon, UserIcon } from "./icons";
import { MobileMenuCloser } from "./MobileMenuCloser";
import { ThemeToggle } from "./ThemeToggle";
import styles from "./Header.module.css";

async function CartCount() {
  const count = await getCartCount();
  return count > 0 ? <span className={styles.count}>{count}</span> : null;
}

async function AccountLink() {
  const user = await getCurrentUser();
  const href = user ? (user.role === "admin" ? "/admin" : "/account") : "/login";
  const label = user ? (user.role === "admin" ? "Admin" : "My account") : "Sign in";
  return (
    <Link href={href} className={styles.iconLink} aria-label={label} title={label}>
      <UserIcon />
    </Link>
  );
}

export async function Header() {
  const [settings, navPages] = await Promise.all([getSettings(), getNavPages()]);
  const links = [
    { href: "/shop", label: "Shop" },
    { href: "/gallery", label: "Gallery" },
    ...navPages.map((p) => ({ href: `/${p.slug}`, label: p.label })),
    { href: "/contact", label: "Contact" },
  ];

  return (
    <header className={styles.header}>
      <div className={`container ${styles.inner}`}>
        <button
          type="button"
          className={`${styles.menuButton} ${styles.iconLink}`}
          popoverTarget="mobile-menu"
          aria-label="Open menu"
        >
          <MenuIcon />
        </button>
        <nav className={styles.nav} aria-label="Main">
          {links.slice(0, 4).map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
        </nav>

        <Link href="/" className={styles.logo}>
          <Image src={monogram} alt="" className={styles.mark} sizes="56px" priority />
          <span>
            {settings.storeName}
            <small>Dolls &amp; Sculptures</small>
          </span>
        </Link>

        <div className={styles.actions}>
          <nav className={styles.nav} aria-label="Secondary">
            {links.slice(4).map((l) => (
              <Link key={l.href} href={l.href}>
                {l.label}
              </Link>
            ))}
          </nav>
          <Suspense
            fallback={
              <Link href="/login" className={styles.iconLink} aria-label="Account">
                <UserIcon />
              </Link>
            }
          >
            <AccountLink />
          </Suspense>
          <ThemeToggle className={`${styles.iconLink} ${styles.themeButton}`} />
          <Link href="/cart" className={styles.iconLink} aria-label="Cart">
            <BagIcon />
            <Suspense fallback={null}>
              <CartCount />
            </Suspense>
          </Link>
        </div>
      </div>

      <div id="mobile-menu" popover="auto" className={styles.mobileMenu}>
        <button type="button" className={styles.closeButton} popoverTarget="mobile-menu" popoverTargetAction="hide" aria-label="Close menu">
          ×
        </button>
        <Link href="/" className={styles.logo} style={{ justifySelf: "start" }}>
          <Image src={monogram} alt="" className={styles.mark} sizes="56px" />
          {settings.storeName}
        </Link>
        <nav aria-label="Mobile">
          {[{ href: "/", label: "Home" }, ...links, { href: "/account", label: "My account" }, { href: "/cart", label: "Cart" }].map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
        </nav>
        <Suspense fallback={null}>
          <MobileMenuCloser />
        </Suspense>
      </div>
    </header>
  );
}
