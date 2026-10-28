"use server";

import { runAction } from "@/server/actions/result";
import { startCheckout } from "@/server/billing/checkout";

export async function startCheckoutAction() {
  return runAction("billing.startCheckout", () => startCheckout());
}
