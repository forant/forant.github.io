import type { ReactNode } from "react";

import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";

import copy from "@/content/copy.json";
import { CopyEditing } from "@/refino/copy-editing";

import "./globals.css";

export const metadata = { title: "Lanternfield — Refino onboarding test site" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CopyEditing content={copy}>
          <Header />
          {children}
          <Footer />
        </CopyEditing>
      </body>
    </html>
  );
}
