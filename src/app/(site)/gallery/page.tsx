import type { Metadata } from "next";
import { GalleryGrid } from "@/components/gallery/GalleryGrid";
import { Poll } from "@/components/site/Poll";
import { getAllGalleryImages } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Gallery",
  description: "A gallery of sculptures and dolls created by Camille Allen over the years.",
  alternates: { canonical: "/gallery" },
};

export default async function GalleryPage() {
  const images = await getAllGalleryImages();
  return (
    <>
      <div className="container" style={{ paddingBottom: "var(--space-7)" }}>
        <header className="page-header centered">
          <p className="eyebrow">Gallery</p>
          <h1>Past work</h1>
          <p className="lede">A look back at sculptures and dolls that have already found their families.</p>
        </header>

        {images.length === 0 ? (
          <p className="empty-state">The gallery is being curated. Please check back soon.</p>
        ) : (
          <GalleryGrid
            images={images.map((i) => ({ url: i.url, alt: i.alt, caption: i.caption, width: i.width, height: i.height }))}
          />
        )}
      </div>
      <Poll placement="gallery" />
    </>
  );
}
