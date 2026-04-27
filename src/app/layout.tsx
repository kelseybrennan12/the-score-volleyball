import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Score Beach Volleyball League Viewer",
  description: "Find your team's schedule, record, and next match across thescoregr.com beach volleyball leagues.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <NuqsAdapter>{children}</NuqsAdapter>
        <Analytics />
      </body>
    </html>
  );
}
