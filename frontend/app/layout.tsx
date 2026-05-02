import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { QueryClientWrapper } from "@/components/QueryClientWrapper";
import { Toaster } from "react-hot-toast";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "TechAnalysis Pro — Automated Technical Analysis Reports",
  description: "Generate professional daily technical analysis reports for Forex, Gold, Indices, and Crypto. Automated PDF generation, email delivery, and institutional-grade commentary.",
  keywords: "technical analysis, forex, trading signals, market analysis, PDF reports",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <QueryClientWrapper>
          <AuthProvider>
            {children}
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#1e293b',
                  color: '#f1f5f9',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  fontSize: '14px',
                },
              }}
            />
          </AuthProvider>
        </QueryClientWrapper>
      </body>
    </html>
  );
}
