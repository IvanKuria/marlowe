<script lang="ts">
  import type { MarloweState } from '../state';
  import {
    BackupError,
    backupFilename,
    describe,
    exportBackup,
    parseBackup,
    restoreBackup,
  } from '~/lib/backup';

  interface Props {
    /**
     * Deliberately not named `state`: a prop by that name makes Svelte parse
     * `$state(...)` in this file as a store subscription on the prop.
     */
    existing: MarloweState;
    live: boolean;
  }

  let { existing, live }: Props = $props();

  let note = $state('');
  let pending = $state<MarloweState | null>(null);
  let input: HTMLInputElement;

  async function save() {
    const backup = await exportBackup();
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = backupFilename(backup.exportedAt);
    a.click();
    // Revoking immediately can cancel the download in some builds; one turn of
    // the event loop is enough for the click to have been handed off.
    setTimeout(() => URL.revokeObjectURL(url), 0);
    note = `Saved as ${a.download}.`;
  }

  async function chosen(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      pending = parseBackup(await file.text());
      note = '';
    } catch (err) {
      pending = null;
      note = err instanceof BackupError ? err.message : 'That file could not be read.';
    }
    // Clear the input so choosing the same file twice still fires a change.
    input.value = '';
  }

  async function confirm() {
    if (!pending) return;
    await restoreBackup(pending);
    note = 'Restored. Everything above is from the backup now.';
    pending = null;
  }
</script>

<div class="keeping">
  <p class="line">
    Everything Marlowe knows lives on this computer only. It survives updates
    and clearing your browsing data, but not uninstalling, a new Chrome profile,
    or a new machine. Nothing syncs. Keep a copy.
  </p>

  <div class="acts">
    <button class="act" onclick={save}>Save a copy</button>
    <button class="act quiet" onclick={() => input.click()} disabled={!live}>
      Restore from a copy
    </button>
    <input
      class="sr-only"
      type="file"
      accept="application/json,.json"
      bind:this={input}
      onchange={chosen}
    />
  </div>

  {#if pending}
    <div class="confirm">
      <p>
        That backup holds <b>{describe(pending)}</b>. Restoring replaces what is
        here now — <b>{describe(existing)}</b> — and cannot be undone.
      </p>
      <div class="acts">
        <button class="act danger" onclick={confirm}>Replace everything</button>
        <button class="act quiet" onclick={() => (pending = null)}>Keep what I have</button>
      </div>
    </div>
  {:else if note}
    <p class="note">{note}</p>
  {/if}
</div>

<style>
  .keeping {
    max-width: 560px;
  }

  .line {
    margin: 0 0 16px;
    font-size: 14.5px;
    color: var(--text2);
  }

  .acts {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .act {
    font: inherit;
    font-family: var(--serif);
    font-size: 14px;
    padding: 8px 14px;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    color: #2a1f16;
    background: linear-gradient(180deg, var(--lamp), var(--lampdeep));
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
    transition: filter 140ms ease;
  }

  .act:hover:not(:disabled) {
    filter: brightness(1.07);
  }

  .act:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .act.quiet {
    background: rgba(233, 218, 187, 0.1);
    color: var(--text);
    box-shadow: none;
  }

  /* The only destructive control in the product, so it wears the editor's red. */
  .act.danger {
    background: var(--brick);
    color: #fff4ec;
  }

  .confirm {
    margin-top: 16px;
    padding: 14px 16px;
    border-radius: 2px;
    background: rgba(169, 96, 79, 0.12);
    box-shadow: 0 0 0 1px rgba(169, 96, 79, 0.35) inset;
  }

  .confirm p {
    margin: 0 0 12px;
    font-size: 14px;
    color: var(--text);
  }

  .confirm b {
    color: #f6e9d2;
    font-weight: 400;
  }

  .note {
    margin: 14px 0 0;
    font-size: 13.5px;
    color: var(--text2);
  }

  @media (prefers-reduced-motion: reduce) {
    .act {
      transition: none;
    }
  }
</style>
