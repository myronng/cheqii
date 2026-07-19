<script lang="ts">
  import Loader from "$lib/components/base/Loader.svelte";
  import Logo from "$lib/components/base/Logo.svelte";
  import { signInAnonymously } from "$lib/utils/common/auth.svelte";
  import { DEFAULT_LOCALE, LOCALE_MASTER } from "$lib/utils/common/locale";
  import type { SupabaseClient } from "@supabase/supabase-js";
  import { onMount } from "svelte";

  let { supabase }: { supabase: SupabaseClient } = $props();
  const strings = LOCALE_MASTER[DEFAULT_LOCALE];

  onMount(async () => {
    try {
      await signInAnonymously(supabase);
    } catch (err) {
      console.error("Anonymous sign-in failed:", err);
    }
  });
</script>

<!-- Sign-in handoff: logo + the shared dots Loader (one loader look everywhere). -->
<div class="loader-overlay">
  <div class="logo-container">
    <Logo hasLink={false} hasTitle={false} {strings} />
  </div>
  <Loader />
</div>

<style>
  .loader-overlay {
    align-items: center;
    backdrop-filter: blur(var(--surface-blur));
    display: flex;
    flex-direction: column;
    gap: calc(var(--space-2) * 4);
    height: 100vh;
    justify-content: center;
    left: 0;
    position: fixed;
    top: 0;
    width: 100vw;
    z-index: 9999;
  }

  .logo-container {
    width: 128px;
    height: 128px;
  }
</style>
