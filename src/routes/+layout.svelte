<script lang="ts">
  // Minimal root layout shared by the marketing landing (/) and the app (app)/.
  // Loads the global design tokens + fonts (app.css) and renders the route. The
  // app's boot (IndexedDB/Supabase/sync), Turnstile, and PwaPrompts live in
  // (app)/+layout.svelte so the landing stays prerenderable and boot-free.
  import "../app.css";

  let { children } = $props();
</script>

{@render children()}
