const PRICE = 12;

export default function Home() {
  return (
    <main>
      <section className="hero">
        <h1>Plan the trip, not the spreadsheet.</h1>
        <p>Lanternfield keeps your group&rsquo;s camping plans in one calm place.</p>
        <a className="cta" href="#pricing">
          See plans
        </a>
      </section>
      <section id="pricing">
        <h2>Simple pricing</h2>
        <p>
          One plan, ${PRICE} a month, for the whole group.
        </p>
      </section>
      <section id="faq">
        <h2>Questions</h2>
        <h3>Do I need an app?</h3>
        <p>No. Everything works in the browser on any phone.</p>
      </section>
    </main>
  );
}
