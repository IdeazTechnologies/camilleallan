import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { CSSProperties, ReactNode } from "react";

export const colors = {
  text: "#1d1a18",
  muted: "#6f6660",
  accent: "#965c50",
  border: "#e8e1da",
  surface: "#faf7f4",
};

export const styles = {
  h1: {
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontWeight: 400,
    fontSize: "26px",
    lineHeight: "1.25",
    margin: "0 0 16px",
    color: colors.text,
  } satisfies CSSProperties,
  p: { fontSize: "15px", lineHeight: "1.6", margin: "0 0 14px", color: colors.text } satisfies CSSProperties,
  muted: { fontSize: "13px", lineHeight: "1.5", color: colors.muted, margin: "0 0 10px" } satisfies CSSProperties,
  button: {
    display: "inline-block",
    backgroundColor: colors.text,
    color: "#ffffff",
    padding: "12px 26px",
    borderRadius: "999px",
    fontSize: "13px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    textDecoration: "none",
  } satisfies CSSProperties,
};

export function EmailLayout({
  preview,
  children,
  footer,
  siteUrl,
}: {
  preview: string;
  children: ReactNode;
  footer?: ReactNode;
  siteUrl?: string;
}) {
  const href = siteUrl ?? process.env.APP_URL ?? "https://camilleallen.com";
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: colors.surface,
          fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
          margin: 0,
          padding: "24px 0",
        }}
      >
        <Container style={{ maxWidth: "560px", margin: "0 auto", padding: "0 16px" }}>
          <Section style={{ padding: "8px 0 20px", textAlign: "center" }}>
            <Link
              href={href}
              style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: "24px",
                color: colors.text,
                textDecoration: "none",
                letterSpacing: "0.02em",
              }}
            >
              Camille Allen
            </Link>
          </Section>
          <Section
            style={{
              backgroundColor: "#ffffff",
              border: `1px solid ${colors.border}`,
              borderRadius: "16px",
              padding: "32px 28px",
            }}
          >
            {children}
          </Section>
          <Hr style={{ borderColor: colors.border, margin: "24px 0 12px" }} />
          <Text style={{ ...styles.muted, textAlign: "center" }}>
            {footer ?? (
              <>
                Camille Allen Sculptures ·{" "}
                <Link href={href} style={{ color: colors.muted }}>
                  {href.replace(/^https?:\/\//, "")}
                </Link>
              </>
            )}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
