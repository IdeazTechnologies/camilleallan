"use client";

import { useRef, useState } from "react";
import { ImagePlaceholder, SiteImage } from "@/components/SiteImage";
import { Lightbox, type LightboxImage } from "./Lightbox";
import styles from "./ProductGallery.module.css";

export function ProductGallery({ images, title }: { images: LightboxImage[]; title: string }) {
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  function show(i: number) {
    setActive(i);
    const track = trackRef.current;
    track?.children[i]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
  }

  if (images.length === 0) {
    return (
      <div className={styles.main} style={{ position: "relative" }}>
        <ImagePlaceholder />
      </div>
    );
  }

  return (
    <div className={styles.gallery}>
      <div
        ref={trackRef}
        className={styles.main}
        onScroll={(e) => {
          const el = e.currentTarget;
          const i = Math.round(el.scrollLeft / el.clientWidth);
          if (i !== active) setActive(i);
        }}
      >
        {images.map((img, i) => (
          <button
            key={img.url}
            type="button"
            className={styles.slide}
            onClick={() => setLightbox(i)}
            aria-label={`Enlarge image ${i + 1} of ${images.length}`}
          >
            <SiteImage
              src={img.url}
              alt={img.alt || title}
              fill
              priority={i === 0}
              sizes="(max-width: 860px) 100vw, 55vw"
            />
          </button>
        ))}
      </div>

      {images.length > 1 && (
        <div className={styles.thumbs} role="tablist" aria-label="Product images">
          {images.map((img, i) => (
            <button
              key={img.url}
              type="button"
              role="tab"
              aria-selected={i === active}
              className={styles.thumb}
              onClick={() => show(i)}
            >
              <SiteImage src={img.url} alt="" fill sizes="96px" />
            </button>
          ))}
        </div>
      )}

      <Lightbox images={images} index={lightbox} onIndexChange={setLightbox} />
    </div>
  );
}
