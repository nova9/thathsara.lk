<script lang="ts">
  import {
    type SplitState,
    type Member,
    type Expense,
    emptyState,
    makeId,
    computeBalances,
    settle,
    toCents,
    formatMoney,
    encodeState,
    decodeState,
  } from "@/lib/settle";
  import { onMount } from "svelte";

  const STORAGE_KEY = "split-expenses-v1";

  // Decoding a shared link is async (it inflates a compressed payload), so we
  // can't read the hash during synchronous setup. Capture it now, before the
  // persistence effect rewrites the URL, and hydrate from it in onMount.
  const initialHash =
    typeof location !== "undefined" ? location.hash.slice(1) : "";

  function loadLocal(): SplitState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          parsed &&
          Array.isArray(parsed.members) &&
          Array.isArray(parsed.expenses)
        ) {
          return {
            members: parsed.members,
            expenses: parsed.expenses,
            currency:
              typeof parsed.currency === "string" ? parsed.currency : "$",
          };
        }
      }
    } catch {
      /* ignore */
    }
    return emptyState();
  }

  const initial = loadLocal();

  // ── Core reactive state ──────────────────────────────────────────────────
  let members = $state<Member[]>(initial.members);
  let expenses = $state<Expense[]>(initial.expenses);
  let currency = $state(initial.currency);

  // ── Form state ───────────────────────────────────────────────────────────
  let newName = $state("");
  let desc = $state("");
  let amount = $state("");
  let payerId = $state(initial.members[0]?.id ?? "");
  let selected = $state<Record<string, boolean>>(
    Object.fromEntries(initial.members.map((m) => [m.id, true])),
  );

  // Gate URL persistence until we've read the shared hash, so the effect below
  // doesn't overwrite the incoming link before it's decoded.
  let hydrated = $state(false);

  onMount(async () => {
    if (initialHash) {
      const fromUrl = await decodeState(initialHash);
      if (fromUrl) {
        members = fromUrl.members;
        expenses = fromUrl.expenses;
        currency = fromUrl.currency;
        payerId = fromUrl.members[0]?.id ?? "";
        selected = Object.fromEntries(fromUrl.members.map((m) => [m.id, true]));
      }
    }
    hydrated = true;
  });

  let toast = $state("");
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  function showToast(msg: string) {
    toast = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast = ""), 2200);
  }

  // ── Derived results ──────────────────────────────────────────────────────
  const ready = $derived(members.length >= 2);
  const balances = $derived(computeBalances({ members, expenses, currency }));
  const transactions = $derived(settle(balances));
  const total = $derived(expenses.reduce((s, e) => s + e.amountCents, 0));
  const showResults = $derived(ready && expenses.length > 0);

  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? "?";

  // ── Persist to localStorage + keep the URL shareable ─────────────────────
  $effect(() => {
    const state: SplitState = { members, expenses, currency };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
    if (!hydrated) return;
    let cancelled = false;
    encodeState(state).then((enc) => {
      if (!cancelled) {
        history.replaceState(null, "", `${location.pathname}#${enc}`);
      }
    });
    return () => {
      cancelled = true;
    };
  });

  // ── Actions ──────────────────────────────────────────────────────────────
  function addMember() {
    const name = newName.trim();
    if (!name) return;
    const id = makeId();
    members.push({ id, name });
    selected[id] = true;
    if (!payerId) payerId = id;
    newName = "";
  }

  function removeMember(id: string) {
    members = members.filter((m) => m.id !== id);
    expenses = expenses
      .filter((e) => e.payerId !== id)
      .map((e) => ({
        ...e,
        participantIds: e.participantIds.filter((p) => p !== id),
      }))
      .filter((e) => e.participantIds.length > 0);
    delete selected[id];
    if (payerId === id) payerId = members[0]?.id ?? "";
  }

  function addExpense() {
    const amountCents = toCents(amount);
    const participantIds = members
      .filter((m) => selected[m.id])
      .map((m) => m.id);

    if (amountCents <= 0) {
      showToast("Enter an amount greater than zero.");
      return;
    }
    if (participantIds.length === 0) {
      showToast("Pick at least one person to split between.");
      return;
    }
    if (!payerId) {
      showToast("Choose who paid.");
      return;
    }

    expenses.push({
      id: makeId(),
      desc: desc.trim(),
      payerId,
      amountCents,
      participantIds,
    });
    desc = "";
    amount = "";
  }

  function removeExpense(id: string) {
    expenses = expenses.filter((e) => e.id !== id);
  }

  function setAll(value: boolean) {
    for (const m of members) selected[m.id] = value;
  }

  async function share() {
    const enc = await encodeState({ members, expenses, currency });
    const url = `${location.origin}${location.pathname}#${enc}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast("Share link copied to clipboard ✓");
    } catch {
      history.replaceState(null, "", url);
      showToast("Link is in the address bar — copy it.");
    }
  }

  function reset() {
    if (!confirm("Clear all people and expenses?")) return;
    members = [];
    expenses = [];
    currency = "$";
    selected = {};
    payerId = "";
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    history.replaceState(null, "", location.pathname);
  }
</script>

<section class="split">
  <header class="hero">
    <div class="hero__icon" aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <circle cx="12" cy="12" r="2.5" />
        <path d="M6 10v4M18 10v4" />
      </svg>
    </div>
    <h1 class="hero__title">Split Expenses</h1>
    <p class="hero__sub">
      Add your group, log who paid for what, and get the fewest payments to
      settle up.
    </p>
  </header>

  <!-- 1. People -->
  <section class="card">
    <div class="card__head">
      <span class="step">1</span>
      <h2 class="card__title">Who's in?</h2>
    </div>
    <form class="inline" onsubmit={(e) => (e.preventDefault(), addMember())}>
      <input
        class="input"
        type="text"
        placeholder="Add a name…"
        autocomplete="off"
        maxlength="40"
        bind:value={newName}
      />
      <button class="btn btn--primary" type="submit">Add</button>
    </form>

    {#if members.length}
      <ul class="people">
        {#each members as m (m.id)}
          <li class="person">
            <span>{m.name}</span>
            <button
              type="button"
              aria-label={`Remove ${m.name}`}
              onclick={() => removeMember(m.id)}>×</button
            >
          </li>
        {/each}
      </ul>
    {/if}
    {#if !ready}
      <p class="hint">Add at least two people to get going.</p>
    {/if}
  </section>

  <!-- 2. Expenses -->
  {#if ready}
    <section class="card">
      <div class="card__head">
        <span class="step">2</span>
        <h2 class="card__title">What was spent?</h2>
      </div>
      <form class="stack" onsubmit={(e) => (e.preventDefault(), addExpense())}>
        <div class="inline">
          <input
            class="input"
            type="text"
            placeholder="What for? (e.g. Dinner)"
            autocomplete="off"
            maxlength="60"
            bind:value={desc}
          />
          <div class="money">
            <span class="money__sym">{currency}</span>
            <input
              class="input input--money"
              type="number"
              placeholder="0.00"
              step="0.01"
              min="0"
              inputmode="decimal"
              bind:value={amount}
            />
          </div>
        </div>

        <label class="lbl">
          Paid by
          <div class="select-wrap">
            <select class="input select" bind:value={payerId}>
              {#each members as m (m.id)}
                <option value={m.id}>{m.name}</option>
              {/each}
            </select>
          </div>
        </label>

        <div class="lbl">
          <div class="split-between">
            <span>Split between</span>
            <span class="seg">
              <button type="button" onclick={() => setAll(true)}>All</button>
              <button type="button" onclick={() => setAll(false)}>None</button>
            </span>
          </div>
          <div class="picks">
            {#each members as m (m.id)}
              <label class="pick">
                <input type="checkbox" bind:checked={selected[m.id]} />
                <span class="pick__tick">✓</span>
                <span>{m.name}</span>
              </label>
            {/each}
          </div>
        </div>

        <button class="btn btn--primary btn--block" type="submit">
          Add expense
        </button>
      </form>

      {#if expenses.length}
        <ul class="ledger">
          {#each expenses as e (e.id)}
            <li>
              <div>
                <div class="ledger__desc">{e.desc || "Expense"}</div>
                <div class="ledger__sub">
                  {nameOf(e.payerId)} paid · split {e.participantIds.length} way{e
                    .participantIds.length === 1
                    ? ""
                    : "s"}
                </div>
              </div>
              <div class="ledger__right">
                <span class="ledger__amt"
                  >{formatMoney(e.amountCents, currency)}</span
                >
                <button
                  class="ledger__del"
                  type="button"
                  aria-label="Delete expense"
                  onclick={() => removeExpense(e.id)}>×</button
                >
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  {/if}

  <!-- 3. Settle up -->
  {#if showResults}
    <section class="card">
      <div class="card__head">
        <span class="step step--accent">3</span>
        <h2 class="card__title">Settle up</h2>
      </div>
      <p class="summary">
        {expenses.length} expense{expenses.length === 1 ? "" : "s"} · {formatMoney(
          total,
          currency,
        )} total
      </p>

      <ul class="payments">
        {#if transactions.length === 0}
          <li class="settled">🎉 All settled up — nobody owes anyone.</li>
        {:else}
          {#each transactions as t}
            <li>
              <span class="pay__from">{nameOf(t.fromId)}</span>
              <span class="pay__arrow">→</span>
              <span class="pay__to">{nameOf(t.toId)}</span>
              <span class="pay__amt">{formatMoney(t.amountCents, currency)}</span>
            </li>
          {/each}
        {/if}
      </ul>

      <details class="balances">
        <summary>See per-person balances</summary>
        <ul class="bal-list">
          {#each members as m (m.id)}
            {@const bal = balances.get(m.id) ?? 0}
            <li>
              <span>{m.name}</span>
              <span
                class="bal-tag {bal > 0
                  ? 'bal-tag--pos'
                  : bal < 0
                    ? 'bal-tag--neg'
                    : 'bal-tag--zero'}"
              >
                {bal > 0
                  ? `+${formatMoney(bal, currency)}`
                  : bal < 0
                    ? `-${formatMoney(-bal, currency)}`
                    : "even"}
              </span>
            </li>
          {/each}
        </ul>
      </details>
    </section>
  {/if}

  <!-- Toolbar -->
  <div class="toolbar">
    <label class="cur-field">
      <span>Currency</span>
      <input class="input input--sym" type="text" maxlength="3" bind:value={currency} />
    </label>
    <div class="toolbar__actions">
      <button class="btn btn--soft" type="button" onclick={share}>
        <svg class="btn__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"></path>
          <path
            d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"></path>
        </svg>
        Copy link
      </button>
      <button class="btn btn--ghost" type="button" onclick={reset}>Reset</button>
    </div>
  </div>

  {#if toast}
    <div class="toast">{toast}</div>
  {/if}
</section>

<style>
  .split {
    display: flex;
    flex-direction: column;
    gap: 1.1rem;
  }

  /* Hero */
  .hero {
    text-align: center;
    padding: 0.75rem 0 0.25rem;
  }
  .hero__icon {
    line-height: 1;
    color: var(--t-accent, currentColor);
  }
  .hero__icon svg {
    width: 1.9rem;
    height: 1.9rem;
    display: block;
    margin: 0 auto;
  }
  .hero__title {
    font-size: clamp(1.4rem, 4vw, 1.7rem);
    font-weight: 500;
    margin: 0.35rem 0 0.3rem;
    letter-spacing: -0.02em;
  }
  .hero__sub {
    color: var(--t-muted);
    font-size: 15px;
    max-width: 34ch;
    margin: 0 auto;
  }

  /* Card */
  .card {
    background: var(--t-surface);
    border: 1px solid var(--t-border);
    border-radius: var(--t-radius);
    box-shadow: var(--t-shadow);
    padding: 1.35rem;
  }
  .card__head {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-bottom: 1rem;
  }
  .step {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: var(--t-surface-2);
    color: var(--t-muted);
    font-size: 13px;
    font-weight: 600;
    flex-shrink: 0;
  }
  .step--accent {
    background: var(--t-accent);
    color: #fff;
  }
  .card__title {
    font-size: 1.15rem;
    font-weight: 500;
    margin: 0;
    letter-spacing: -0.01em;
  }

  /* Layout helpers */
  .inline {
    display: flex;
    gap: 0.6rem;
  }
  .stack {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }

  /* Inputs */
  .input {
    width: 100%;
    font-family: inherit;
    font-size: 16px;
    color: var(--t-text);
    background: var(--t-surface-2);
    border: 1.5px solid var(--t-border);
    border-radius: var(--t-radius-sm);
    padding: 0.7rem 0.85rem;
    transition:
      border-color 0.15s,
      background 0.15s;
  }
  .input::placeholder {
    color: var(--t-faint);
  }
  .input:focus {
    outline: none;
    border-color: var(--t-accent);
    background: var(--t-surface);
  }

  .inline .input:first-child {
    flex: 1;
    min-width: 0;
  }

  .money {
    position: relative;
    flex: 0 0 8.5rem;
  }
  .money__sym {
    position: absolute;
    left: 0.85rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--t-faint);
    font-size: 16px;
    pointer-events: none;
  }
  .input--money {
    padding-left: 1.7rem;
    text-align: right;
  }
  /* Drop the native (black) number spinners; they don't fit the theme. */
  .input[type="number"] {
    -moz-appearance: textfield;
    appearance: textfield;
  }
  .input[type="number"]::-webkit-outer-spin-button,
  .input[type="number"]::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .lbl {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    font-size: 13px;
    font-weight: 500;
    color: var(--t-muted);
  }

  .select-wrap {
    position: relative;
  }
  .select-wrap::after {
    content: "▾";
    position: absolute;
    right: 0.9rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--t-faint);
    pointer-events: none;
  }
  .select {
    appearance: none;
    cursor: pointer;
    padding-right: 2rem;
  }

  .split-between {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .seg {
    display: inline-flex;
    border: 1px solid var(--t-border);
    border-radius: 999px;
    overflow: hidden;
  }
  .seg button {
    border: none;
    background: var(--t-surface);
    color: var(--t-muted);
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    padding: 0.25rem 0.7rem;
    cursor: pointer;
    transition:
      background 0.15s,
      color 0.15s;
  }
  .seg button:hover {
    background: var(--t-accent-soft);
    color: var(--t-accent);
  }
  .seg button + button {
    border-left: 1px solid var(--t-border);
  }

  .picks {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .pick {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.45rem 0.8rem;
    border: 1.5px solid var(--t-border);
    border-radius: 999px;
    background: var(--t-surface-2);
    color: var(--t-muted);
    font-size: 14px;
    cursor: pointer;
    user-select: none;
    transition: all 0.15s;
  }
  .pick input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  .pick:has(input:checked) {
    border-color: var(--t-accent);
    background: var(--t-accent-soft);
    color: var(--t-accent-strong);
    font-weight: 500;
  }
  .pick__tick {
    opacity: 0;
    font-size: 11px;
    transition: opacity 0.15s;
  }
  .pick:has(input:checked) .pick__tick {
    opacity: 1;
  }

  /* Buttons */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    font-family: inherit;
    font-size: 15px;
    font-weight: 600;
    border-radius: var(--t-radius-sm);
    padding: 0.7rem 1.1rem;
    cursor: pointer;
    border: 1.5px solid transparent;
    transition:
      background 0.15s,
      color 0.15s,
      border-color 0.15s,
      transform 0.05s;
    white-space: nowrap;
  }
  .btn:active {
    transform: translateY(1px);
  }
  .btn__icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }
  .btn--primary {
    background: var(--t-accent);
    color: #fff;
  }
  .btn--primary:hover {
    background: var(--t-accent-strong);
  }
  .btn--block {
    width: 100%;
    padding-block: 0.8rem;
  }
  .btn--soft {
    background: var(--t-surface-2);
    color: var(--t-text);
    border-color: var(--t-border);
  }
  .btn--soft:hover {
    border-color: var(--t-accent);
    color: var(--t-accent);
  }
  .btn--ghost {
    background: transparent;
    color: var(--t-faint);
  }
  .btn--ghost:hover {
    color: var(--t-neg);
  }

  .hint {
    color: var(--t-faint);
    font-size: 13.5px;
    margin: 0.9rem 0 0;
  }

  /* People chips */
  .people {
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin: 1rem 0 0;
    padding: 0;
  }
  .person {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--t-accent-soft);
    color: var(--t-accent-strong);
    border-radius: 999px;
    padding: 0.35rem 0.45rem 0.35rem 0.9rem;
    font-size: 14px;
    font-weight: 500;
  }
  .person button {
    border: none;
    background: transparent;
    color: currentColor;
    opacity: 0.55;
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    padding: 0 0.15rem;
  }
  .person button:hover {
    opacity: 1;
  }

  /* Ledger */
  .ledger {
    list-style: none;
    margin: 1.1rem 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .ledger li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.7rem 0.85rem;
    background: var(--t-surface-2);
    border-radius: var(--t-radius-sm);
  }
  .ledger__desc {
    font-weight: 500;
  }
  .ledger__sub {
    color: var(--t-faint);
    font-size: 12.5px;
    margin-top: 0.1rem;
  }
  .ledger__right {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-shrink: 0;
  }
  .ledger__amt {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }
  .ledger__del {
    border: none;
    background: transparent;
    color: var(--t-faint);
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
  }
  .ledger__del:hover {
    color: var(--t-neg);
  }

  /* Settlement */
  .summary {
    color: var(--t-muted);
    font-size: 14px;
    margin: 0 0 1rem;
  }
  .payments {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .payments li {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    background: var(--t-surface);
    border: 1px solid var(--t-border);
    border-radius: var(--t-radius-sm);
    padding: 0.85rem 1rem;
    font-size: 15px;
  }
  .pay__from {
    font-weight: 600;
  }
  .pay__arrow {
    color: var(--t-accent);
    font-weight: 700;
  }
  .pay__to {
    font-weight: 600;
  }
  .pay__amt {
    margin-left: auto;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    color: var(--t-accent-strong);
  }
  .settled {
    justify-content: center;
    text-align: center;
    color: var(--t-pos);
    font-weight: 500;
    border: none !important;
    background: transparent !important;
  }

  .balances {
    margin-top: 1.1rem;
  }
  .balances summary {
    cursor: pointer;
    color: var(--t-muted);
    font-size: 13px;
    font-weight: 500;
  }
  .bal-list {
    list-style: none;
    margin: 0.85rem 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }
  .bal-list li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 14px;
  }
  .bal-tag {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    padding: 0.15rem 0.6rem;
    border-radius: 999px;
    font-size: 13px;
  }
  .bal-tag--pos {
    color: var(--t-pos);
    background: var(--t-pos-soft);
  }
  .bal-tag--neg {
    color: var(--t-neg);
    background: var(--t-neg-soft);
  }
  .bal-tag--zero {
    color: var(--t-faint);
    background: var(--t-surface-2);
  }

  /* Toolbar */
  .toolbar {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.25rem 0.25rem 0;
  }
  .cur-field {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-size: 12px;
    font-weight: 500;
    color: var(--t-muted);
  }
  .input--sym {
    width: 3.5rem;
    text-align: center;
  }
  .toolbar__actions {
    display: flex;
    gap: 0.5rem;
  }

  .toast {
    text-align: center;
    background: var(--t-text);
    color: var(--t-bg);
    font-size: 14px;
    font-weight: 500;
    padding: 0.7rem 1rem;
    border-radius: var(--t-radius-sm);
    margin-top: 0.5rem;
  }

  @media (max-width: 480px) {
    .inline {
      flex-wrap: wrap;
    }
    .money {
      flex: 1;
    }
    .inline .btn--primary {
      flex: 1;
    }
  }
</style>
