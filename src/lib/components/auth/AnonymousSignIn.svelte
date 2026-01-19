<script lang="ts">
  import Logo from "$lib/components/base/Logo.svelte";
  import { signInAnonymously } from "$lib/utils/common/auth.svelte";
  import { getAppContext } from "$lib/utils/common/context.svelte";
  import { DEFAULT_LOCALE, LOCALE_MASTER } from "$lib/utils/common/locale";
  import type { SupabaseClient } from "@supabase/supabase-js";
  import { onMount } from "svelte";

  let { supabase } = $props<{
    supabase: SupabaseClient;
  }>();
  const { user } = getAppContext();
  const strings = LOCALE_MASTER[DEFAULT_LOCALE];

  onMount(async () => {
    try {
      await signInAnonymously(supabase, user);
    } catch (err) {
      console.error("Anonymous sign-in failed:", err);
    }
  });
</script>

<div class="loader-overlay">
  <div class="logo-container">
    <Logo hasLink={false} hasTitle={false} {strings} />
  </div>
  <div class="loading-bar-container">
    <div class="loading-bar"></div>
  </div>
</div>

<style>
  .loader-overlay {
    align-items: center;
    backdrop-filter: blur(var(--length-surface-blur));
    display: flex;
    flex-direction: column;
    gap: calc(var(--length-spacing) * 4);
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

  .loading-bar-container {
    width: 160px;
    height: var(--length-divider);
    background: var(--color-background-surface);
    border-radius: var(--length-radius);
    overflow: hidden;
    position: relative;
  }

  .loading-bar {
    position: absolute;
    top: 0;
    left: 0;
    width: 50%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent,
      var(--color-secondary),
      transparent
    );
    animation: loading 1.5s infinite cubic-bezier(0.4, 0, 0.6, 1);
  }

  @keyframes loading {
    from {
      left: -50%;
    }
    to {
      left: 100%;
    }
  }
</style>
