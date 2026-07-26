import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Ripped Fat Dude Hypertrophy Tracker",
    template: "%s · RFD Hypertrophy Tracker",
  },
  description: "Hypertrophy planning, stimulus logging, mesocycle review, and physique metrics for experienced lifters.",
  applicationName: "Ripped Fat Dude Hypertrophy Tracker",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#071018",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
