"use client";

import { useSyncExternalStore } from "react";

/** A boolean that is false during SSR and hydration, and computed for real
 *  afterwards.
 *
 *  Two components need this: MobileMenu, which cannot portal into
 *  `document.body` until there is a document, and ShareRow, which cannot know
 *  whether `navigator.share` exists until it is in a browser. Both used to do
 *  the obvious thing —
 *
 *      const [ready, setReady] = useState(false);
 *      useEffect(() => setReady(true), []);
 *
 *  — which works, and which React's own lint rules now flag
 *  (react-hooks/set-state-in-effect), for a reason worth keeping: it renders
 *  the component twice on every mount, the second time only to change a
 *  boolean, and each such effect is a separate cascading render React cannot
 *  batch with anything else.
 *
 *  `useSyncExternalStore` is the built-in answer. React uses
 *  `getServerSnapshot` for the server render AND for hydration, so the markup
 *  matches and there is no mismatch to reconcile; then it checks the store once
 *  on mount and re-renders if the answer changed. Same number of paints, no
 *  state, no effect, and the intent — "this value is not knowable on the
 *  server" — is stated rather than implied.
 *
 *  `subscribe` returns a no-op unsubscribe because nothing here can change
 *  without a remount: a document does not stop existing, and the browser does
 *  not grow a share API mid-session. A flag that DOES change over time (online
 *  status, a media query) wants a real subscription instead of this hook. */

/** Module-level so its identity is stable across renders; an inline arrow here
 *  would make React tear down and re-establish the subscription every render. */
const subscribe = () => () => {};

const falseOnServer = () => false;

export function useClientFlag(compute: () => boolean): boolean {
  return useSyncExternalStore(subscribe, compute, falseOnServer);
}
