"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { updateAvatar } from "@/actions/profile";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { useToast } from "@/components/ui/Toast";

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";
const MAX_SOURCE_BYTES = 10 * 1024 * 1024; // reject before decoding anything huge
const OUTPUT_SIZE = 256; // square, px

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "•";
}

/** Decode, cover-crop to a centred square and re-encode small. */
async function resizeToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  }).catch(() => null);

  let source: CanvasImageSource;
  let w: number;
  let h: number;

  if (bitmap) {
    source = bitmap;
    w = bitmap.width;
    h = bitmap.height;
  } else {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("decode failed"));
        el.src = url;
      });
      source = img;
      w = img.naturalWidth;
      h = img.naturalHeight;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported in this browser");

  const scale = Math.max(OUTPUT_SIZE / w, OUTPUT_SIZE / h);
  const dw = w * scale;
  const dh = h * scale;
  ctx.drawImage(source, (OUTPUT_SIZE - dw) / 2, (OUTPUT_SIZE - dh) / 2, dw, dh);
  if (bitmap) bitmap.close();

  let out = canvas.toDataURL("image/webp", 0.85);
  if (!out.startsWith("data:image/webp")) {
    out = canvas.toDataURL("image/jpeg", 0.85); // Safari <16 has no WebP encode
  }
  return out;
}

export function AvatarField({
  initialUrl,
  name,
}: {
  initialUrl: string | null;
  name: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(initialUrl);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be re-picked later
    if (!file) return;

    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("That file isn't an image.");
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      setError("Pick an image under 10 MB.");
      return;
    }

    setBusy("upload");
    try {
      const dataUrl = await resizeToDataUrl(file);
      const res = await updateAvatar({ avatarUrl: dataUrl });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setUrl(dataUrl);
      toast("Photo updated");
      router.refresh();
    } catch {
      setError("That image couldn't be processed. Try a different file.");
    } finally {
      setBusy(null);
    }
  }

  async function onRemove() {
    setError(null);
    setBusy("remove");
    const res = await updateAvatar({ avatarUrl: "" });
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setUrl(null);
    toast("Photo removed");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? <Alert>{error}</Alert> : null}

      <div className="flex items-center gap-4">
        <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border border-ink-200 bg-ink-100 text-h3 font-medium text-ink-700">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URL / arbitrary host; no next/image pipeline in this app
            <img
              src={url}
              alt=""
              className="h-full w-full object-cover"
              draggable={false}
            />
          ) : (
            initials(name)
          )}
        </span>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            onChange={onPick}
            className="hidden"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={busy === "upload"}
            loadingLabel="Uploading…"
            onClick={() => inputRef.current?.click()}
          >
            {url ? "Change photo" : "Upload photo"}
          </Button>
          {url ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              loading={busy === "remove"}
              loadingLabel="Removing…"
              onClick={onRemove}
            >
              Remove
            </Button>
          ) : null}
        </div>
      </div>

      <p className="text-small text-ink-500">
        PNG, JPG, WebP or GIF. Cropped to a square and resized to {OUTPUT_SIZE}px.
      </p>
    </div>
  );
}
