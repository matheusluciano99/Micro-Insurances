import type { ReactNode } from "react";
import { Fraunces, Manrope } from "next/font/google";

import "./globals.css";
import { Navbar } from "@/components/navbar";
import { AuthProvider } from "@/lib/auth-context";
import { Footer } from "@/components/footter";

const sansFont = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
});

const headingFont = Fraunces({
  subsets: ["latin"],
  variable: "--font-heading",
});

export const metadata = {
  title: "AgroSeguro",
  description: "Seguro agricola descentralizado",
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="pt-BR">
      <body className={`${sansFont.variable} ${headingFont.variable} antialiased`}>
        <AuthProvider>
            <Navbar />
            {children}
            <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
