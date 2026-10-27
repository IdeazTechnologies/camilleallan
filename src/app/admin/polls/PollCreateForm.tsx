"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/forms/FormMessage";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { initialActionState } from "@/lib/forms";
import { createPollAction } from "./actions";

export function PollCreateForm({ placements }: { placements: Array<[string, string]> }) {
  const [state, action] = useActionState(createPollAction, initialActionState);
  return (
    <form
      action={(fd) => {
        const v = String(fd.get("closesAt") ?? "");
        fd.set("closesAt", v ? new Date(v).toISOString() : "");
        return action(fd);
      }}
      className="form"
    >
      <FormMessage state={state} />
      <div className="field">
        <label>Question</label>
        <input name="question" required placeholder="Which hair color should the next baby have?" />
      </div>
      <div className="field">
        <label>Options (one per line)</label>
        <textarea name="options" rows={4} required placeholder={"Blonde\nBrunette\nRed\nBald!"} />
      </div>
      <div className="form-row">
        <div className="field">
          <label>Show on</label>
          <select name="placement" defaultValue="home">
            {placements.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Closes (optional)</label>
          <input name="closesAt" type="datetime-local" />
        </div>
      </div>
      <div>
        <SubmitButton pendingLabel="Creating…">Create poll</SubmitButton>
      </div>
    </form>
  );
}
