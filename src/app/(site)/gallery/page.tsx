import type { Metadata } from "next";
import Link from "next/link";
import { ImagePlaceholder, SiteImage } from "@/components/SiteImage";
import { Poll } from "@/components/site/Poll";
import { getGalleryAlbums } from "@/lib/catalog";
import styles from "./gallery.module.css";

export const metadata: Metadata = {
  title: "Gallery",
  description: "A gallery of sculptures and dolls created by Camille Allen over the years.",
  alternates: { canonical: "/gallery" },
};

export default async function GalleryPage() {
  const albums = await getGalleryAlbums();
  return (
    <>
      <div className="container">
        <header className="page-header centered">
          <p className="eyebrow">Gallery</p>
          <h1>Past work</h1>
          <p className="lede">A look back at sculptures and dolls that have already found their families.</p>
        </header>

        {albums.length === 0 ? (
          <p className="empty-state">The gallery is being curated. Please check back soon.</p>
        ) : (
          <ul className={styles.albums}>
            {albums.map((album, i) => (
              <li key={album.id}>
                <Link href={`/gallery/${album.slug}`} className={styles.album}>
                  <span className={styles.cover}>
                    {album.images[0] ? (
                      <SiteImage
                        src={album.images[0].url}
                        alt={album.images[0].alt ?? album.title}
                        fill
                        sizes="(max-width: 640px) 100vw, 33vw"
                        priority={i < 3}
                      />
                    ) : (
                      <ImagePlaceholder label={album.title} />
                    )}
                  </span>
                  <span className={styles.albumTitle}>{album.title}</span>
                  {album.description && <span className="muted">{album.description}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Poll placement="gallery" />
    </>
  );
}
