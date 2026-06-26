/// <reference types="cloudflare-turnstile" />
/// <reference types="google-one-tap" />
/// <reference types="unplugin-icons/types/svelte" />
import type { Database } from "$lib/utils/models/database";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";

// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      safeGetSession: () => Promise<{
        session: null | Session;
        user: null | User;
      }>;
      session: null | Session;
      supabase: SupabaseClient<Database>;
      user: null | User;
    }
    interface PageData {
      session: null | Session;
    }
    // interface PageState {}
    interface Platform {
      // Cloudflare bindings (present only on the deployed Worker). The
      // SYNC_RATE_LIMITER is the `ratelimit` binding from wrangler.jsonc.
      env?: {
        SYNC_RATE_LIMITER?: { limit: (opts: { key: string }) => Promise<{ success: boolean }> };
      };
    }
  }

  interface Window {
    turnstile: Turnstile.Turnstile;
    google: typeof google;
  }
}

export {};
