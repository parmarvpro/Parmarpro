import type { Metadata } from "next";

import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = { title: "Privacy notice" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy notice" updated="30 October 2026">
      <p>
        This notice explains what personal data ParmarPro handles, why, and the choices you have. ParmarPro is software
        used by dental clinics to manage inquiries, appointments and follow-up work.
      </p>

      <h2>Who is responsible</h2>
      <p>
        For information that a clinic enters about its patients and inquirers, the clinic decides why and how that data
        is used. ParmarPro processes it on the clinic&apos;s behalf and only to provide the service. For account,
        billing, website and product-usage data about clinic staff and visitors to our website, ParmarPro is responsible.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account data:</strong> name, email address and sign-in details of clinic staff. Sign-in is provided by
          Clerk, which stores passwords and multi-factor settings. ParmarPro does not store passwords.
        </li>
        <li>
          <strong>Clinic records entered by clinics:</strong> patient and inquiry names, phone numbers, email addresses,
          communication consent and opt-outs, inquiry source and status, appointment times and status, follow-up tasks,
          and short operational notes. ParmarPro is not designed for clinical notes, diagnoses or prescriptions, and
          clinics are asked not to enter them.
        </li>
        <li>
          <strong>Billing data:</strong> order and payment identifiers, amounts, payment status and method type from
          Razorpay. Card numbers, CVV, UPI PINs and bank credentials are collected by Razorpay and never reach ParmarPro.
        </li>
        <li>
          <strong>Contact form:</strong> the name, clinic, phone, email, city and message you send us.
        </li>
        <li>
          <strong>Product usage:</strong> events such as &ldquo;lead created&rdquo; or &ldquo;billing page viewed&rdquo;,
          with an anonymous clinic identifier. These events never include patient names, phone numbers, email addresses
          or notes.
        </li>
        <li>
          <strong>Error reports:</strong> technical information about application errors, with personal data removed
          before the report leaves the application.
        </li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To provide the service, keep each clinic&apos;s data separate and enforce team permissions.</li>
        <li>To process payments and keep billing records.</li>
        <li>To respond to your enquiries.</li>
        <li>To fix errors and understand which product features are used, so we can improve them.</li>
      </ul>
      <p>We do not sell personal data and we do not use clinic records for advertising.</p>

      <h2>Emails we send</h2>
      <p>
        Staff morning summaries contain counts only, with no patient or colleague names. Appointment reminder emails go only
        to patients who agreed to email contact. They carry the patient&apos;s first name, the clinic and the appointment
        time, contain no clinical information, and always include a link that stops them.
      </p>

      <h2>Service providers</h2>
      <ul>
        <li>Supabase: database hosting (Mumbai region, ap-south-1).</li>
        <li>Clerk: sign-in, sessions and team invitations.</li>
        <li>Resend: sending service emails such as reminders, summaries and receipts.</li>
        <li>Google (Gemini API, paid service): sorting enquiries and drafting suggested replies, only for clinics that turn on AI help.</li>
        <li>Razorpay: payment processing.</li>
        <li>Vercel: application hosting.</li>
        <li>Sentry: error monitoring (scrubbed reports).</li>
        <li>PostHog: product analytics (no patient data; you can opt out).</li>
      </ul>
      <p>Some of these providers may process data outside India under their own security and contractual safeguards.</p>

      <h2>AI help with enquiries</h2>
      <p>
        A clinic can choose to turn on AI help. When it does, the text of each enquiry the clinic receives is sent to
        Google&apos;s Gemini service to suggest the treatment it is about, how urgent it is and a reply. The enquirer&apos;s
        name, phone number and email address are removed from the text first. Google does not use this data to improve its
        products; it keeps it for a limited time only to detect misuse and meet legal requirements, and it may process it
        outside India. Clinic staff check every suggestion, and nothing is sent to anyone automatically. ParmarPro&apos;s own
        daily operations summary also uses Gemini, with counts only and no personal data.
      </p>

      <h2>Retention</h2>
      <p>
        Clinic records are kept while the clinic uses ParmarPro and deleted on the clinic&apos;s request when it closes its
        account, except where we must keep billing records for legal or tax reasons.
      </p>
      <p>Some records are kept for shorter periods:</p>
      <ul>
        <li>Contact form enquiries are deleted after 12 months.</li>
        <li>Payment and account webhook records (event identifiers and status) are deleted after 90 days.</li>
        <li>The log of emails sent is deleted after 180 days.</li>
        <li>The activity history of each clinic is deleted after 24 months.</li>
      </ul>

      <h2>Your choices and rights</h2>
      <ul>
        <li>Clinic staff can access and update their account details at any time.</li>
        <li>
          Patients and inquirers should contact their clinic first. We will help the clinic respond to access,
          correction and erasure requests.
        </li>
        <li>You can switch off product analytics with the &quot;Product analytics&quot; control in the app&apos;s sidebar.</li>
      </ul>

      <h2>Contact</h2>
      <p>Questions about privacy can be sent through our contact page.</p>
    </LegalPage>
  );
}
