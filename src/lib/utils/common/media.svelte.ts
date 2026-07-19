/**
 * Reactive `matchMedia` for runes. Call from a component's init (top-level script)
 * so the listener is bound to that component's lifecycle and cleaned up on destroy.
 * SSR-safe: the effect never runs on the server, so `current` stays false there
 * (the cheque editor is ssr=false anyway).
 *
 *   const isMobile = mediaQuery("(max-width: 768px)");
 *   {#if isMobile.current} … {/if}
 */
export function mediaQuery(query: string): { readonly current: boolean } {
  // Seed synchronously so the first client paint already matches (no grid→cards
  // flash); the effect then keeps it live. `window` is absent only during SSR.
  let matches = $state(typeof window !== "undefined" ? window.matchMedia(query).matches : false);

  $effect(() => {
    const mql = window.matchMedia(query);
    matches = mql.matches;
    const onChange = (e: MediaQueryListEvent) => (matches = e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  });

  return {
    get current() {
      return matches;
    },
  };
}

/** The app's single editor breakpoint (cards below, grid at/above). */
export const MOBILE_QUERY = "(max-width: 768px)";
