import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Footer } from "@/components/site/Footer";

/**
 * No session read here — `SiteHeader` fetches it on the client
 * (`GET /api/auth/me`). That keeps this layout static, so any page under it
 * that doesn't itself touch the cookie (a blog article) prerenders / ISRs
 * instead of rendering per request.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    // flex-1 fills <body> (min-h-dvh flex-col), so <main> can push the footer
    // to the bottom on short pages.
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      {/* Each page owns its Container so the homepage can run full-bleed. */}
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
