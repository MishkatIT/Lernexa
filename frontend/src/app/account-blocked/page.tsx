import type { Metadata } from "next";
import { ClearSessionLink } from "@/components/ClearSessionLink";

export const metadata: Metadata = { title: "Account blocked" };

export default async function AccountBlockedPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const reason = (await searchParams).reason?.trim();

  return (
    <div className="mx-auto max-w-md px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
        Your account has been blocked
      </h1>
      <p className="mt-3 text-[15px] text-ink-700">
        An administrator has blocked your access to Lernexa.
      </p>
      {reason ? (
        <p className="mt-4 border-l-[3px] border-danger bg-accent-100/40 px-4 py-3 text-left text-[14px] text-ink-900">
          <span className="font-medium">Reason:</span> {reason}
        </p>
      ) : null}
      <p className="mt-6 text-[13px] text-ink-500">
        If you think this is a mistake, contact an administrator.
      </p>
      <div className="mt-6">
        <ClearSessionLink />
      </div>
    </div>
  );
}
