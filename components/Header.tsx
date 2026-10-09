import Link from "next/link";

export function Header() {
  return (
    <header className="header">
      <Link href="/" className="logo">
        Lanternfield
      </Link>
      <nav>
        <a href="#pricing">Pricing</a>
        <a href="#faq">Questions</a>
      </nav>
    </header>
  );
}
