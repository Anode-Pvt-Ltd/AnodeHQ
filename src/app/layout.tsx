import type { Metadata, Viewport } from "next";
import { Outfit, Public_Sans, IBM_Plex_Mono } from "next/font/google";
import { themeScript } from "@/components/layout/ThemeToggle";
import { getSettings } from "@/lib/queries";
import { absoluteUrl } from "@/lib/utils";
import "./globals.css";

const display = Outfit({ subsets: ["latin"], variable: "--font-outfit", display: "swap", weight: ["400", "500", "600", "700"] });
const body = Public_Sans({ subsets: ["latin"], variable: "--font-public-sans", display: "swap", weight: ["400", "500", "600"] });
const mono = IBM_Plex_Mono({ subsets: ["latin"], variable: "--font-plex-mono", display: "swap", weight: ["400", "500"] });

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    metadataBase: new URL(absoluteUrl("/")),
    title: { default: s.seo.defaultTitle, template: s.seo.titleTemplate },
    description: s.seo.description,
    applicationName: "Anode",
    openGraph: {
      type: "website",
      siteName: "Anode",
      locale: "en_GB",
      title: s.seo.defaultTitle,
      description: s.seo.description,
      url: absoluteUrl("/"),
      images: [{ url: "/img/og-default.svg", width: 1200, height: 900, alt: "Anode — electronics design and engineering" }],
    },
    twitter: { card: "summary_large_image", title: s.seo.defaultTitle, description: s.seo.description },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
    alternates: { canonical: "/", types: { "application/rss+xml": "/rss.xml" } },
    icons: {
      icon: [{ url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" }, { url: "/brand/icon-192.png", sizes: "192x192", type: "image/png" }],
      apple: [{ url: "/brand/apple-touch-icon.png", sizes: "180x180" }],
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1417" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" suppressHydrationWarning className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <head>
        {/*
          Runs before first paint so the stamped theme never flashes. It has to
          be a raw inline script in <head>: next/script defers, which would
          reintroduce the flash. React warns that scripts do not execute on
          client transitions — true, and irrelevant, because by then the
          data-theme attribute is already set.
        */}
        <script
          dangerouslySetInnerHTML={{ __html: themeScript }}
          suppressHydrationWarning
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
