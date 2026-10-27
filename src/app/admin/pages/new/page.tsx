import type { Metadata } from "next";
import { AdminHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/dal";
import { PageForm } from "../PageForm";

export const metadata: Metadata = { title: "New page" };

export default async function NewPage() {
  await requireAdmin();
  return (
    <>
      <AdminHeader title="New page" back={{ href: "/admin/pages", label: "Pages" }} />
      <div className="card">
        <PageForm />
      </div>
    </>
  );
}
