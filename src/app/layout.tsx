import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "Terapeut — AI Terapeut & Kouč",
  description:
    "Tvůj osobní AI terapeut a kouč. Mluv hlasem, sleduj pokrok, měň návyky.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Terapeut",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
        {children}
      </body>
    </html>
  );
}
