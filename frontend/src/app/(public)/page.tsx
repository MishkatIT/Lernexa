import Link from "next/link";
import { SAMPLE_CATEGORIES, SAMPLE_STEPS } from "@/lib/samples";
import { Container } from "@/components/ui/Container";
import { SectionHeader } from "@/components/ui/SectionHeader";
import {
  HomePersonalizationProvider,
  HeroCtaButton,
  HeroVisual,
  ContinueSection,
  ProgressSection,
  SignedOutCta,
} from "@/components/home/personalized";

/**
 * Fully static. The session-dependent pieces (resume panel, continue cards,
 * real stat grid, signed-out CTA) are client islands under
 * `HomePersonalizationProvider` — they hydrate and, only for a signed-in
 * visitor, fetch `/api/me/home` and swap in. Everything else is prerendered
 * once and served from the edge.
 */
export default function HomePage() {
  return (
    <HomePersonalizationProvider>
      {/* ---------- Hero ---------- */}
      <section className="border-b border-ink-200">
        <Container className="grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="text-small font-medium uppercase tracking-[0.16em] text-ink-500">
              Learning that moves forward
            </p>
            <h1 className="mt-4 text-[2.5rem] font-semibold leading-[1.08] tracking-[-0.03em] text-ink-900 sm:text-[3.25rem]">
              Progress, not catalogue.
            </h1>
            <p className="mt-5 max-w-[34rem] text-reading text-ink-700">
              Most platforms open with a wall of courses. Lernexa opens with
              where you are. Every screen answers <em>“where am I?”</em> before{" "}
              <em>“what’s available?”</em>
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <HeroCtaButton />
              <Link
                href="/courses"
                className="inline-flex h-11 items-center rounded-md border border-ink-200 px-5 text-body font-medium text-ink-900 transition-colors hover:border-ink-500 hover:bg-ink-100"
              >
                Browse courses
              </Link>
            </div>
          </div>

          <div className="flex justify-center lg:justify-end">
            <HeroVisual />
          </div>
        </Container>
      </section>

      {/* ---------- Continue learning ---------- */}
      <ContinueSection />

      {/* ---------- Explore learning ---------- */}
      <section className="border-t border-ink-200">
        <Container className="py-16 sm:py-20">
          <SectionHeader
            eyebrow="Find a path"
            title="Explore learning"
            description="Structured sequences, not a search box."
          />
          <div className="mt-8 grid gap-px overflow-hidden rounded-lg border border-ink-200 bg-ink-200 sm:grid-cols-2 lg:grid-cols-3">
            {SAMPLE_CATEGORIES.map((c) => (
              <div key={c.name} className="bg-paper-raised p-5">
                <div className="flex items-baseline justify-between">
                  <p className="text-h3 text-ink-900">{c.name}</p>
                  <span className="text-small text-ink-500">
                    {c.paths} paths
                  </span>
                </div>
                <p className="mt-1.5 text-body text-ink-700">{c.blurb}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-small text-ink-500">
            Sample categories. The live catalogue is on the{" "}
            <Link href="/courses" className="text-accent-600 hover:underline">
              Courses
            </Link>{" "}
            page.
          </p>
        </Container>
      </section>

      {/* ---------- How Lernexa works ---------- */}
      <section className="border-t border-ink-200">
        <Container className="py-16 sm:py-20">
          <SectionHeader
            eyebrow="The idea"
            title="Learning should move forward."
          />
          <ol className="mt-8 grid gap-8 sm:grid-cols-3">
            {SAMPLE_STEPS.map((s, i) => (
              <li
                key={s.n}
                className={i > 0 ? "sm:border-l sm:border-ink-200 sm:pl-8" : ""}
              >
                <p className="font-mono text-small text-accent-600">{s.n}</p>
                <p className="mt-2 text-h3 text-ink-900">{s.title}</p>
                <p className="mt-2 text-body text-ink-700">{s.body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* ---------- Progress ---------- */}
      <ProgressSection />

      {/* ---------- CTA ---------- */}
      <SignedOutCta />
    </HomePersonalizationProvider>
  );
}
