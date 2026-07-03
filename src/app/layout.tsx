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

import { AuthProvider } from "../contexts/AuthContext";

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
      <body className="w-screen min-h-screen bg-background text-foreground">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
