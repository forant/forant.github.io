import { EditableText } from "@getrefino/react";

const PRICE = 12;

export default function Home() {
  return (
    <main>
      <section className="hero">
        <EditableText id="home.hero.title" as="h1" />
        <EditableText id="home.hero.body" as="p" />
        <EditableText id="home.hero.cta" as="a" className="cta" href="#pricing" />
      </section>
      <section id="pricing">
        <EditableText id="home.pricing.title" as="h2" />
        <p>
          One plan, ${PRICE} a month, for the whole group.
        </p>
      </section>
      <section id="faq">
        <EditableText id="home.faq.title" as="h2" />
        <EditableText id="home.faq.heading" as="h3" />
        <EditableText id="home.faq.body" as="p" />
      </section>
    </main>
  );
}
