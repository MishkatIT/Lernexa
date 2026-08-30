"use client";

import { NO_FLASH_SCRIPT } from "@/lib/theme";

/**
 * Applies the saved theme to <html> before first paint, so a returning
 * dark-mode visitor never sees a light flash.
 *
 * Must be a Client Component for the `type` trick to work: on the server it
 * renders `text/javascript`, so the browser executes it during HTML parse; when
 * React renders it in the browser (hydration, Strict-Mode remount) it becomes
 * inert `text/plain`, which is also what stops React's dev warning about
 * rendering <script> tags. `suppressHydrationWarning` covers the type mismatch.
 * The real client-side theme sync lives in ThemeProvider.
 */
export function NoFlashScript() {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }}
    />
  );
}
