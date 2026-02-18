import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Video Merger Dashboard",
  description: "Merge videos from Google Drive with optional music",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
