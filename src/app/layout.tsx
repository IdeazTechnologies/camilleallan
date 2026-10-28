import type { Metadata, Viewport } from "next";
import { Jost, PT_Serif, Poppins } from "next/font/google";
import { getSettings } from "@/lib/settings";
import { themeInitScript } from "@/lib/theme";
import { appUrl } from "@/lib/utils";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

const ptSerif = PT_Serif({
  variable: "--font-pt-serif",
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
  weight: ["600"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return {
    metadataBase: new URL(appUrl()),
    title: { default: `${settings.storeName} | ${settings.tagline}`, template: `%s | ${settings.storeName}` },
    description: settings.heroSubtitle,
    openGraph: { siteName: settings.storeName, type: "website", locale: "en_CA" },
  };
}

export const viewport: Viewport = {
  themeColor: "#151312",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The head script may switch data-theme before hydration.
    <html lang="en" data-theme="dark" className={`${poppins.variable} ${ptSerif.variable} ${jost.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
