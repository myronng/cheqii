<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import Button from "$lib/components/base/buttons/Button.svelte";
  import Loader from "$lib/components/base/Loader.svelte";
  import { signInWithGoogle } from "$lib/utils/common/auth.svelte";
  import { DEFAULT_LOCALE, LOCALE_MASTER } from "$lib/utils/common/locale";
  import { onMount } from "svelte";

  // Invite redemption with the token in the URL **fragment** (auth-invite spec §3.3).
  // The fragment is never sent to the server or leaked in the Referer header, so the
  // capability token stays out of server/proxy logs. The join therefore happens
  // client-side. Across the /auth sign-in hop the fragment is dropped, so the token
  // is stashed in sessionStorage and read back on return.
  const strings = LOCALE_MASTER[DEFAULT_LOCALE];
  const chequeId = $derived(page.params.chequeId);
  let status = $state<"joining" | "error" | "limit">("joining");

  const PENDING_KEY = "pendingInvite";

  onMount(async () => {
    const supabase = page.data.supabase;
    let token = location.hash.replace(/^#/, "");
    // Returning from /auth: the fragment is gone → recover the stashed token.
    if (!token) {
      try {
        const stash = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? "null");
        if (stash?.chequeId === chequeId) token = stash.token;
      } catch {
        /* malformed stash — treated as no token */
      }
    } else {
      // Drop the token from the visible URL/history once we've read it.
      history.replaceState(null, "", location.pathname);
    }

    if (!token || !chequeId) {
      status = "error";
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      // Not signed in: remember the invite, sign in anonymously, return here.
      sessionStorage.setItem(PENDING_KEY, JSON.stringify({ chequeId, token }));
      document.cookie = `authRedirect=/invite/${chequeId}; path=/; max-age=300`;
      await goto("/auth");
      return;
    }

    const { error } = await supabase.rpc("join_cheque_via_invite", {
      p_cheque_id: chequeId,
      p_invite_id: token,
      p_user_id: session.user.id,
    });
    sessionStorage.removeItem(PENDING_KEY);
    if (error) {
      console.error("[invite] join failed:", error.message);
      // Guest cap: a friendlier prompt to sign in rather than a generic failure.
      status = error.message.includes("guest cheque limit") ? "limit" : "error";
      return;
    }
    await goto(`/cheques/${chequeId}`, { replaceState: true });
  });

  const supabase = $derived(page.data.supabase);
</script>

<div class="invite">
  {#if status === "joining"}
    <Loader />
    <p>{strings["joiningCheque"]}</p>
  {:else if status === "limit"}
    <h1 class="title">{strings["guestChequeLimitTitle"]}</h1>
    <p>{strings["guestChequeLimitBody"]}</p>
    <div class="actions">
      <Button variant="primary" onclick={() => signInWithGoogle(supabase)}>
        {strings["continueWithGoogle"]}
      </Button>
      <Button borderless onclick={() => goto("/cheques")}>
        {strings["backToYourCheques"]}
      </Button>
    </div>
  {:else}
    <p>{strings["invalidInvitationLink"]}</p>
  {/if}
</div>

<style>
  .invite {
    align-items: center;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    justify-content: center;
    min-block-size: 100dvh;
    padding: calc(var(--space-2) * 2);
    text-align: center;
  }
  .title {
    font-size: var(--text-xl);
    font-weight: 700;
    margin: 0;
  }
  .actions {
    align-items: center;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-block-start: var(--space-3);
  }
</style>
