import { Button, Link, Section, Text } from "@react-email/components";
import { EmailLayout, colors, styles } from "./EmailLayout";

export function ContactNotificationEmail({
  name,
  email,
  phone,
  kind,
  subject,
  message,
  adminUrl,
}: {
  name: string;
  email: string;
  phone?: string | null;
  kind: string;
  subject?: string | null;
  message: string;
  adminUrl: string;
}) {
  return (
    <EmailLayout
      preview={`${kind === "custom_order" ? "Custom order request" : "New message"} from ${name}`}
      siteUrl={new URL(adminUrl).origin}
    >
      <Text style={styles.h1}>{kind === "custom_order" ? "Custom order request" : "New contact message"}</Text>
      <Text style={styles.p}>
        <strong>{name}</strong> · <Link href={`mailto:${email}`}>{email}</Link>
        {phone ? ` · ${phone}` : ""}
      </Text>
      {subject && <Text style={styles.p}>Subject: {subject}</Text>}
      <Section style={{ background: colors.surface, borderRadius: "12px", padding: "16px", margin: "12px 0" }}>
        <Text style={{ ...styles.p, whiteSpace: "pre-wrap", margin: 0 }}>{message}</Text>
      </Section>
      <Section style={{ textAlign: "center", marginTop: "20px" }}>
        <Button href={adminUrl} style={styles.button}>
          Open messages
        </Button>
      </Section>
    </EmailLayout>
  );
}

export function NewsletterConfirmEmail({ confirmUrl }: { confirmUrl: string }) {
  return (
    <EmailLayout preview="Please confirm your subscription" siteUrl={new URL(confirmUrl).origin}>
      <Text style={styles.h1}>One more step</Text>
      <Text style={styles.p}>
        Thanks for signing up for news from Camille Allen: new sculptures, studio updates and the occasional
        behind-the-scenes peek. Please confirm your email address:
      </Text>
      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <Button href={confirmUrl} style={styles.button}>
          Confirm subscription
        </Button>
      </Section>
      <Text style={styles.muted}>If you didn&apos;t sign up, just ignore this email and you won&apos;t hear from us.</Text>
    </EmailLayout>
  );
}

export function NewsletterCampaignEmail({
  subject,
  html,
  unsubscribeUrl,
}: {
  subject: string;
  html: string;
  unsubscribeUrl: string;
}) {
  return (
    <EmailLayout
      preview={subject}
      siteUrl={new URL(unsubscribeUrl).origin}
      footer={
        <>
          You&apos;re receiving this because you subscribed at camilleallen.com.{" "}
          <Link href={unsubscribeUrl} style={{ color: colors.muted }}>
            Unsubscribe
          </Link>
        </>
      }
    >
      <Text style={styles.h1}>{subject}</Text>
      <div style={{ fontSize: "15px", lineHeight: "1.6", color: colors.text }} dangerouslySetInnerHTML={{ __html: html }} />
    </EmailLayout>
  );
}

export function TestEmail() {
  return (
    <EmailLayout preview="Test email from your store">
      <Text style={styles.h1}>It works!</Text>
      <Text style={styles.p}>This is a test email sent from the Camille Allen admin. Email delivery is set up correctly.</Text>
    </EmailLayout>
  );
}
