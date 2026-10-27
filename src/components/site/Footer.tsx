import Link from "next/link";
import { getPublishedPages } from "@/lib/catalog";
import { getSettings } from "@/lib/settings";
import { FacebookIcon, InstagramIcon } from "./icons";
import { NewsletterForm } from "./NewsletterForm";
import styles from "./Footer.module.css";

export async function Footer() {
  const [settings, pages] = await Promise.all([getSettings(), getPublishedPages()]);
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.grid}`}>
        <div className="stack">
          <p className={styles.brand}>{settings.storeName}</p>
          <p className="muted">{settings.tagline}</p>
          <div className="cluster">
            {settings.instagramHandle && (
              <a
                href={`https://www.instagram.com/${settings.instagramHandle}/`}
                className={styles.social}
                aria-label="Instagram"
                target="_blank"
                rel="noopener noreferrer"
              >
                <InstagramIcon />
              </a>
            )}
            {settings.facebookUrl && (
              <a href={settings.facebookUrl} className={styles.social} aria-label="Facebook" target="_blank" rel="noopener noreferrer">
                <FacebookIcon />
              </a>
            )}
          </div>
        </div>

        <nav className="stack stack-sm" aria-label="Shop">
          <p className="eyebrow">Shop</p>
          <Link href="/shop">All pieces</Link>
          <Link href="/gallery">Gallery</Link>
          <Link href="/contact?type=custom_order">Custom orders</Link>
          <Link href="/cart">Cart</Link>
        </nav>

        <nav className="stack stack-sm" aria-label="Information">
          <p className="eyebrow">Information</p>
          {pages.map((p) => (
            <Link key={p.slug} href={`/${p.slug}`}>
              {p.title}
            </Link>
          ))}
          <Link href="/contact">Contact</Link>
          <Link href="/account">My account</Link>
        </nav>

        <div className="stack">
          <p className="eyebrow">Newsletter</p>
          <p className="muted">New sculptures and studio news, a few times a year.</p>
          <NewsletterForm />
        </div>
      </div>
      <div className={`container ${styles.bottom}`}>
        <p>
          © {settings.storeName}. {settings.footerText}
        </p>
        {settings.contactEmail && <a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a>}
      </div>
    </footer>
  );
}
