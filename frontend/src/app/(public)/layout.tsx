import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/session";
import { dashboardPathFor } from "@/lib/roles";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Footer } from "@/components/site/Footer";

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  return (
    // flex-1 fills <body> (min-h-dvh flex-col), so <main> can push the footer
    // to the bottom on short pages.
    <div className="flex flex-1 flex-col">
      <SiteHeader
        user={
          user
            ? {
                name: user.fullName ?? user.username,
                email: user.email,
                avatarUrl: user.avatarUrl,
                dashboardPath: dashboardPathFor(user.role?.type),
              }
            : null
        }
      />
      {/* Each page owns its Container so the homepage can run full-bleed. */}
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
