"use client";

import { CreditCardIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics/client";
import { startCheckoutAction } from "@/server/actions/billing";

type RazorpaySuccess = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RazorpayInstance = { open: () => void; on: (event: "payment.failed", handler: () => void) => void };
type RazorpayConstructor = new (options: Record<string, unknown>) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

/**
 * Opens Razorpay Checkout for an order created on the server. On success the
 * browser only forwards Razorpay's signed identifiers; the server verifies
 * them with Razorpay before extending access.
 */
export function PayButton({ label }: { label: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);

  async function verify(response: RazorpaySuccess) {
    const result = await fetch("/api/billing/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(response),
    });
    const body = (await result.json().catch(() => ({}))) as { status?: string; message?: string };
    if (result.ok && body.status === "paid") {
      track("payment_verified", { plan: "parmarpro_clinic_monthly" });
      toast.success("Payment confirmed. Thank you!");
    } else if (result.status === 202) {
      toast.info("Payment received and awaiting confirmation from Razorpay. This page will update shortly.");
    } else {
      toast.error(body.message ?? "We could not confirm this payment. If you were charged, it will be reconciled automatically.");
    }
    router.refresh();
  }

  async function onClick() {
    if (!window.Razorpay) {
      toast.error("The payment window could not load. Check your connection and try again.");
      return;
    }
    setLoading(true);
    const result = await startCheckoutAction();
    if (!result.ok) {
      setLoading(false);
      toast.error(result.message);
      return;
    }
    track("checkout_initiated", { plan: "parmarpro_clinic_monthly" });
    const order = result.data;
    const checkout = new window.Razorpay({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amountPaise,
      currency: order.currency,
      name: "ParmarPro",
      description: `${order.planName}: 1 month`,
      notes: { purpose: "ParmarPro subscription" },
      theme: { color: "#14808a" },
      handler: (response: RazorpaySuccess) => {
        void verify(response).finally(() => setLoading(false));
      },
      modal: { ondismiss: () => setLoading(false) },
    });
    checkout.on("payment.failed", () => {
      toast.error("The payment did not go through. No access was changed; you can try again.");
      setLoading(false);
    });
    checkout.open();
  }

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" onReady={() => setScriptReady(true)} />
      <Button size="lg" onClick={onClick} disabled={loading || !scriptReady}>
        {loading ? <Loader2Icon className="animate-spin" /> : <CreditCardIcon />}
        {label}
      </Button>
    </>
  );
}
