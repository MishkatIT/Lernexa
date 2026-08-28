export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl animate-pulse">
      <div className="h-3 w-20 rounded bg-ink-100" />
      <div className="mt-3 h-8 w-72 rounded bg-ink-100" />
      <div className="mt-3 h-4 w-96 max-w-full rounded bg-ink-100/70" />

      <div className="mt-6 grid grid-cols-2 gap-6 border-y border-ink-200 py-6 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}>
            <div className="h-7 w-12 rounded bg-ink-100" />
            <div className="mt-2 h-3 w-16 rounded bg-ink-100/70" />
          </div>
        ))}
      </div>

      <div className="mt-10 h-5 w-40 rounded bg-ink-100" />
      <div className="mt-4 flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-14 rounded-lg border border-ink-200 bg-ink-100/40"
          />
        ))}
      </div>
    </div>
  );
}
