"use client";

import { useEffect, useState } from "react";

import { beginAuthorization, CALLBACK_PATH, resolveEditorPhase, signOut } from "./refino-client";
import type { EditorPhase } from "./refino-client";

/**
 * Owner entry point for Refino-hosted editing. Visiting /edit sends the
 * owner to Refino to sign in and authorize this site; Refino sends them
 * back here with a one-time code, which is exchanged for an editor session
 * and scrubbed from the URL. The page then stays here and says so: /edit
 * with an editor session is the handoff, and it is safe to revisit.
 *
 * This file is yours. Restyle it, rewrite the markup, drop the styles below
 * and use your own -- keep the three phases, the link to `phase.openHref`
 * and the sign-out button, and the flow keeps working.
 */
const STYLES = `
.refino-edit {
  --refino-ink: #0f172a;
  --refino-ink-soft: #334155;
  --refino-muted: #64748b;
  --refino-line: #e2e8f0;
  --refino-accent: #0f766e;
  --refino-accent-strong: #115e59;
  --refino-accent-soft: #ccfbf1;
  display: flex;
  min-height: 100vh;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 24px 16px 56px;
  background: #f8fafc;
  color: var(--refino-ink);
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
}
.refino-edit *,
.refino-edit *::before,
.refino-edit *::after { box-sizing: border-box; }
.refino-edit__card {
  width: 100%;
  /* Roughly 45 characters a line: long enough to read, short enough to scan. */
  max-width: 26rem;
  padding: 28px 28px 20px;
  border: 1px solid var(--refino-line);
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 10px 28px rgba(15, 23, 42, 0.06);
}
.refino-edit__eyebrow {
  margin: 0 0 20px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.01em;
  color: var(--refino-muted);
}
.refino-edit__title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 8px;
  font-size: 22px;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.01em;
}
.refino-edit__check {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 999px;
  background: var(--refino-accent-soft);
  color: var(--refino-accent-strong);
  font-size: 15px;
}
.refino-edit__body {
  margin: 0 0 20px;
  color: var(--refino-ink-soft);
}
.refino-edit__cta {
  display: block;
  width: 100%;
  padding: 11px 16px;
  border: 1px solid var(--refino-accent);
  border-radius: 8px;
  background: var(--refino-accent);
  color: #ffffff;
  font: inherit;
  font-weight: 600;
  text-align: center;
  text-decoration: none;
  cursor: pointer;
}
.refino-edit__cta:hover { background: var(--refino-accent-strong); border-color: var(--refino-accent-strong); }
.refino-edit__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 10px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--refino-line);
}
.refino-edit__signout {
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: none;
  color: var(--refino-accent-strong);
  font: inherit;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}
.refino-edit__signout:hover { color: var(--refino-ink); }
.refino-edit__hint {
  color: var(--refino-muted);
  font-size: 13px;
}
.refino-edit__cta:focus-visible,
.refino-edit__signout:focus-visible {
  outline: 2px solid var(--refino-accent-strong);
  outline-offset: 2px;
}
@media (max-width: 420px) {
  .refino-edit__card { padding: 22px 20px 16px; }
  .refino-edit__title { font-size: 20px; }
}
`;

export default function EditPage() {
  const [phase, setPhase] = useState<EditorPhase>({ kind: "authorizing" });

  useEffect(() => {
    let cancelled = false;
    void resolveEditorPhase().then((next) => {
      if (!cancelled) setPhase(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="refino-edit">
      <style>{STYLES}</style>
      <div className="refino-edit__card" aria-live="polite">
        <p className="refino-edit__eyebrow">Refino</p>

        {phase.kind === "authorizing" && (
          <>
            <h1 className="refino-edit__title">Signing you in…</h1>
            <p className="refino-edit__body">Refino is checking that you may edit this site.</p>
          </>
        )}

        {phase.kind === "ready" && (
          <>
            <h1 className="refino-edit__title">
              <span className="refino-edit__check" aria-hidden="true">✓</span>
              Edit mode is on
            </h1>
            <p className="refino-edit__body">Open your site, click any text you want to change, and press Save when you are done.</p>
            <a className="refino-edit__cta" href={phase.openHref}>
              Open the site
            </a>
          </>
        )}

        {phase.kind === "error" && (
          <>
            <h1 className="refino-edit__title">Could not start editing</h1>
            <p className="refino-edit__body" role="alert">
              {phase.message}
            </p>
            <button className="refino-edit__cta" type="button" onClick={() => void beginAuthorization(CALLBACK_PATH)}>
              Try again
            </button>
          </>
        )}

        {phase.kind !== "authorizing" && (
          <p className="refino-edit__footer">
            <button className="refino-edit__signout" type="button" onClick={signOut}>
              Sign out
            </button>
            <span className="refino-edit__hint">Ends edit mode here and your Refino session.</span>
          </p>
        )}
      </div>
    </main>
  );
}
