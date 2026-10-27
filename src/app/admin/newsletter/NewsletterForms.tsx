"use client";

import { marked } from "marked";
import { useRouter } from "next/navigation";
import { useActionState, useDeferredValue, useState, useTransition } from "react";
import { FormMessage } from "@/components/forms/FormMessage";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { initialActionState } from "@/lib/forms";
import { addSubscriberAction, saveCampaignAction, sendCampaignBatchAction, sendCampaignTestAction, startCampaignAction } from "./actions";

export function CampaignForm({ campaign, readOnly }: { campaign?: { id: string; subject: string; body: string }; readOnly?: boolean }) {
  const [state, action] = useActionState(saveCampaignAction, initialActionState);
  const [body, setBody] = useState(campaign?.body ?? "");
  const preview = marked.parse(useDeferredValue(body), { async: false });
  return (
    <form action={action} className="form">
      {campaign && <input type="hidden" name="id" value={campaign.id} />}
      <FormMessage state={state} />
      <div className="field">
        <label htmlFor="subject">Subject</label>
        <input id="subject" name="subject" required defaultValue={campaign?.subject} readOnly={readOnly} />
      </div>
      <div className="form-row" style={{ alignItems: "start" }}>
        <div className="field">
          <label htmlFor="body">Message (Markdown)</label>
          <textarea id="body" name="body" className="code" rows={18} value={body} onChange={(e) => setBody(e.target.value)} readOnly={readOnly} />
          <span className="hint">Images: ![description](https://image-url). Links: [text](https://…).</span>
        </div>
        <div className="field">
          <span className="label">Preview</span>
          <div className="prose panel" style={{ minHeight: 260 }} dangerouslySetInnerHTML={{ __html: preview }} />
        </div>
      </div>
      {!readOnly && (
        <div>
          <SubmitButton pendingLabel="Saving…">{campaign ? "Save draft" : "Create draft"}</SubmitButton>
        </div>
      )}
    </form>
  );
}

export function CampaignTestForm({ id, defaultTo }: { id: string; defaultTo: string }) {
  const [state, action] = useActionState(sendCampaignTestAction, initialActionState);
  return (
    <form action={action} className="stack stack-sm">
      <input type="hidden" name="id" value={id} />
      <div className="cluster" style={{ flexWrap: "nowrap" }}>
        <input className="input" name="to" type="email" defaultValue={defaultTo} />
        <SubmitButton className="btn-outline btn-sm" pendingLabel="Sending…">
          Send test
        </SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function CampaignSender({ id, status, subscriberCount }: { id: string; status: string; subscriberCount: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [progress, setProgress] = useState<string | null>(null);

  function send() {
    if (status === "draft" && !window.confirm(`Send this newsletter to ${subscriberCount} subscriber${subscriberCount === 1 ? "" : "s"} now?`)) return;
    startTransition(async () => {
      const started = await startCampaignAction(id);
      if (!started.ok) {
        setProgress(started.message);
        return;
      }
      let sent = 0;
      let failed = 0;
      for (let guard = 0; guard < 1000; guard++) {
        const r = await sendCampaignBatchAction(id);
        sent += r.sent;
        failed += r.failed;
        setProgress(`Sent ${sent}${failed ? `, ${failed} failed` : ""}${r.remaining ? `, ${r.remaining} to go…` : ""}`);
        if (r.done) break;
      }
      setProgress(`Finished. Sent ${sent}${failed ? `, ${failed} failed` : ""}.`);
      router.refresh();
    });
  }

  return (
    <div className="stack stack-sm">
      <button type="button" className="btn btn-accent" onClick={send} disabled={pending || subscriberCount === 0}>
        {pending ? "Sending…" : status === "sending" ? "Resume sending" : `Send to ${subscriberCount} subscribers`}
      </button>
      {pending && <p className="muted">Keep this page open until sending finishes. Any remainder is finished automatically overnight.</p>}
      {progress && <p role="status">{progress}</p>}
    </div>
  );
}

export function AddSubscribersForm() {
  const [state, action] = useActionState(addSubscriberAction, initialActionState);
  return (
    <form action={action} className="stack stack-sm">
      <textarea className="input" name="emails" rows={3} placeholder="one@example.com, two@example.com" />
      <span className="muted" style={{ fontSize: "0.75rem" }}>
        Only add people who have agreed to receive your newsletter.
      </span>
      <div>
        <SubmitButton className="btn-sm" pendingLabel="Adding…">
          Add subscribers
        </SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
