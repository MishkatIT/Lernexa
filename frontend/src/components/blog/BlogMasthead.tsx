import { SearchField } from "@/components/ui/SearchField";
import { WritePostButton } from "@/components/blog/WritePostButton";

/**
 * The blog's own masthead — sits under the global site header. Editorial title,
 * a one-line standfirst, the search field, and the Write action for editors
 * (admin / content-manager only — resolved client-side by `WritePostButton` so
 * the page stays cache-friendly; `/manage/blog/new` is still server-gated).
 */
export function BlogMasthead() {
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

        <WritePostButton />
      </div>

      <div className="mt-6 max-w-sm">
        <SearchField placeholder="Search articles" label="" />
      </div>
    </div>
  );
}
