import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { RecruiterProvider } from "@/contexts/RecruiterContext";
import QueryProvider from "@/providers/QueryProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Briefing Room | AI-Native Talent Intelligence",
  description: "AI-powered candidate matching and ranking system for sales professionals",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>
        <QueryProvider>
          <AuthProvider>
            <RecruiterProvider>
              {children}
            </RecruiterProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
