import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Inter, Racing_Sans_One, Space_Grotesk, Space_Mono } from "next/font/google";
import { brand } from "@/config/brand";
import { bootScript } from "@/lib/closable";
import "./globals.css";

/*
 * The five typefaces the designs use. Inter carries the interface (with its optical-size
 * axis, as drawn), Space Grotesk the uppercase display lines, IBM Plex Mono the code and
 * counters. The last two appear in a few headlines only.
 */
const inter = Inter({ subsets: ["latin"], axes: ["opsz"], variable: "--font-inter", display: "swap" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-plex-mono", display: "swap" });
const racingSans = Racing_Sans_One({ subsets: ["latin"], weight: "400", variable: "--font-racing-sans", display: "swap" });
const spaceMono = Space_Mono({ subsets: ["latin"], weight: "700", variable: "--font-space-mono-face", display: "swap" });

export const metadata: Metadata = {
  title: { default: `${brand.name}: ${brand.tagline}`, template: `%s · ${brand.name}` },
  description: brand.description,
  applicationName: brand.name,
};

export const viewport: Viewport = {
  themeColor: "#0F1113",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const fonts = [inter, spaceGrotesk, plexMono, racingSans, spaceMono].map((f) => f.variable).join(" ");
  return (
    // The boot script adds `data-closed` to <html> before React starts, hence the suppression.
    <html lang="en" className={fonts} suppressHydrationWarning>
      <head>
        {/* Hides what the visitor closed earlier before the first paint. See src/lib/closable.ts. */}
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
