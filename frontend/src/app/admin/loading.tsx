export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl animate-pulse px-6 py-10">
      <div className="h-8 w-48 rounded-sm bg-ink-100" />
      <div className="mt-8 h-28 rounded-sm border border-ink-200 bg-ink-100/50" />
      <div className="mt-10 h-4 w-32 rounded-sm bg-ink-100" />
      <div className="mt-3 flex flex-col gap-2">
        <div className="h-16 rounded-sm border border-ink-200 bg-ink-100/40" />
        <div className="h-16 rounded-sm border border-ink-200 bg-ink-100/40" />
      </div>
    </div>
  );
}
