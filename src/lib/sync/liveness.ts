/**
 * Liveness sources that drive the pull side of the engine, so a passive viewer
 * sees peers' edits without making one first (sync spec §4):
 *   - Realtime: Supabase postgres_changes on `mutation_logs` (RLS-scoped) → pull.
 *   - Visibility/online: tab becomes visible, or the device reconnects → pull.
 *   - Heartbeat: while visible, a periodic pull as a safety net for missed events.
 * `attachLiveness` is browser-only and returns a cleanup function.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SyncEngine } from "./engine.svelte";

const HEARTBEAT_MS = 30_000;

export interface LivenessTarget {
  pull(): void;
  setOnline(online: boolean): void;
}

export function attachLiveness(
  engine: LivenessTarget | SyncEngine,
  supabase: SupabaseClient,
): () => void {
  if (typeof window === "undefined") return () => {};

  // Realtime: any insert into mutation_logs we're allowed to see → pull.
  const channel = supabase
    .channel("sync:mutation_logs")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "mutation_logs" }, () =>
      engine.pull(),
    )
    .subscribe();

  const onVisible = () => {
    if (document.visibilityState === "visible") engine.pull();
  };
  const onOnline = () => engine.setOnline(true);
  const onOffline = () => engine.setOnline(false);

  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);

  const heartbeat = setInterval(() => {
    if (document.visibilityState === "visible") engine.pull();
  }, HEARTBEAT_MS);

  return () => {
    void supabase.removeChannel(channel);
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
    clearInterval(heartbeat);
  };
}
