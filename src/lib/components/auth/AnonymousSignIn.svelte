<script lang="ts">
  import Loader from "$lib/components/base/Loader.svelte";
  import { signInAnonymously } from "$lib/utils/common/auth.svelte";
  import type { SupabaseClient } from "@supabase/supabase-js";
  import { onMount } from "svelte";

  let { supabase }: { supabase: SupabaseClient } = $props();

  onMount(async () => {
    try {
      await signInAnonymously(supabase);
    } catch (err) {
      console.error("Anonymous sign-in failed:", err);
    }
  });
</script>

<!-- Sign-in handoff: just the shared dots Loader (one full-screen loader look). -->
<div class="loader-overlay">
  <Loader />
</div>

<style>
  .loader-overlay {
    align-items: center;
    backdrop-filter: blur(var(--surface-blur));
    display: flex;
    flex-direction: column;
    height: 100vh;
    justify-content: center;
    left: 0;
    position: fixed;
    top: 0;
    width: 100vw;
    z-index: 9999;
  }
</style>
