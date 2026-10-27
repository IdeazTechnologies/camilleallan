import type { ActionState } from "@/lib/forms";

export function FormMessage({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <p className={`alert ${state.ok ? "success" : "error"}`} role={state.ok ? "status" : "alert"}>
      {state.message}
    </p>
  );
}

export function FieldError({ state, name }: { state: ActionState; name: string }) {
  const error = state.errors?.[name];
  if (!error) return null;
  return (
    <span className="error" id={`${name}-error`}>
      {error}
    </span>
  );
}
