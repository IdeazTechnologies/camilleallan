"use server";

import { redirect } from "next/navigation";
import { db } from "@/db";
import { paymentSimulations } from "@/db/schema";
import { getPsigateConfig } from "@/lib/payments/psigate";
import { decimalToCents } from "@/lib/pricing";
import { appUrl } from "@/lib/utils";

export async function simulatePayment(formData: FormData) {
  const config = getPsigateConfig();
  if (config?.mode !== "simulate") throw new Error("The payment simulator is disabled.");

  const orderId = String(formData.get("OrderID") ?? "");
  const approved = formData.get("decision") === "approve";
  const totalCents = decimalToCents(String(formData.get("SubTotal") ?? "")) ?? 0;
  const thanks = String(formData.get("ThanksURL") ?? "");
  const noThanks = String(formData.get("NoThanksURL") ?? "");
  const base = appUrl("");
  const target = approved ? thanks : noThanks;
  if (!target.startsWith(base)) throw new Error("Invalid return URL");

  await db
    .insert(paymentSimulations)
    .values({ psigateOrderId: orderId, approved, totalCents })
    .onConflictDoUpdate({ target: paymentSimulations.psigateOrderId, set: { approved, totalCents } });

  const url = new URL(target);
  url.searchParams.set("OrderID", orderId);
  url.searchParams.set("Approved", approved ? "APPROVED" : "DECLINED");
  url.searchParams.set("FullTotal", (totalCents / 100).toFixed(2));
  if (!approved) url.searchParams.set("ErrMsg", "Simulated decline");
  redirect(url.toString());
}
