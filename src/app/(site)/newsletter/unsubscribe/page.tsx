import type { Metadata } from "next";
import { unsubscribeAction } from "../token-actions";
import { TokenPage } from "../TokenPage";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };

export default function UnsubscribePage({ searchParams }: PageProps<"/newsletter/unsubscribe">) {
  return (
    <TokenPage
      searchParams={searchParams}
      action={unsubscribeAction}
      copy={{
        title: "Unsubscribe",
        prompt: "Click below and we'll stop sending you the newsletter.",
        button: "Unsubscribe me",
        success: "You've been unsubscribed. Sorry to see you go!",
        failure: "That unsubscribe link is invalid. If you keep receiving emails, please contact us.",
      }}
    />
  );
}
