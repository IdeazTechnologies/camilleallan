import type { PollPlacement } from "@/db/schema";
import { getActivePoll } from "@/lib/catalog";
import { PollForm } from "./PollForm";

export async function Poll({ placement }: { placement: PollPlacement }) {
  const poll = await getActivePoll(placement);
  if (!poll || poll.options.length < 2) return null;
  return (
    <section className="section-tight">
      <div className="container">
        <PollForm pollId={poll.id} question={poll.question} options={poll.options.map((o) => ({ id: o.id, label: o.label }))} />
      </div>
    </section>
  );
}
