import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HolidayTrip - Global Holiday & Travel Guide",
  description: "Your global guide to holidays, travel information, and local insights from around the world.",
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