// Expense splitting + optimal debt settlement.
//
// Everything runs in integer cents to avoid floating-point drift, so balances
// always reconcile to zero and totals settle exactly to the cent.

export interface Member {
  id: string;
  name: string;
}

export interface Expense {
  id: string;
  desc: string;
  payerId: string;
  amountCents: number;
  participantIds: string[];
}

export interface SplitState {
  members: Member[];
  expenses: Expense[];
  currency: string;
}

export interface Transaction {
  fromId: string;
  toId: string;
  amountCents: number;
}

export function emptyState(): SplitState {
  return { members: [], expenses: [], currency: "$" };
}

export function makeId(): string {
  return Math.random().toString(36).slice(2, 9);
}

// Net balance per member in cents: positive = is owed, negative = owes.
//
// Each expense's per-head share is floored, then the leftover cents are handed
// out one-by-one to the first participants. This guarantees the shares sum back
// to the exact amount, so the grand total of all balances is always zero.
export function computeBalances(state: SplitState): Map<string, number> {
  const net = new Map<string, number>();
  for (const m of state.members) net.set(m.id, 0);

  for (const e of state.expenses) {
    const parts = e.participantIds.filter((id) => net.has(id));
    if (parts.length === 0 || !net.has(e.payerId)) continue;

    const base = Math.floor(e.amountCents / parts.length);
    const remainder = e.amountCents - base * parts.length;

    net.set(e.payerId, (net.get(e.payerId) ?? 0) + e.amountCents);
    parts.forEach((pid, idx) => {
      const share = base + (idx < remainder ? 1 : 0);
      net.set(pid, (net.get(pid) ?? 0) - share);
    });
  }

  return net;
}

// Greedy minimum-cash-flow settlement: repeatedly settle the biggest debtor
// against the biggest creditor. Produces at most n-1 transactions for n people,
// which is near-optimal for real group sizes (exact minimization is NP-hard).
export function settle(net: Map<string, number>): Transaction[] {
  const debtors: { id: string; amt: number }[] = [];
  const creditors: { id: string; amt: number }[] = [];

  for (const [id, amt] of net) {
    if (amt < 0) debtors.push({ id, amt: -amt });
    else if (amt > 0) creditors.push({ id, amt });
  }

  debtors.sort((a, b) => b.amt - a.amt);
  creditors.sort((a, b) => b.amt - a.amt);

  const txns: Transaction[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amt, creditors[j].amt);
    if (pay > 0) {
      txns.push({ fromId: debtors[i].id, toId: creditors[j].id, amountCents: pay });
    }
    debtors[i].amt -= pay;
    creditors[j].amt -= pay;
    if (debtors[i].amt === 0) i++;
    if (creditors[j].amt === 0) j++;
  }

  return txns;
}

export function toCents(value: string | number): number {
  const n = typeof value === "number" ? value : parseFloat(value);
  if (!isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function formatMoney(cents: number, currency: string): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${currency}${(abs / 100).toFixed(2)}`;
}

// ── Shareable state ──────────────────────────────────────────────────────────
// Encode the whole group into a URL-safe string so a split can travel in a link
// with no backend. The JSON is deflated before base64url encoding to keep links
// short enough that chat apps linkify the whole URL (long fragments get
// truncated by their auto-linkifiers).

function bytesToBase64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream("deflate-raw");
  const writer = cs.writable.getWriter();
  writer.write(bytes);
  writer.close();
  return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream("deflate-raw");
  const writer = ds.writable.getWriter();
  writer.write(bytes);
  writer.close();
  return new Uint8Array(await new Response(ds.readable).arrayBuffer());
}

export async function encodeState(state: SplitState): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(state));
  return bytesToBase64url(await deflate(bytes));
}

export async function decodeState(encoded: string): Promise<SplitState | null> {
  try {
    const bytes = await inflate(base64urlToBytes(encoded));
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    if (!parsed || !Array.isArray(parsed.members) || !Array.isArray(parsed.expenses)) {
      return null;
    }
    return {
      members: parsed.members,
      expenses: parsed.expenses,
      currency: typeof parsed.currency === "string" ? parsed.currency : "$",
    };
  } catch {
    return null;
  }
}
