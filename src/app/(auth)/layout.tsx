import { BrandPanel } from "@/components/brand/brand-panel";
import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center px-4 sm:px-6">
        <Logo />
      </header>
      <div className="mx-auto grid w-full max-w-6xl flex-1 gap-8 px-4 pt-4 pb-16 sm:px-6 lg:grid-cols-[1fr_1.05fr]">
        <BrandPanel title="Let's get your clinic sorted" className="hidden min-h-[36rem] lg:block" />
        <main id="main" className="flex items-start justify-center lg:items-center">
          {children}
        </main>
      </div>
    </div>
  );
}
