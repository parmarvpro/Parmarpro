import { MotionProvider } from "@/components/motion/motion-provider";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <MotionProvider>
      <div className="grain" aria-hidden="true" />
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </MotionProvider>
  );
}
