import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FOROOMS: Participatory Urban Planning",
  description: "A Living Digital Twin web application for civic planning and simulation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} antialiased`}
    >
      <body className="w-screen h-screen overflow-hidden bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
