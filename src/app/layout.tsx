import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";

import { ThemeProvider } from "@/components/providers/theme-provider";
import { publicEnv } from "@/lib/env";

import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfdfd" },
    { media: "(prefers-color-scheme: dark)", color: "#141b22" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <ClerkProvider afterSignOutUrl="/" signInUrl="/sign-in" signUpUrl="/sign-up">
      <html lang="en-IN" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full`}>
        <body className="flex min-h-full flex-col font-sans">
          <ThemeProvider>
            {children}
            <Toaster richColors closeButton position="top-right" />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
