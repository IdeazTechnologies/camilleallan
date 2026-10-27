"use client";

import { useState } from "react";
import { SiteImage } from "@/components/SiteImage";
import { Lightbox, type LightboxImage } from "./Lightbox";
import styles from "./GalleryGrid.module.css";

export function GalleryGrid({ images }: { images: LightboxImage[] }) {
  const [index, setIndex] = useState<number | null>(null);
  return (
    <>
      <ul className={styles.grid}>
        {images.map((img, i) => (
          <li key={img.url + i} className={styles.item}>
            <button type="button" className={styles.button} onClick={() => setIndex(i)} aria-label={img.alt || `Open image ${i + 1}`}>
              <SiteImage
                src={img.url}
                alt={img.alt ?? ""}
                width={img.width ?? 800}
                height={img.height ?? 1000}
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                loading={i < 6 ? "eager" : "lazy"}
              />
            </button>
            {img.caption && <p className={styles.caption}>{img.caption}</p>}
          </li>
        ))}
      </ul>
      <Lightbox images={images} index={index} onIndexChange={setIndex} />
    </>
  );
}
