import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "MINISTRY OF HOME AFFAIRS // Criminal Network Analysis System (SIH26189)",
  description:
    "Government of India - Law Enforcement Portal. AI Criminal Network & Anti-Money Laundering Intelligence System compliant with BSA 2023 & DPDPA.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <body
        className={`${inter.variable} font-sans antialiased bg-slate-50 text-slate-900 min-h-screen selection:bg-amber-200 selection:text-slate-900`}
        suppressHydrationWarning
      >
        {children}
        <Toaster
          theme="light"
          position="bottom-right"
          richColors
          closeButton
          toastOptions={{
            style: {
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              color: "#0f172a",
              fontFamily: "inherit",
              fontSize: "13px",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
            },
          }}
        />
      </body>
    </html>
  );
}
