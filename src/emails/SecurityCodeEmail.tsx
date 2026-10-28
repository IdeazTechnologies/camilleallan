import { Button, Section, Text } from "@react-email/components";
import { EmailLayout, colors, styles } from "./EmailLayout";

export default function SecurityCodeEmail({
  url,
  code,
  heading,
  body,
  buttonLabel,
}: {
  url: string;
  code: string;
  heading: string;
  body: string;
  buttonLabel: string;
}) {
  return (
    <EmailLayout preview={`${heading} Your code is ${code}`}>
      <Text style={styles.h1}>{heading}</Text>
      <Text style={styles.p}>{body}</Text>
      <Section
        style={{
          textAlign: "center",
          margin: "20px 0",
          padding: "16px",
          background: colors.surface,
          borderRadius: "12px",
        }}
      >
        <Text
          style={{
            fontSize: "32px",
            letterSpacing: "0.35em",
            fontWeight: 600,
            margin: 0,
            color: colors.text,
            fontFamily: "'Courier New', monospace",
          }}
        >
          {code}
        </Text>
      </Section>
      <Section style={{ textAlign: "center", margin: "8px 0 20px" }}>
        <Button href={url} style={styles.button}>
          {buttonLabel}
        </Button>
      </Section>
      <Text style={styles.muted}>This code expires in 15 minutes. If you did not ask for it, you can ignore this email.</Text>
    </EmailLayout>
  );
}
