import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { GoogleAnalytics } from "@next/third-parties/google";

export const metadata: Metadata = {
  title: "HolidayTrip - Global Holiday & Travel Guide",
  description: "Check public holidays, travel tips, local prices, exchange rates, plug types, and transport costs for 50+ countries. Plan smarter trips with HolidayTrip.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-[#faf8f5] min-h-screen flex flex-col">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link href="/" className="text-base font-semibold text-gray-900 hover:text-gray-700 transition-colors">
              🌍 HolidayTrip
            </Link>
            <nav className="flex items-center gap-5 text-sm text-gray-600">
              <Link href="/" className="hover:text-gray-900 transition-colors hidden sm:block">Countries</Link>
              <Link href="/about" className="hover:text-gray-900 transition-colors">About</Link>
              <Link href="/contact" className="hover:text-gray-900 transition-colors">Contact</Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="bg-white border-t border-gray-200 mt-12">
          <div className="max-w-6xl mx-auto px-4 py-8">
            <div className="flex flex-col sm:flex-row justify-between gap-6">
              <div>
                <div className="text-base font-semibold text-gray-900 mb-1">🌍 HolidayTrip</div>
                <p className="text-xs text-gray-500 max-w-xs leading-relaxed">
                  Public holidays, travel tips, local prices, and essential info for 50+ countries.
                </p>
              </div>
              <div className="flex gap-10 text-sm">
                <div>
                  <div className="text-xs font-semibold text-gray-900 uppercase tracking-wide mb-2">Company</div>
                  <div className="flex flex-col gap-1.5">
                    <Link href="/public-holidays-today" className="text-gray-500 hover:text-gray-900 transition-colors">Holidays Today</Link>
                    <Link href="/about" className="text-gray-500 hover:text-gray-900 transition-colors">About</Link>
                    <Link href="/contact" className="text-gray-500 hover:text-gray-900 transition-colors">Contact</Link>
                    <Link href="/privacy" className="text-gray-500 hover:text-gray-900 transition-colors">Privacy Policy</Link>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-gray-400">
              <span>© 2026 HolidayTrip. All rights reserved.</span>
              <span>Holiday data is for reference only. Verify with official sources before travel.</span>
            </div>
          </div>
        </footer>
      </body>
      <GoogleAnalytics gaId="G-78KBHOBB35" />
    </html>
  );
}
