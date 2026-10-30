import { Logo } from "@/components/logo";
import { CardDescription, CardHeader, CardTitle, Card } from "@/components/ui/card";

/**
 * Shown when the clinic database is not connected. Sign-in still works, but
 * no clinic record can be loaded, so the dashboard and onboarding stop here.
 */
export function NotConnected() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center px-4 sm:px-6">
        <Logo />
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-12 sm:px-6">
        <Card>
          <CardHeader>
            <CardTitle>Clinic data is not connected yet</CardTitle>
            <CardDescription>
              You are signed in, but ParmarPro cannot load your clinic&apos;s records right now. Please try again later.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    </div>
  );
}
