/**
 * Browser-side Refino editor authorization for this site. No secrets here:
 * the site is a public client (OAuth 2.1 with PKCE). The editor token lives
 * in sessionStorage only (never localStorage, never a URL), is scoped to
 * this site, and Refino re-checks the account's entitlement on every load
 * and save. Never import this from server code.
 */
import { REFINO_APP_URL, REFINO_INSTALL, REFINO_SITE_ID } from "./refino-site";

const PKCE_KEY = "refino.pkce";
const SESSION_KEY = "refino.editor";
/** The owner's entry point, the OAuth callback, and the handoff screen: one route. */
export const CALLBACK_PATH = "/edit";

export interface EditorSession {
  readonly token: string;
  /** Unix seconds. */
  readonly expiresAt: number;
  readonly siteId: string;
}

interface PendingAuthorization {
  readonly verifier: string;
  readonly state: string;
  readonly returnTo: string;
}

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomToken(bytes: number): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return base64url(buffer);
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return base64url(new Uint8Array(digest));
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function readJson<T>(key: string): T | null {
  const raw = storage()?.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Only a path on this site, never another origin. */
export function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\") || value.length > 512) return "/";
  // Browsers delete tab, newline and carriage return from a URL before they
  // resolve it, so "/<tab>/example.test" arrives at the address bar as
  // "//example.test": another origin, out of something that passed every
  // test above. A control character anywhere means the value is refused,
  // never repaired.
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x20 || code === 0x7f) return "/";
  }
  return value;
}

export function editorEndpoint(): string {
  return `${REFINO_APP_URL}/api/sites/${REFINO_SITE_ID}/copy`;
}

export function callbackUrl(): string {
  return `${window.location.origin}${CALLBACK_PATH}`;
}

/** The current editor session, or null when there is none or it expired. */
export function readEditorSession(nowSeconds: number = Math.floor(Date.now() / 1000)): EditorSession | null {
  const session = readJson<EditorSession>(SESSION_KEY);
  if (!session || typeof session.token !== "string" || session.siteId !== REFINO_SITE_ID || typeof session.expiresAt !== "number") return null;
  if (session.expiresAt <= nowSeconds) {
    storage()?.removeItem(SESSION_KEY);
    return null;
  }
  return session;
}

export function clearEditorSession(): void {
  storage()?.removeItem(SESSION_KEY);
  storage()?.removeItem(PKCE_KEY);
}

/** Start the flow: remember the PKCE verifier and state, then go to Refino. */
export async function beginAuthorization(returnTo: string): Promise<void> {
  const verifier = randomToken(32);
  const state = randomToken(16);
  const pending: PendingAuthorization = { verifier, state, returnTo: safeReturnTo(returnTo) };
  storage()?.setItem(PKCE_KEY, JSON.stringify(pending));
  const params = new URLSearchParams({
    site_id: REFINO_SITE_ID,
    redirect_uri: callbackUrl(),
    code_challenge: await sha256(verifier),
    code_challenge_method: "S256",
    state,
  });
  // An absolute URL on Refino's origin, built as one so nothing mistakes it for a page of this site.
  window.location.assign(new URL(`/editor/authorize?${params.toString()}`, REFINO_APP_URL).href);
}

export type AuthorizationResult = { readonly ok: true; readonly returnTo: string } | { readonly ok: false; readonly error: string };

/**
 * Finish the flow on /edit?code&state: check the state, exchange the code
 * with the verifier this browser kept, store the session, and scrub the
 * code from the URL. The token is never placed in a URL.
 */
export async function completeAuthorization(search: string = window.location.search): Promise<AuthorizationResult> {
  const params = new URLSearchParams(search);
  const code = params.get("code");
  const state = params.get("state");
  const pending = readJson<PendingAuthorization>(PKCE_KEY);
  storage()?.removeItem(PKCE_KEY);
  if (typeof window !== "undefined" && window.history.replaceState) window.history.replaceState(null, "", window.location.pathname);
  if (!code || !state) return { ok: false, error: "Refino did not return an authorization code." };
  if (!pending || pending.state !== state) return { ok: false, error: "Sign-in was interrupted (state mismatch). Start again." };

  let response: Response;
  try {
    response = await fetch(`${REFINO_APP_URL}/api/editor/token`, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        code_verifier: pending.verifier,
        site_id: REFINO_SITE_ID,
        redirect_uri: callbackUrl(),
        // The public install facts from refino-site.ts, sent once per
        // sign-in. Refino records them the first time and ignores them
        // afterwards. Remove this line and everything still works.
        install: REFINO_INSTALL,
      }),
    });
  } catch {
    return { ok: false, error: "Could not reach Refino to finish signing in." };
  }
  const body = (await response.json().catch(() => null)) as { ok?: boolean; token?: string; expiresAt?: number; siteId?: string; error?: { message?: string } } | null;
  if (!response.ok || !body?.ok || typeof body.token !== "string" || typeof body.expiresAt !== "number" || body.siteId !== REFINO_SITE_ID) {
    return { ok: false, error: body?.error?.message ?? "Refino did not accept the authorization." };
  }
  const session: EditorSession = { token: body.token, expiresAt: body.expiresAt, siteId: body.siteId };
  storage()?.setItem(SESSION_KEY, JSON.stringify(session));
  return { ok: true, returnTo: pending.returnTo };
}

/**
 * The three states /edit can be in. The page draws them; this module
 * decides which one it is, so restyling the page can never change where a
 * successful sign-in lands.
 */
export type EditorPhase =
  /** Leaving for Refino, or coming back from it: the browser is navigating. */
  | { readonly kind: "authorizing" }
  /** The handoff: this browser holds an editor session for this site. */
  | { readonly kind: "ready"; readonly openHref: string }
  | { readonly kind: "error"; readonly message: string };

/** Where "Open the site" goes: the page the owner asked for, or the site's home. Never /edit, never another origin. */
function openSiteHref(params: URLSearchParams): string {
  const requested = safeReturnTo(params.get("return_to"));
  return requested === CALLBACK_PATH || requested.startsWith(CALLBACK_PATH + "?") ? "/" : requested;
}

let inFlight: { readonly search: string; readonly phase: Promise<EditorPhase> } | null = null;

/**
 * The one decision /edit makes, in one place and in one order:
 *
 *   ?code&state       finish the authorization Refino sent back
 *   editor session    already authorized: the handoff
 *   ?error            Refino refused; say so and offer another go
 *   otherwise         start the authorization
 *
 * A successful sign-in lands here, on the handoff, and /edit is safe to
 * revisit: it shows the same screen rather than starting anything. The one
 * exception is deliberate and comes from the URL the owner arrived on --
 * /edit?return_to=/pricing sends them back to /pricing when they are
 * through, which is how the editor asks for a fresh session mid-edit.
 * Nothing else decides the destination.
 */
export function resolveEditorPhase(search: string = window.location.search): Promise<EditorPhase> {
  // One resolution per URL. React runs an effect twice in development and the
  // authorization code is single-use, so a second call would consume nothing
  // and report a failed sign-in that did not happen.
  if (!inFlight || inFlight.search !== search) inFlight = { search, phase: resolvePhase(search) };
  return inFlight.phase;
}

async function resolvePhase(search: string): Promise<EditorPhase> {
  const params = new URLSearchParams(search);
  if (params.has("code") || params.has("state")) {
    const result = await completeAuthorization(search);
    if (!result.ok) return { kind: "error", message: result.error };
    if (result.returnTo !== CALLBACK_PATH) {
      window.location.assign(result.returnTo);
      return { kind: "authorizing" };
    }
    return { kind: "ready", openHref: openSiteHref(params) };
  }
  if (readEditorSession()) return { kind: "ready", openHref: openSiteHref(params) };
  // Refino never sends a failure back to the site -- a refused authorization
  // stays on the Refino dashboard, where it can say what to do about it -- so
  // ?error here is somebody else's text and is not repeated back to the owner.
  if (params.get("error")) return { kind: "error", message: "Refino did not authorize this browser to edit the site." };
  await beginAuthorization(params.get("return_to") ?? CALLBACK_PATH);
  return { kind: "authorizing" };
}

/**
 * End the session, in the only order that leaves no live credential behind:
 * this site's editor token lives in this browser and is cleared here, and
 * the Refino account session lives in a cookie on Refino's own origin and
 * can only be ended there -- so the browser is handed to Refino, which
 * confirms and signs the owner out. Signing out of Refino is not signing
 * out of GitHub, and it changes nothing about this site.
 */
export function signOut(): void {
  clearEditorSession();
  window.location.assign(new URL("/signout", REFINO_APP_URL).href);
}

/**
 * The three editor events this site reports, and the only ones it ever
 * sends. There is no analytics SDK on this site: no autocapture, no session
 * recording, no third-party script, no cookie. Each event is one small POST
 * to Refino carrying an event name and, for a revert, whether it was one
 * word or all of them — never your page, your copy, your visitors or your
 * repository. `edit_saved` is not in this list on purpose: a save is a
 * commit, and Refino records that on its own side where it cannot be faked
 * or lost.
 */
const REPORTABLE_EVENTS = ["editor_opened", "edit_started", "edit_reverted"] as const;

type ReportableEvent = (typeof REPORTABLE_EVENTS)[number];

interface EditorEventLike {
  readonly name: string;
  readonly properties: Readonly<Record<string, unknown>>;
}

/**
 * Fire and forget. A failure here is invisible and harmless: nothing in the
 * editor waits for it, retries it, or behaves differently when it fails.
 */
export function reportEditorEvent(event: EditorEventLike): void {
  const session = readEditorSession();
  if (!session) return;
  if (!(REPORTABLE_EVENTS as readonly string[]).includes(event.name)) return;
  const name = event.name as ReportableEvent;
  const scope = event.properties.scope;
  const surface = event.properties.edit_surface;
  const payload: Record<string, string> = { event: name };
  if (scope === "one" || scope === "all") payload.scope = scope;
  // Which surface an edit started on: inline copy, an article's metadata, or
  // an article's body. An enum of three, never an id and never a word of the
  // text. Refino refuses anything it does not recognize.
  if (typeof surface === "string") payload.surface = surface;
  try {
    void fetch(`${REFINO_APP_URL}/api/editor/events`, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      keepalive: true,
      headers: { "content-type": "application/json", authorization: `Bearer ${session.token}` },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch {
    // Never let reporting affect editing.
  }
}

/**
 * Updates to this site's Refino integration, offered in the editor
 * toolbar. Asking is read-only. Nothing changes unless the owner presses
 * "Update Refino": Refino then commits the new Refino version to this
 * repository, and the site's normal deployment takes it from there. The
 * editor checks every answer itself, so this stays a plain pipe.
 */
export const refinoUpdates = {
  check: (): Promise<unknown> => updateRequest("GET"),
  apply: (version: string): Promise<unknown> => updateRequest("POST", JSON.stringify({ version })),
};

/**
 * What GitHub knows about a saved commit reaching this site's host: a
 * deployment or commit status the host reported for it. Read-only. The
 * editor says "live" only when this answers "success" for that commit.
 */
export async function checkDeployment(commitSha: string): Promise<{ readonly state: "success" | "failure" | "pending" | "none" | "unknown"; readonly url?: string | null }> {
  const session = readEditorSession();
  if (!session) return { state: "unknown" };
  try {
    const response = await fetch(`${REFINO_APP_URL}/api/sites/${REFINO_SITE_ID}/deployment?sha=${encodeURIComponent(commitSha)}`, {
      mode: "cors",
      credentials: "omit",
      headers: { accept: "application/json", authorization: `Bearer ${session.token}` },
    });
    const body = (await response.json()) as { deployment?: { state?: string; url?: string | null } } | null;
    const state = body?.deployment?.state;
    return state === "success" || state === "failure" || state === "pending" || state === "none" ? { state, url: body?.deployment?.url ?? null } : { state: "unknown" };
  } catch {
    return { state: "unknown" };
  }
}

/** /edit, coming back to the page the owner is on once they are signed in again. */
export function signInAgainHref(): string {
  if (typeof window === "undefined") return CALLBACK_PATH;
  return `${CALLBACK_PATH}?return_to=${encodeURIComponent(safeReturnTo(window.location.pathname + window.location.search))}`;
}

async function updateRequest(method: "GET" | "POST", body?: string): Promise<unknown> {
  const session = readEditorSession();
  if (!session) return null;
  const headers: Record<string, string> = { accept: "application/json", authorization: `Bearer ${session.token}` };
  if (body) headers["content-type"] = "application/json";
  try {
    const response = await fetch(`${REFINO_APP_URL}/api/sites/${REFINO_SITE_ID}/update`, { method, mode: "cors", credentials: "omit", headers, body });
    return await response.json();
  } catch {
    // Unreachable or unreadable: the editor treats it as "nothing to offer", or as an unknown outcome.
    return null;
  }
}
