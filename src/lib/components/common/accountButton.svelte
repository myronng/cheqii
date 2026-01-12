<script lang="ts">
  import Button from "$lib/components/base/buttons/button.svelte";
  import UserCircle from "$lib/components/icons/userCircle.svelte";
  import type { LocalizedStrings } from "$lib/utils/common/locale.js";
  import type { SupabaseClient } from "@supabase/supabase-js";

  let {
    strings,
    supabase,
  }: { strings: LocalizedStrings; supabase: SupabaseClient } = $props();
</script>

{#snippet icon()}
  <UserCircle variant="fullButton" />
{/snippet}

<Button
  borderless
  {icon}
  onclick={async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error("Error getting session", error);
    }
    if (!data.session) {
      supabase.auth.signInWithOAuth({ provider: "google" });
    }
  }}
  padding={0}
  title={strings["account"]}
/>
