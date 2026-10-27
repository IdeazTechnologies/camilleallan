"use client";

import { useFormStatus } from "react-dom";
import type { ComponentProps } from "react";
import { cx } from "@/lib/utils";

export function SubmitButton({
  children,
  pendingLabel,
  className,
  ...rest
}: ComponentProps<"button"> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={cx("btn", className)}
      disabled={pending || rest.disabled}
      aria-busy={pending}
      {...rest}
    >
      {pending ? (pendingLabel ?? "Working…") : children}
    </button>
  );
}
