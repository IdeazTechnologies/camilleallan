"use client";

import { useActionState } from "react";
import { votePoll, type PollResult } from "@/app/(site)/poll-actions";
import { SubmitButton } from "@/components/forms/SubmitButton";

type Props = { pollId: string; question: string; options: Array<{ id: string; label: string }> };

export function PollForm({ pollId, question, options }: Props) {
  const [state, action] = useActionState<PollResult, FormData>(votePoll, { ok: false });
  const showResults = state.ok && state.results;

  return (
    <div className="card stack" style={{ maxWidth: 520, marginInline: "auto" }}>
      <p className="eyebrow">Quick poll</p>
      <h3>{question}</h3>
      {showResults ? (
        <ul className="stack stack-sm" style={{ listStyle: "none", padding: 0 }}>
          {options.map((o) => {
            const votes = state.results!.find((r) => r.optionId === o.id)?.votes ?? 0;
            const pct = state.total ? Math.round((votes / state.total) * 100) : 0;
            return (
              <li key={o.id} className="stack" style={{ gap: "0.25rem" }}>
                <div className="spread" style={{ fontSize: "var(--step--1)" }}>
                  <span>
                    {o.label}
                    {state.votedOptionId === o.id ? " ✓" : ""}
                  </span>
                  <span className="muted">{pct}%</span>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: "var(--color-surface-strong)", overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: "var(--color-accent)", transition: "width .6s" }} />
                </div>
              </li>
            );
          })}
          <li className="muted" style={{ fontSize: "var(--step--1)" }}>
            {state.message} {state.total} vote{state.total === 1 ? "" : "s"}.
          </li>
        </ul>
      ) : (
        <form action={action} className="stack">
          <input type="hidden" name="pollId" value={pollId} />
          <fieldset className="stack stack-sm" style={{ border: 0, padding: 0 }}>
            <legend className="sr-only">{question}</legend>
            {options.map((o) => (
              <label key={o.id} className="radio-card">
                <input type="radio" name="optionId" value={o.id} required />
                {o.label}
              </label>
            ))}
          </fieldset>
          {state.message && <p className="alert error">{state.message}</p>}
          <SubmitButton pendingLabel="Voting…">Vote</SubmitButton>
        </form>
      )}
    </div>
  );
}
