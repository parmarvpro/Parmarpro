import type { Metadata } from "next";

import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = { title: "Terms of service" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of service" updated="28 October 2026">
      <p>
        These terms apply to clinics and their team members who use ParmarPro. By creating a clinic workspace you agree
        to them on behalf of your clinic.
      </p>

      <h2>The service</h2>
      <p>
        ParmarPro provides tools to record inquiries, patient contact details, appointments, follow-up tasks and team
        roles. It is an operational tool. It is not an electronic health record, a medical device or a source of
        clinical advice.
      </p>

      <h2>Your responsibilities</h2>
      <ul>
        <li>Enter only the information you need for clinic operations, and have a lawful basis to record it.</li>
        <li>Record and respect patients&apos; communication consent and opt-outs.</li>
        <li>Do not enter clinical notes, diagnoses, prescriptions or other health records.</li>
        <li>Keep sign-in credentials secure, use multi-factor authentication where possible, and remove access for staff who leave.</li>
      </ul>

      <h2>Trial, fees and renewal</h2>
      <ul>
        <li>New clinics start with a free trial. No payment details are needed to start.</li>
        <li>
          After the trial, the plan is billed per clinic per month in advance: ₹75,000 plus applicable GST (currently
          18%). The clinic owner pays each month through Razorpay; there is no automatic debit.
        </li>
        <li>
          Access to create and update records is extended only after Razorpay confirms the payment. If a paid month
          lapses, existing records remain readable and the clinic can renew at any time.
        </li>
      </ul>

      <h2>Data</h2>
      <p>
        Your clinic owns the records it enters. We process them only to provide the service, as described in the
        privacy notice. On request when you close your account, we delete clinic records, except billing records that
        we must keep by law.
      </p>

      <h2>Availability and changes</h2>
      <p>
        We work to keep ParmarPro available and secure, but the service is provided without a guarantee of
        uninterrupted availability. We will give reasonable notice of material changes to these terms or to pricing.
      </p>

      <h2>Contact</h2>
      <p>Questions about these terms can be sent through our contact page.</p>
    </LegalPage>
  );
}
