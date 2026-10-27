import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { ImageList } from "@/components/admin/ImageList";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { AdminHeader } from "@/components/admin/ui";
import { db } from "@/db";
import { galleryAlbums, galleryImages } from "@/db/schema";
import { requireAdmin } from "@/lib/dal";
import { deleteAlbumAction, updateGalleryImageAction, uploadGalleryImagesAction } from "../actions";
import { AlbumForm } from "../AlbumForm";

export const metadata: Metadata = { title: "Album" };

export default async function AdminAlbumPage({ params }: PageProps<"/admin/gallery/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const album = await db.query.galleryAlbums.findFirst({
    where: eq(galleryAlbums.id, id),
    with: { images: { orderBy: [asc(galleryImages.sortOrder), asc(galleryImages.createdAt)] } },
  });
  if (!album) notFound();
  return (
    <>
      <AdminHeader
        title={album.title}
        back={{ href: "/admin/gallery", label: "Gallery" }}
        actions={
          album.published ? (
            <Link href={`/gallery/${album.slug}`} target="_blank" className="btn btn-outline btn-sm">
              View on site ↗
            </Link>
          ) : null
        }
      />
      <section className="card stack" style={{ marginBottom: "var(--space-5)" }}>
        <h2 style={{ fontSize: "var(--step-1)" }}>Photos ({album.images.length})</h2>
        <ImageUploader ownerId={album.id} action={uploadGalleryImagesAction} label="Add photos" />
        <ImageList images={album.images} action={updateGalleryImageAction} withCaption />
      </section>
      <section className="card stack" style={{ marginBottom: "var(--space-5)" }}>
        <h2 style={{ fontSize: "var(--step-1)" }}>Album details</h2>
        <AlbumForm album={album} />
      </section>
      <form action={deleteAlbumAction}>
        <input type="hidden" name="id" value={album.id} />
        <ConfirmButton message={`Delete the album "${album.title}" and all its photos?`} className="btn-danger">
          Delete album
        </ConfirmButton>
      </form>
    </>
  );
}
