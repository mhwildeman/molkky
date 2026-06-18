import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Molkky Tournament Director",
  description: "Run a multi-field Molkky tournament with rotating opponents, semifinals, and a final.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
