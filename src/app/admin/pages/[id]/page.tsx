import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { AdminHeader } from "@/components/admin/ui";
import { db } from "@/db";
import { pages } from "@/db/schema";
import { requireAdmin } from "@/lib/dal";
import { deletePageAction } from "../actions";
import { PageForm } from "../PageForm";

export const metadata: Metadata = { title: "Edit page" };

export default async function EditPage({ params }: PageProps<"/admin/pages/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const page = await db.query.pages.findFirst({ where: eq(pages.id, id) });
  if (!page) notFound();
  return (
    <>
      <AdminHeader
        title={page.title}
        back={{ href: "/admin/pages", label: "Pages" }}
        actions={
          page.published ? (
            <Link href={`/${page.slug}`} target="_blank" className="btn btn-outline btn-sm">
              View ↗
            </Link>
          ) : null
        }
      />
      <div className="card" style={{ marginBottom: "var(--space-5)" }}>
        <PageForm page={page} />
      </div>
      <form action={deletePageAction}>
        <input type="hidden" name="id" value={page.id} />
        <ConfirmButton message={`Delete the page "${page.title}"?`} className="btn-danger">
          Delete page
        </ConfirmButton>
      </form>
    </>
  );
}
