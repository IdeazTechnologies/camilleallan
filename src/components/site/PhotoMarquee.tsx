import type { CSSProperties } from "react";
import styles from "./PhotoMarquee.module.css";

export type MarqueeItem = { id: string; imageUrl: string; href: string; alt: string; caption?: string | null };

// Short feeds are repeated so one pass of the track is always wider than the screen.
const MIN_ITEMS = 8;
const SECONDS_PER_ITEM = 5;

function Tile({ item, hidden }: { item: MarqueeItem; hidden?: boolean }) {
  return (
    <li className={hidden ? styles.clone : undefined} aria-hidden={hidden || undefined}>
      <a href={item.href} target="_blank" rel="noopener noreferrer" className={styles.tile} tabIndex={hidden ? -1 : undefined}>
        {/* Social CDN URLs are signed and expire, so they bypass the image optimizer. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.imageUrl} alt={hidden ? "" : item.alt} loading="lazy" />
        {item.caption && <span className={styles.caption}>{item.caption}</span>}
      </a>
    </li>
  );
}

/** A row of photos that scrolls continuously to the left, pausing on hover or keyboard focus. */
export function PhotoMarquee({ items }: { items: MarqueeItem[] }) {
  if (items.length === 0) return null;
  const repeats = Math.ceil(MIN_ITEMS / items.length);
  const base = Array.from({ length: repeats }, () => items).flat();
  const style = { "--marquee-duration": `${base.length * SECONDS_PER_ITEM}s` } as CSSProperties;

  return (
    <div className={styles.viewport}>
      <ul className={styles.track} style={style}>
        {base.map((item, i) => (
          <Tile key={`a${i}`} item={item} hidden={i >= items.length} />
        ))}
        {base.map((item, i) => (
          <Tile key={`b${i}`} item={item} hidden />
        ))}
      </ul>
    </div>
  );
}
