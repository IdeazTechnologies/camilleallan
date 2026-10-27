import { asc, desc, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminHeader, Empty } from "@/components/admin/ui";
import { db } from "@/db";
import { galleryAlbums, galleryImages } from "@/db/schema";
import { requireAdmin } from "@/lib/dal";
import { AlbumForm } from "./AlbumForm";

export const metadata: Metadata = { title: "Gallery" };

export default async function AdminGallery() {
  await requireAdmin();
  const albums = await db
    .select({
      id: galleryAlbums.id,
      title: galleryAlbums.title,
      slug: galleryAlbums.slug,
      published: galleryAlbums.published,
      count: sql<number>`count(${galleryImages.id})::int`,
    })
    .from(galleryAlbums)
    .leftJoin(galleryImages, eq(galleryImages.albumId, galleryAlbums.id))
    .groupBy(galleryAlbums.id)
    .orderBy(asc(galleryAlbums.sortOrder), desc(galleryAlbums.createdAt));

  return (
    <>
      <AdminHeader title="Gallery" description="Albums of past work shown on the Gallery page." />
      <div className="split">
        <section className="stack">
          {albums.length === 0 ? (
            <Empty>No albums yet. Create one to start adding photos.</Empty>
          ) : (
            <div className="card table-wrap" style={{ padding: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Album</th>
                    <th>Visibility</th>
                    <th className="num">Photos</th>
                  </tr>
                </thead>
                <tbody>
                  {albums.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <Link href={`/admin/gallery/${a.id}`} style={{ fontWeight: 500 }}>
                          {a.title}
                        </Link>
                        <div className="muted">/gallery/{a.slug}</div>
                      </td>
                      <td>
                        <span className={`badge ${a.published ? "success" : ""}`}>{a.published ? "Visible" : "Hidden"}</span>
                      </td>
                      <td className="num">{a.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="card stack">
          <h2 style={{ fontSize: "var(--step-1)" }}>New album</h2>
          <AlbumForm />
        </section>
      </div>
    </>
  );
}
