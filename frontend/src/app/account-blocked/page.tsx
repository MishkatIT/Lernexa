import type { Metadata } from "next";
import { BrandMark } from "@/components/Brand";
import { Alert } from "@/components/ui/Alert";
import { ClearSessionLink } from "@/components/ClearSessionLink";

export const metadata: Metadata = { title: "Account blocked" };

export default async function AccountBlockedPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const reason = (await searchParams).reason?.trim();

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <BrandMark className="text-ink-500" />
      <h1 className="mt-6 text-h1 text-ink-900">Your account has been blocked</h1>
      <p className="mt-2 max-w-sm text-body text-ink-700">
        An administrator has blocked your access to Lernexa.
      </p>
      {reason ? (
        <Alert className="mt-5 max-w-sm text-left">
          <span className="font-medium">Reason:</span> {reason}
        </Alert>
      ) : null}
      <p className="mt-5 text-small text-ink-500">
        If you think this is a mistake, contact an administrator.
      </p>
      <div className="mt-6">
        <ClearSessionLink />
      </div>
    </div>
  );
}
