import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Vigil — Geopolitical Intelligence",
  description: "Real-time geopolitical threat intelligence for traders and risk teams.",
  openGraph: {
    title: "Vigil — Geopolitical Intelligence",
    description: "Track geopolitical threats, probabilities, and portfolio exposure in real time.",
    type: "website",
    url: "https://vigil.local",
    siteName: "Vigil",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vigil — Geopolitical Intelligence",
    description: "Track geopolitical threats, probabilities, and portfolio exposure in real time.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className={`${inter.className} min-h-0 antialiased`}>
        <ConvexClientProvider>
          {children}
        </ConvexClientProvider>
      </body>
    </html>
  );
}
