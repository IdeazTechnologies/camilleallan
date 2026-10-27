"use client";

import { useCallback, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "@/components/site/icons";
import styles from "./Lightbox.module.css";

export type LightboxImage = {
  url: string;
  alt: string | null;
  caption?: string | null;
  width?: number | null;
  height?: number | null;
};

type Props = {
  images: LightboxImage[];
  index: number | null;
  onIndexChange: (index: number | null) => void;
};

export function Lightbox({ images, index, onIndexChange }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const touchStart = useRef<number | null>(null);
  const open = index !== null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const go = useCallback(
    (delta: number) => {
      if (index === null || images.length === 0) return;
      onIndexChange((index + delta + images.length) % images.length);
    },
    [index, images.length, onIndexChange],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go]);

  const image = index !== null ? images[index] : null;

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      onClose={() => onIndexChange(null)}
      onClick={(e) => {
        if (e.target === e.currentTarget) onIndexChange(null);
      }}
      onTouchStart={(e) => (touchStart.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchStart.current === null) return;
        const dx = e.changedTouches[0].clientX - touchStart.current;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
        touchStart.current = null;
      }}
      aria-label="Image viewer"
    >
      {image && (
        <figure className={styles.figure}>
          {/* Full-size original; dimensions vary so next/image fill is not a good fit here. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.url} alt={image.alt ?? ""} className={styles.image} />
          {(image.caption || images.length > 1) && (
            <figcaption className={styles.caption}>
              {image.caption}
              {images.length > 1 && (
                <span className={styles.counter}>
                  {index! + 1} / {images.length}
                </span>
              )}
            </figcaption>
          )}
        </figure>
      )}
      <button type="button" className={styles.close} onClick={() => onIndexChange(null)} aria-label="Close">
        ×
      </button>
      {images.length > 1 && (
        <>
          <button type="button" className={`${styles.nav} ${styles.prev}`} onClick={() => go(-1)} aria-label="Previous image">
            <ChevronLeft />
          </button>
          <button type="button" className={`${styles.nav} ${styles.next}`} onClick={() => go(1)} aria-label="Next image">
            <ChevronRight />
          </button>
        </>
      )}
    </dialog>
  );
}
