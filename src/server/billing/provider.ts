/**
 * Payment-provider abstraction. Razorpay is the first implementation; another
 * provider can be added without touching the routes or the database logic.
 */
export type ProviderPaymentStatus = "created" | "authorized" | "captured" | "refunded" | "failed";

export type ProviderPayment = {
  id: string;
  orderId: string | null;
  status: ProviderPaymentStatus;
  amountPaise: number;
  currency: string;
  method: string | null;
  errorCode: string | null;
};

export type ProviderOrder = { id: string; amountPaise: number; currency: string; receipt: string | null };

export interface BillingProvider {
  readonly name: "razorpay";
  /** Public key id that the browser checkout needs. Not secret. */
  publicKeyId(): string;
  createOrder(params: { receipt: string; amountPaise: number; currency: "INR"; notes: Record<string, string> }): Promise<ProviderOrder>;
  fetchPayment(paymentId: string): Promise<ProviderPayment>;
  /** Every payment attempt made against one provider order. Used by the reconciliation job. */
  fetchOrderPayments(orderId: string): Promise<ProviderPayment[]>;
  verifyCheckoutSignature(params: { orderId: string; paymentId: string; signature: string }): boolean;
}
