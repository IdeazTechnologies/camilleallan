import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GalleryGrid } from "@/components/gallery/GalleryGrid";
import { getGalleryAlbum } from "@/lib/catalog";
import { albumSlugs } from "@/lib/static-params";

export async function generateStaticParams() {
  return (await albumSlugs()).map(({ slug }) => ({ album: slug }));
}

export async function generateMetadata({ params }: PageProps<"/gallery/[album]">): Promise<Metadata> {
  const { album: slug } = await params;
  const album = await getGalleryAlbum(slug);
  if (!album) return { title: "Not found" };
  return {
    title: `${album.title} | Gallery`,
    description: album.description ?? undefined,
    openGraph: { images: album.images[0] ? [{ url: album.images[0].url }] : undefined },
  };
}

export default async function AlbumPage({ params }: PageProps<"/gallery/[album]">) {
  const { album: slug } = await params;
  const album = await getGalleryAlbum(slug);
  if (!album) notFound();
  return (
    <div className="container" style={{ paddingBottom: "var(--space-7)" }}>
      <header className="page-header centered">
        <nav aria-label="Breadcrumb">
          <ol className="breadcrumbs">
            <li>
              <Link href="/gallery">Gallery</Link>
            </li>
            <li aria-current="page">{album.title}</li>
          </ol>
        </nav>
        <h1>{album.title}</h1>
        {album.description && <p className="lede">{album.description}</p>}
      </header>
      {album.images.length > 0 ? (
        <GalleryGrid
          images={album.images.map((i) => ({ url: i.url, alt: i.alt, caption: i.caption, width: i.width, height: i.height }))}
        />
      ) : (
        <p className="empty-state">No images in this album yet.</p>
      )}
    </div>
  );
}
