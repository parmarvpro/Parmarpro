import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { Toaster } from "sonner";

import { publicEnv } from "@/lib/env";

import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const instrumentSerif = Instrument_Serif({ variable: "--font-instrument-serif", subsets: ["latin"], weight: "400", style: "italic" });

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.NEXT_PUBLIC_APP_URL),
  title: {
    default: "ParmarPro: patient follow-up and clinic operations for dental clinics",
    template: "%s · ParmarPro",
  },
  description:
    "ParmarPro helps dental clinics in Mumbai track inquiries, follow-ups, appointments and team tasks in one secure workspace.",
  robots: publicEnv.NEXT_PUBLIC_APP_ENV === "production" ? undefined : { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

/** Clerk's hosted components (sign-in, organization switcher, user menu) in the ParmarPro palette. */
const clerkAppearance = {
  variables: {
    colorPrimary: "#1f5bff",
    colorPrimaryForeground: "#ffffff",
    colorForeground: "#12151b",
    colorMutedForeground: "#5e6575",
    colorBackground: "#ffffff",
    colorInput: "#ffffff",
    colorInputForeground: "#12151b",
    colorBorder: "#d3ddf5",
    colorRing: "#5b87ff",
    colorDanger: "#c4261a",
    colorSuccess: "#0e7a43",
    colorWarning: "#9a4a08",
    borderRadius: "0.75rem",
    fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
    fontFamilyButtons: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
  },
  elements: {
    card: "shadow-none border border-hairline rounded-2xl",
    formButtonPrimary: "rounded-full shadow-none",
    socialButtonsBlockButton: "rounded-full",
    footerActionLink: "text-brand-600",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <ClerkProvider afterSignOutUrl="/" signInUrl="/sign-in" signUpUrl="/sign-up" appearance={clerkAppearance}>
      <html lang="en-IN" className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full`}>
        <body className="flex min-h-full flex-col font-sans">
          {children}
          <Toaster richColors closeButton position="top-right" toastOptions={{ classNames: { toast: "rounded-2xl" } }} />
        </body>
      </html>
    </ClerkProvider>
  );
}
