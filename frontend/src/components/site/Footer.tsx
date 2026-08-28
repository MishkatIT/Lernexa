import Link from "next/link";
import { BrandMark } from "@/components/Brand";
import { Container } from "@/components/ui/Container";

const EXPLORE = [
  { href: "/courses", label: "Courses" },
  { href: "/blog", label: "Blog" },
];

export function Footer() {
  return (
    <footer data-surface className="mt-24 border-t border-ink-200 bg-paper-raised">
      <Container className="flex flex-col gap-10 py-12 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-sm">
          <div className="flex items-center gap-2.5 text-ink-900">
            <BrandMark />
            <span className="text-h3">Lernexa</span>
          </div>
          <p className="mt-3 text-small text-ink-700">
            Learning that moves forward.
          </p>
          <p className="mt-1 text-small text-ink-500">
            Every screen answers “where am I?” before “what’s available?”
          </p>
        </div>

        <div className="grid grid-cols-2 gap-x-14 gap-y-2 text-small">
          <p className="col-span-2 mb-1 font-medium uppercase tracking-[0.14em] text-ink-500">
            Explore
          </p>
          {EXPLORE.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-ink-700 hover:text-ink-900"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </Container>

      <div className="border-t border-ink-200">
        <Container className="py-5">
          <p className="text-small text-ink-500">
            © {new Date().getFullYear()} Lernexa
          </p>
        </Container>
      </div>
    </footer>
  );
}
