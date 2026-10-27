"use server";

import { redirect } from "next/navigation";
import { confirmSubscription, unsubscribe } from "@/lib/newsletter";

export async function confirmAction(formData: FormData) {
  const row = await confirmSubscription(String(formData.get("token") ?? ""));
  redirect(`/newsletter/confirm?done=${row ? "1" : "0"}`);
}

export async function unsubscribeAction(formData: FormData) {
  const row = await unsubscribe(String(formData.get("token") ?? ""));
  redirect(`/newsletter/unsubscribe?done=${row ? "1" : "0"}`);
}
