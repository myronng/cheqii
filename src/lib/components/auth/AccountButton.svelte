<script lang="ts">
  import Button from "$lib/components/base/buttons/Button.svelte";
  import UserCircle from "$lib/components/icons/UserCircle.svelte";
  import type { LocalizedStrings } from "$lib/utils/common/locale.js";
  import type { Session, SupabaseClient } from "@supabase/supabase-js";

  let {
    session,
    strings,
    supabase,
  }: { session: null | Session; strings: LocalizedStrings; supabase: SupabaseClient } = $props();

  // Make sign-in state visible: a permanent (Google) user shows their avatar, or
  // the first letter of their name when there's no picture; an anonymous guest
  // (no name/avatar) keeps the generic person icon.
  const meta = $derived(
    (session?.user.user_metadata ?? {}) as Record<string, string | undefined>,
  );
  const avatarUrl = $derived(meta.avatar_url ?? meta.picture ?? null);
  const displayName = $derived(meta.full_name ?? meta.name ?? session?.user.email ?? "");
  const initial = $derived(displayName.trim().charAt(0).toUpperCase());
</script>

{#snippet icon()}
  {#if avatarUrl}
    <img
      class="avatar"
      src={avatarUrl}
      alt={displayName || strings["account"]}
      referrerpolicy="no-referrer"
    />
  {:else if initial}
    <span class="avatar initial" aria-hidden="true">{initial}</span>
  {:else}
    <UserCircle variant="button" />
  {/if}
{/snippet}

<Button
  borderless
  {icon}
  onclick={async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error("Error getting session", error);
    }
    const redirectTo = window.location.origin;
    if (!data.session) {
      // No session yet — sign in with Google as a fresh identity.
      await supabase.auth.signInWithOAuth({ options: { redirectTo }, provider: "google" });
    } else if (data.session.user.is_anonymous) {
      // Anonymous → permanent: link Google to the SAME user_id so the anon
      // user's bills/memberships/mutations carry over (auth spec §3.1). Using
      // signInWithOAuth here would mint a new user and orphan that work.
      const { error: linkError } = await supabase.auth.linkIdentity({
        options: { redirectTo },
        provider: "google",
      });
      if (linkError) {
        console.error("Error linking Google identity", linkError);
      }
    }
  }}
  padding={1}
  title={displayName || strings["account"]}
/>

<style>
  .avatar {
    block-size: 2rem;
    border-radius: 50%;
    inline-size: 2rem;
    object-fit: cover;
  }

  .initial {
    align-items: center;
    background-color: var(--color-action);
    color: var(--white);
    display: inline-flex;
    font-weight: 700;
    justify-content: center;
    line-height: 1;
  }
</style>
