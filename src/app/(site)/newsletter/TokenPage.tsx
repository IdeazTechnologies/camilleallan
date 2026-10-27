import Link from "next/link";
import { Suspense } from "react";
import { SubmitButton } from "@/components/forms/SubmitButton";

type Copy = { title: string; prompt: string; button: string; success: string; failure: string };
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function Body({ searchParams, action, copy }: { searchParams: SearchParams; action: (fd: FormData) => Promise<void>; copy: Copy }) {
  const params = await searchParams;
  if (params.done === "1") return <p className="lede">{copy.success}</p>;
  if (params.done === "0") return <p className="alert error">{copy.failure}</p>;
  const token = typeof params.token === "string" ? params.token : "";
  if (!token) return <p className="alert error">{copy.failure}</p>;
  return (
    <form action={action} className="stack" style={{ justifyItems: "center" }}>
      <input type="hidden" name="token" value={token} />
      <p className="lede">{copy.prompt}</p>
      <SubmitButton pendingLabel="One moment…">{copy.button}</SubmitButton>
    </form>
  );
}

export function TokenPage(props: { searchParams: SearchParams; action: (fd: FormData) => Promise<void>; copy: Copy }) {
  return (
    <div className="container-narrow section text-center stack" style={{ justifyItems: "center", maxWidth: 560 }}>
      <h1 style={{ fontSize: "var(--step-3)" }}>{props.copy.title}</h1>
      <Suspense fallback={<div className="skeleton" style={{ height: 80, width: "100%" }} />}>
        <Body {...props} />
      </Suspense>
      <Link href="/">Return to the home page</Link>
    </div>
  );
}
