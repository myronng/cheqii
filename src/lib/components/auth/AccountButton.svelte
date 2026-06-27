<script lang="ts">
  import Button from "$lib/components/base/buttons/Button.svelte";
  import UserCircle from "$lib/components/icons/UserCircle.svelte";
  import type { LocalizedStrings } from "$lib/utils/common/locale.js";
  import type { SupabaseClient } from "@supabase/supabase-js";

  let {
    strings,
    supabase,
  }: { strings: LocalizedStrings; supabase: SupabaseClient } = $props();
</script>

{#snippet icon()}
  <UserCircle variant="button" />
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
      // No session yet — sign in with Google as a fresh identity.
      await supabase.auth.signInWithOAuth({ provider: "google" });
    } else if (data.session.user.is_anonymous) {
      // Anonymous → permanent: link Google to the SAME user_id so the anon
      // user's bills/memberships/mutations carry over (auth spec §3.1). Using
      // signInWithOAuth here would mint a new user and orphan that work.
      const { error: linkError } = await supabase.auth.linkIdentity({ provider: "google" });
      if (linkError) {
        console.error("Error linking Google identity", linkError);
      }
    }
  }}
  padding={0}
  title={strings["account"]}
/>
