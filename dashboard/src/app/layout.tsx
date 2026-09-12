import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Auditer SaaS",
  description: "Automated auditing for your infrastructure",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
