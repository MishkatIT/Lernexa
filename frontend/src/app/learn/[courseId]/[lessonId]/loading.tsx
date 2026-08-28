export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[68ch] animate-pulse px-6 py-10">
      <div className="h-4 w-16 rounded-sm bg-ink-100" />
      <div className="mt-2 h-8 w-2/3 rounded-sm bg-ink-100" />
      <div className="mt-6 flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-4 rounded-sm bg-ink-100/60" />
        ))}
      </div>
    </div>
  );
}
