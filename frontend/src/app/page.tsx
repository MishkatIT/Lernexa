export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex flex-col items-center gap-1.5 text-ink-900" aria-hidden>
        <span className="block h-2 w-16 rounded-sm bg-ink-900" />
        <span className="block h-2 w-16 rounded-sm bg-ink-900" />
        <span className="block h-2 w-16 rounded-sm border-2 border-ink-900" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Lernexa</h1>
      <p className="max-w-md text-ink-500">
        A learning management system built around progress, not catalogue.
      </p>
    </main>
  );
}
