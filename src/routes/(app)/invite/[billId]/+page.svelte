<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import Loader from "$lib/components/base/Loader.svelte";
  import { DEFAULT_LOCALE, LOCALE_MASTER } from "$lib/utils/common/locale";
  import { onMount } from "svelte";

  // Invite redemption with the token in the URL **fragment** (auth-invite spec §3.3).
  // The fragment is never sent to the server or leaked in the Referer header, so the
  // capability token stays out of server/proxy logs. The join therefore happens
  // client-side. Across the /auth sign-in hop the fragment is dropped, so the token
  // is stashed in sessionStorage and read back on return.
  const strings = LOCALE_MASTER[DEFAULT_LOCALE];
  const billId = $derived(page.params.billId);
  let status = $state<"joining" | "error">("joining");

  const PENDING_KEY = "pendingInvite";

  onMount(async () => {
    const supabase = page.data.supabase;
    let token = location.hash.replace(/^#/, "");
    // Returning from /auth: the fragment is gone → recover the stashed token.
    if (!token) {
      try {
        const stash = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? "null");
        if (stash?.billId === billId) token = stash.token;
      } catch {
        /* malformed stash — treated as no token */
      }
    } else {
      // Drop the token from the visible URL/history once we've read it.
      history.replaceState(null, "", location.pathname);
    }

    if (!token || !billId) {
      status = "error";
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      // Not signed in: remember the invite, sign in anonymously, return here.
      sessionStorage.setItem(PENDING_KEY, JSON.stringify({ billId, token }));
      document.cookie = `authRedirect=/invite/${billId}; path=/; max-age=300`;
      await goto("/auth");
      return;
    }

    const { error } = await supabase.rpc("join_bill_via_invite", {
      p_bill_id: billId,
      p_invite_id: token,
      p_user_id: session.user.id,
    });
    sessionStorage.removeItem(PENDING_KEY);
    if (error) {
      console.error("[invite] join failed:", error.message);
      status = "error";
      return;
    }
    await goto(`/bills/${billId}`, { replaceState: true });
  });
</script>

<div class="invite">
  {#if status === "joining"}
    <Loader />
    <p>{strings["joiningBill"]}</p>
  {:else}
    <p>{strings["invalidInvitationLink"]}</p>
  {/if}
</div>

<style>
  .invite {
    align-items: center;
    display: flex;
    flex-direction: column;
    gap: var(--length-spacing);
    justify-content: center;
    min-block-size: 100dvh;
    padding: calc(var(--length-spacing) * 2);
    text-align: center;
  }
</style>
