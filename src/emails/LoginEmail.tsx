import { Button, Section, Text } from "@react-email/components";
import { EmailLayout, colors, styles } from "./EmailLayout";

export default function LoginEmail({ url, code }: { url: string; code: string }) {
  return (
    <EmailLayout preview={`Your sign-in code is ${code}`}>
      <Text style={styles.h1}>Sign in to Camille Allen</Text>
      <Text style={styles.p}>Click the button below to sign in, or enter this code on the sign-in page:</Text>
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
          Sign in
        </Button>
      </Section>
      <Text style={styles.muted}>
        This code expires in 15 minutes. If you didn&apos;t ask to sign in, you can ignore this email.
      </Text>
    </EmailLayout>
  );
}
