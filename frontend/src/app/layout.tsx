import type { Metadata } from "next";
import { Chivo_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const chivoMono = Chivo_Mono({
  variable: "--font-chivo-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StratosERP Portal",
  description: "Role-based portal for StratosERP modules.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${chivoMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-app-gradient text-zinc-900">
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="orb orb-one" />
          <div className="orb orb-two" />
        </div>
        {children}
      </body>
    </html>
  );
}
