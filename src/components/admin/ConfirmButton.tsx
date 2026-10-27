"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { cx } from "@/lib/utils";

/** Submit button that asks for confirmation before submitting its form. */
export function ConfirmButton({ message, className, children, ...rest }: ComponentProps<"button"> & { message: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={cx("btn btn-sm", className)}
      disabled={pending || rest.disabled}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
      {...rest}
    >
      {pending ? "…" : children}
    </button>
  );
}
