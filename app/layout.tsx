import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "La Gustosa — Italiensk restaurang & bar i Borås",
  description: "Italienska smaker på Sandwallsplats 7. Meny, lunch och bordsförfrågningar.",
  icons: {
    icon: "/assets/favicon.svg",
    shortcut: "/assets/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sv">
      <body className="antialiased">{children}</body>
    </html>
  );
}
