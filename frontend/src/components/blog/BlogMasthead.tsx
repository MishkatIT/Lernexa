import Link from "next/link";
import { SearchField } from "@/components/ui/SearchField";

/**
 * The blog's own masthead — sits under the global site header. Editorial title,
 * a one-line standfirst, the search field, and the Write action for editors
 * (admin / content-manager only; the button is server-gated by the page).
 */
export function BlogMasthead({ canWrite }: { canWrite: boolean }) {
  return (
    <div className="border-b border-ink-200 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-display font-semibold tracking-[-0.02em] text-ink-900 sm:text-[2.6rem] sm:leading-[1.1]">
            The Lernexa Blog
          </h1>
          <p className="mt-2 max-w-xl text-reading text-ink-700">
            Notes on building a learning platform — engineering, product, and how
            people actually learn to build software.
          </p>
        </div>

        {canWrite ? (
          <Link
            href="/manage/blog/new"
            className="inline-flex h-10 shrink-0 items-center rounded-md bg-ink-900 px-4 text-small font-medium text-paper-raised transition-opacity hover:opacity-90"
          >
            Write a post
          </Link>
        ) : null}
      </div>

      <div className="mt-6 max-w-sm">
        <SearchField placeholder="Search articles" label="" />
      </div>
    </div>
  );
}
