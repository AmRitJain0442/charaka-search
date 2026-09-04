import type { Metadata } from "next";
import { Instrument_Sans, Noto_Serif_Devanagari } from "next/font/google";
import "./globals.css";

const instrument = Instrument_Sans({
  variable: "--font-interface",
  subsets: ["latin"],
});

const devanagari = Noto_Serif_Devanagari({
  variable: "--font-devanagari",
  subsets: ["devanagari"],
});

export const metadata: Metadata = {
  title: "चरक — Search the Charakasaṃhitā",
  description: "Ask in everyday language. Retrieve the original Sanskrit passage.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${instrument.variable} ${devanagari.variable}`}>{children}</body>
    </html>
  );
}
