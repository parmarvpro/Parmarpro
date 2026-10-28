/**
 * Plan catalogue. Amounts are in paise (₹1 = 100 paise) and are the only
 * source the server uses to compute what a clinic is charged. Clients never
 * send amounts.
 */

export const GST_RATE_BASIS_POINTS = 1800; // 18%

export type Plan = {
  code: "parmarpro_clinic_monthly";
  name: string;
  basePaise: number;
  periodMonths: 1;
  features: readonly string[];
};

export const PLANS = {
  parmarpro_clinic_monthly: {
    code: "parmarpro_clinic_monthly",
    name: "ParmarPro Clinic",
    basePaise: 75_000_00,
    periodMonths: 1,
    features: [
      "Inquiry and lead tracking with sources, statuses and follow-up dates",
      "Patient contact records with communication consent and opt-out",
      "Appointment scheduling, rescheduling, cancellation and status tracking",
      "Follow-up tasks with assignment, due dates and overdue views",
      "Team roles: owner, administrator, staff and read-only",
      "Dashboard and activity history built from your clinic's own records",
    ],
  },
} as const satisfies Record<string, Plan>;

export type PlanCode = keyof typeof PLANS;
export const DEFAULT_PLAN: PlanCode = "parmarpro_clinic_monthly";

export function priceBreakdown(plan: Plan) {
  const gstPaise = Math.round((plan.basePaise * GST_RATE_BASIS_POINTS) / 10_000);
  return { basePaise: plan.basePaise, gstPaise, totalPaise: plan.basePaise + gstPaise };
}

export function formatInr(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: paise % 100 === 0 ? 0 : 2,
  }).format(paise / 100);
}

/** Trial length shown on marketing pages; enforced by private.trial_days() in the database. */
export const TRIAL_DAYS = 14;
