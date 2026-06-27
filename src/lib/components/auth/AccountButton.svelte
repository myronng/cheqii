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

  // Push login while keeping the app usable as a guest: only a PERMANENT (Google)
  // user is treated as "signed in" (shows their avatar / initial). A guest
  // (anonymous) or signed-out visitor instead sees an explicit "Sign in with
  // Google" button. The action preserves data: signed-out → signInWithOAuth (new
  // identity); anonymous → linkIdentity (same user_id, so the guest's bills carry
  // over — using signInWithOAuth there would mint a new user and orphan them).
  const isPermanent = $derived(!!session && !session.user.is_anonymous);

  const meta = $derived((session?.user.user_metadata ?? {}) as Record<string, string | undefined>);
  const avatarUrl = $derived(meta.avatar_url ?? meta.picture ?? null);
  const displayName = $derived(meta.full_name ?? meta.name ?? session?.user.email ?? "");
  const initial = $derived(displayName.trim().charAt(0).toUpperCase());

  async function signInWithGoogle() {
    const { data, error } = await supabase.auth.getSession();
    if (error) console.error("Error getting session", error);
    const redirectTo = window.location.origin;
    if (!data.session) {
      await supabase.auth.signInWithOAuth({ options: { redirectTo }, provider: "google" });
    } else if (data.session.user.is_anonymous) {
      const { error: linkError } = await supabase.auth.linkIdentity({
        options: { redirectTo },
        provider: "google",
      });
      if (linkError) console.error("Error linking Google identity", linkError);
    }
  }
</script>

{#snippet avatar()}
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

{#if isPermanent}
  <!-- Signed in for real → show who you are. -->
  <Button borderless icon={avatar} padding={1} title={displayName || strings["account"]} />
{:else}
  <!-- Guest or signed out → push login (app still usable without it). -->
  <Button onclick={signInWithGoogle} variant="secondary">{strings["signInWithGoogle"]}</Button>
{/if}

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
