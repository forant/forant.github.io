import { EditableText } from "@getrefino/react";
import Link from "next/link";

export function Header() {
  return (
    <header className="header">
      {/* refino-ignore: the wordmark is the brand, not copy */}
      <Link href="/" className="logo">
        Lanternfield
      </Link>
      <nav>
        <EditableText id="shared.nav.pricing" as="a" href="#pricing" />
        <EditableText id="shared.nav.questions" as="a" href="#faq" />
      </nav>
    </header>
  );
}
