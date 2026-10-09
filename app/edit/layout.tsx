import type { Metadata } from "next";
import type { ReactNode } from "react";

/** /edit is the owner's entry point, not a public page; the page itself is a client component and cannot export metadata. */
export const metadata: Metadata = { title: "Edit this site", robots: { index: false, follow: false } };

export default function EditLayout({ children }: { children: ReactNode }) {
  return children;
}
