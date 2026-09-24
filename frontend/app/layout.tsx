import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
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
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${inter.className} antialiased bg-[#070d18] text-slate-100 min-h-screen selection:bg-amber-500 selection:text-slate-950`}
        suppressHydrationWarning
      >
        {children}
        <Toaster
          theme="dark"
          position="bottom-right"
          richColors
          closeButton
          toastOptions={{
            style: {
              background: "#0f172a",
              border: "1px solid #334155",
              color: "#f8fafc",
              fontFamily: "inherit",
              fontSize: "12px",
            },
          }}
        />
      </body>
    </html>
  );
}
