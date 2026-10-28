import type { Metadata } from "next";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { AdminHeader } from "@/components/admin/ui";
import { SiteImage } from "@/components/SiteImage";
import { requireAdmin } from "@/lib/dal";
import { emailTransport } from "@/lib/email/send";
import { getFacebookToken } from "@/lib/facebook";
import { getInstagramToken } from "@/lib/instagram";
import { getPsigateConfig } from "@/lib/payments/psigate";
import { readSettingsFresh } from "@/lib/settings";
import { blobConfigured } from "@/lib/storage";
import { uploadHeroImageAction } from "./actions";
import { FacebookForm, InstagramForm, StoreSettingsForm, TestEmailForm } from "./SettingsForms";

export const metadata: Metadata = { title: "Settings" };

export default async function AdminSettings() {
  const admin = await requireAdmin();
  const [settings, instagram, facebook] = await Promise.all([readSettingsFresh(), getInstagramToken(), getFacebookToken()]);
  const psigate = getPsigateConfig();
  const transport = emailTransport();

  return (
    <>
      <AdminHeader title="Settings" />
      <div className="split">
        <section className="card">
          <StoreSettingsForm settings={settings} />
        </section>
        <aside className="stack stack-lg">
          <section className="card stack">
            <h2 style={{ fontSize: "var(--step-1)" }}>Hero image</h2>
            {settings.heroImageUrl && (
              <div style={{ position: "relative", aspectRatio: "4 / 5", borderRadius: "var(--radius)", overflow: "hidden" }}>
                <SiteImage src={settings.heroImageUrl} alt="" fill sizes="320px" style={{ objectFit: "cover" }} />
              </div>
            )}
            <ImageUploader ownerId="hero" action={uploadHeroImageAction} label="Upload hero image" />
          </section>
          <section className="card stack">
            <h2 style={{ fontSize: "var(--step-1)" }}>Instagram</h2>
            <InstagramForm connected={!!instagram} expiresAt={instagram?.expiresAt ?? null} />
          </section>
          <section className="card stack">
            <h2 style={{ fontSize: "var(--step-1)" }}>Facebook</h2>
            <FacebookForm connected={!!facebook} pageName={facebook?.pageName ?? null} />
          </section>
          <section className="card stack">
            <h2 style={{ fontSize: "var(--step-1)" }}>Email</h2>
            <p className="muted" style={{ fontSize: "var(--step--1)" }}>
              Delivery: <strong>{transport === "ideaz" ? "Ideaz API" : "Outbox only (not sent)"}</strong>
            </p>
            <TestEmailForm defaultTo={admin.email} />
          </section>
          <section className="card stack stack-sm">
            <h2 style={{ fontSize: "var(--step-1)" }}>System status</h2>
            <dl className="summary-list" style={{ fontSize: "var(--step--1)" }}>
              <div>
                <dt>PSiGate</dt>
                <dd>{psigate ? `${psigate.mode} mode` : "not configured"}</dd>
              </div>
              <div>
                <dt>Saved cards</dt>
                <dd>{psigate?.savedCardsEnabled ? "enabled" : "disabled"}</dd>
              </div>
              <div>
                <dt>Image storage</dt>
                <dd>{blobConfigured() ? "Vercel Blob" : "Database"}</dd>
              </div>
            </dl>
            <p className="muted" style={{ fontSize: "0.75rem" }}>
              Payment keys and email credentials are set as environment variables in Vercel.
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
