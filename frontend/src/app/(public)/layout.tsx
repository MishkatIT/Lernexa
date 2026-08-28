import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/session";
import { dashboardPathFor } from "@/lib/roles";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Footer } from "@/components/site/Footer";

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader
        user={user ? { dashboardPath: dashboardPathFor(user.role?.type) } : null}
      />
      {/* Each page owns its Container so the homepage can run full-bleed. */}
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
