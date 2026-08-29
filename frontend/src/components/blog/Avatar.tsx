/**
 * Author avatar — image when set, otherwise the initial on a tonal circle.
 * The app has no next/image pipeline (data URLs / arbitrary hosts), so a plain
 * <img> is intentional here, mirroring the site header.
 */
export function Avatar({
  name,
  src,
  size = 40,
}: {
  name: string;
  src?: string | null;
  size?: number;
}) {
  const initial = (name.trim()[0] ?? "•").toUpperCase();
  return (
    <span
      aria-hidden
      className="inline-grid shrink-0 place-items-center overflow-hidden rounded-full border border-ink-200 bg-ink-100 font-medium text-ink-700"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URL / arbitrary host; no next/image pipeline in this app
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        initial
      )}
    </span>
  );
}
