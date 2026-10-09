"use client";

import type { CopyContent } from "@getrefino/core";
import { RefinoProvider } from "@getrefino/react";
import type { ReactNode } from "react";
import { useCallback, useSyncExternalStore } from "react";

import { checkDeployment, clearEditorSession, editorEndpoint, readEditorSession, refinoUpdates, reportEditorEvent, signInAgainHref } from "./refino-client";

interface CopyEditingProps {
  content: CopyContent;
  children: ReactNode;
}

/** The session is set by /edit (another page) and can be ended in another tab. */
function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function hasEditorSession(): boolean {
  return readEditorSession() !== null;
}

/** On the server, and while hydrating, nobody is editing: the HTML a visitor gets never differs. */
function noSessionOnServer(): boolean {
  return false;
}

/**
 * Hosted mode (Refino). Visitors get the plain site: the server never
 * decides edit mode, so pages can stay static. In the browser, an editor
 * session stored by /edit turns edit mode on; loads and saves go to Refino
 * with the session's bearer token, and Refino checks the site's
 * entitlement on every request.
 */
export function CopyEditing({ content, children }: CopyEditingProps) {
  // Read from sessionStorage as an external store rather than copied into
  // state from an effect, so there is no extra render and nothing for
  // react-hooks/set-state-in-effect to flag.
  const editing = useSyncExternalStore(subscribe, hasEditorSession, noSessionOnServer);

  // Read at request time (the provider keeps its options from the first render), so the
  // token is always the one currently stored and never sent once the session is cleared.
  const headers = useCallback((): Record<string, string> => {
    const current = readEditorSession();
    return current ? { authorization: `Bearer ${current.token}` } : {};
  }, []);

  // Exit edit mode where the owner is: the same page, as a visitor sees it.
  const onExit = useCallback(async () => {
    clearEditorSession();
    window.location.assign(window.location.pathname + window.location.search);
  }, []);

  return (
    <RefinoProvider
      content={content}
      editing={editing}
      endpoint={editorEndpoint()}
      headers={headers}
      signInHref={editing ? signInAgainHref() : "/edit"}
      onExit={onExit}
      onEvent={reportEditorEvent}
      onUnauthorized={clearEditorSession}
      deployment={checkDeployment}
      updates={refinoUpdates}
    >
      {children}
    </RefinoProvider>
  );
}
