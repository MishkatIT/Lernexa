import { Container } from "@/components/ui/Container";

export default function Loading() {
  return (
    <Container size="wide" className="animate-pulse py-10 sm:py-14">
      <div className="h-3 w-24 rounded bg-ink-100" />
      <div className="mt-2 h-9 w-64 rounded bg-ink-100" />

      <div className="mt-8 grid grid-cols-2 gap-6 border-y border-ink-200 py-6 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}>
            <div className="h-7 w-12 rounded bg-ink-100" />
            <div className="mt-2 h-3 w-16 rounded bg-ink-100/70" />
          </div>
        ))}
      </div>

      <div className="mt-8 h-28 rounded-lg border border-ink-200 bg-ink-100/50" />

      <div className="mt-12 h-5 w-32 rounded bg-ink-100" />
      <div className="mt-5 flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-20 rounded-lg border border-ink-200 bg-ink-100/40"
          />
        ))}
      </div>
    </Container>
  );
}
