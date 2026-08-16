import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono, Cormorant_Garamond } from "next/font/google";
import { LazyRootProviders } from "@/components/lazy-root-providers";
import { normalizeTheme } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Luxury serif — reserved for Beauty OS branding + rare editorial moments only.
const serif = Cormorant_Garamond({
  variable: "--font-serif",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  applicationName: "Beauty OS",
  title: "Beauty OS",
  description: "Operating system for beauty studios, salons, artists, and spas.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Beauty OS",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#7b2d56",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const theme = normalizeTheme(cookieStore.get("beauty_os_theme")?.value);

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${serif.variable} h-full antialiased`}
    >
      <body data-theme={theme} className="min-h-full flex flex-col">
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var m=localStorage.getItem("beauty_os_color_mode");if(m==="dark"||m==="light")document.documentElement.dataset.colorMode=m;}catch(e){}`,
          }}
        />
        {children}
        <LazyRootProviders />
      </body>
    </html>
  );
}
