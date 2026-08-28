import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Serif, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { NO_FLASH_SCRIPT } from "@/lib/theme";

// One superfamily, three jobs: Sans for UI, Serif for long-form reading
// (lesson + blog body), Mono for ids, timestamps and code.
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const plexSerif = IBM_Plex_Serif({
  variable: "--font-plex-serif",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Lernexa",
    template: "%s · Lernexa",
  },
  description:
    "Lernexa is a learning platform built around progress, not catalogue — every screen answers “where am I?” before “what’s available?”",
  applicationName: "Lernexa",
  openGraph: {
    title: "Lernexa",
    description: "Learning that moves forward. Progress, not catalogue.",
    siteName: "Lernexa",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${plexSans.variable} ${plexSerif.variable} ${plexMono.variable} h-full antialiased`}
    >
      {/* suppressHydrationWarning: the no-flash script and browser extensions
          both mutate <html>/<body> before hydration. Scoped one level deep —
          real content mismatches still warn. */}
      <body
        suppressHydrationWarning
        className="flex min-h-full flex-col overflow-x-hidden"
      >
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
