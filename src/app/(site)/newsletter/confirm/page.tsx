import type { Metadata } from "next";
import { confirmAction } from "../token-actions";
import { TokenPage } from "../TokenPage";

export const metadata: Metadata = { title: "Confirm subscription", robots: { index: false } };

export default function ConfirmPage({ searchParams }: PageProps<"/newsletter/confirm">) {
  return (
    <TokenPage
      searchParams={searchParams}
      action={confirmAction}
      copy={{
        title: "Confirm your subscription",
        prompt: "Click below to start receiving news about new sculptures.",
        button: "Yes, subscribe me",
        success: "You're subscribed. Thank you! Look out for news of new pieces in your inbox.",
        failure: "That confirmation link is invalid or has already been used.",
      }}
    />
  );
}
