<!--
  Post-join "who are you?" prompt. Shown (once per session) when the signed-in
  user is a member of a cheque but isn't linked to any person and hasn't opted out.
  Three resolutions: link to an existing slot, add themselves as a new person, or
  opt out ("not listed") — the last sets cheque_users.claim_dismissed so we don't
  ask again (synced across their devices).
-->
<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import Avatar from "$lib/components/base/Avatar.svelte";
  import Button from "$lib/components/base/buttons/Button.svelte";
  import Dialog from "$lib/components/base/Dialog.svelte";
  import { addPerson, claimPerson, updateChequeUser, updatePerson } from "$lib/state/actions";
  import { getAppContext } from "$lib/state/app.svelte";
  import type { ChequeData } from "$lib/state/model";
  import { uuidv7 } from "$lib/sync/uuid";
  import { type LocalizedStrings, interpolateString } from "$lib/utils/common/locale";
  import { avatarColor } from "$lib/utils/common/palette";

  let {
    chequeData,
    displayName,
    strings,
    userId,
  }: {
    chequeData: ChequeData;
    displayName: string;
    strings: LocalizedStrings;
    userId: string;
  } = $props();

  const app = getAppContext();

  // Real, unclaimed slots (someone could be "you"); paired with their palette index
  // so the avatar colour matches the rest of the app. Exclude slots already tied to
  // a member — either explicitly (linked_user_id) or implicitly (the creator's slot,
  // whose id is their user id).
  const memberIds = $derived(new Set(chequeData.cheque_users.map((u) => u.user_id)));
  // The creator's slot id is their user id (identity-bound): they're already
  // represented and can't reassign themselves, so claiming is a no-op for them.
  const hasIdSlot = $derived(chequeData.cheque_people.some((p) => p.id === userId));
  const choices = $derived(
    chequeData.cheque_people
      .map((p, index) => ({ person: p, index }))
      .filter(
        ({ person }) => !person.is_stub && !person.linked_user_id && !memberIds.has(person.id),
      ),
  );

  const close = () =>
    goto(`${page.url.pathname}${page.url.search}`, { noScroll: true, replaceState: true });

  async function claim(personId: string) {
    if (hasIdSlot) return close(); // creator is already represented
    await claimPerson(app, chequeData.id, {
      people: chequeData.cheque_people,
      personId,
      userId,
    });
    close();
  }

  async function addMe() {
    if (hasIdSlot) return close(); // creator is already represented
    // Releasing any slot they already hold keeps the one-person-per-user rule when
    // the dialog is used to switch (clear precedes the new linked slot in hlc order).
    const current = chequeData.cheque_people.find((p) => p.linked_user_id === userId);
    if (current) await updatePerson(app, chequeData.id, { id: current.id, linked_user_id: null });
    const id = uuidv7();
    const splits = chequeData.cheque_items.map((item) => ({
      id: uuidv7(),
      item_id: item.id,
      person_id: id,
      ratio: 0,
    }));
    await addPerson(app, chequeData.id, {
      person: {
        id,
        linked_user_id: userId,
        name:
          displayName ||
          interpolateString(strings["person{index}"], {
            index: String(chequeData.cheque_people.length + 1),
          }),
        sort: chequeData.cheque_people.length,
      },
      splits,
    });
    close();
  }

  async function notListed() {
    // Release any slot they currently hold (the dialog doubles as a switcher), then
    // opt out so we don't ask again.
    const current = chequeData.cheque_people.find((p) => p.linked_user_id === userId);
    if (current) await updatePerson(app, chequeData.id, { id: current.id, linked_user_id: null });
    await updateChequeUser(app, chequeData.id, { claim_dismissed: true, userId });
    close();
  }
</script>

<Dialog hash="claim" {strings} title={strings["whichPersonAreYou"]}>
  <div class="claim">
    <p class="hint">{strings["claimHint"]}</p>

    {#if choices.length > 0}
      <ul class="people">
        {#each choices as { person, index }}
          <li>
            <button class="person" onclick={() => claim(person.id)} type="button">
              <Avatar name={person.name ?? ""} color={avatarColor(index)} size="2rem" />
              <span class="name">{person.name || strings["anonymous"]}</span>
              <span class="pick">{strings["thatsMe"]}</span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}

    <div class="actions">
      <Button variant="primary" onclick={addMe}>{strings["addMeAsNewPerson"]}</Button>
      <Button borderless onclick={notListed}>{strings["imNotListedSeparately"]}</Button>
    </div>
  </div>
</Dialog>

<style>
  .claim {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    inline-size: min(26rem, 90vw);
    max-inline-size: 100%;
    padding: var(--space-4);
  }
  .hint {
    color: var(--color-text-muted);
    line-height: 1.5;
    margin: 0;
  }

  .people {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .person {
    align-items: center;
    background: var(--color-background-raised);
    border: var(--border-divider) solid var(--color-border);
    border-radius: var(--radius-card);
    color: var(--color-text);
    cursor: pointer;
    display: flex;
    font: inherit;
    gap: var(--space-3);
    inline-size: 100%;
    padding: var(--space-2) var(--space-3);

    @media (prefers-reduced-motion: no-preference) {
      transition: border-color var(--dur-fast) var(--ease-standard);
    }
  }
  .person:hover {
    border-color: var(--color-action);
  }
  .name {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pick {
    color: var(--color-action);
    font-size: var(--text-sm);
    font-weight: 700;
    margin-inline-start: auto;
    white-space: nowrap;
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
</style>
