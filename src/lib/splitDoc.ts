// Collaborative document for Split Expenses.
//
// The ledger (people, expenses, currency) lives in a Yjs CRDT so that several
// devices can edit independently and merge without losing anyone's changes.
// Everything Yjs-specific is contained here; the Svelte component treats this
// as a plain store it can read, mutate, and subscribe to.
//
// Providers (IndexedDB persistence, the room websocket) are imported lazily so
// this module stays safe to import during SSR, where there is no browser.

import * as Y from "yjs";
import { makeId, type SplitState, type Member, type Expense } from "./settle";
import type { IndexeddbPersistence } from "y-indexeddb";
import type { WebsocketProvider } from "y-websocket";

// Marks transactions made by this user, so the UndoManager only rewinds our own
// edits and seeding/remote changes are excluded from the undo stack.
export const LOCAL_ORIGIN = Symbol("local-edit");

type YMember = Y.Map<string>;
type YExpense = Y.Map<string | number | string[]>;

export interface SplitDoc {
  read(): SplitState;
  /** Fires on any change to the ledger (local, remote, or undo). */
  subscribe(cb: () => void): () => void;

  addMember(name: string): string;
  removeMember(id: string): void;
  addExpense(expense: Omit<Expense, "id">): void;
  removeExpense(id: string): void;
  setCurrency(currency: string): void;
  reset(): void;
  /** One-time migration: only fills the doc if it is still empty. */
  seedIfEmpty(state: SplitState): void;

  canUndo(): boolean;
  canRedo(): boolean;
  undo(): void;
  redo(): void;

  connectPersistence(name: string): Promise<IndexeddbPersistence>;
  connectRoom(url: string, room: string): Promise<WebsocketProvider>;
  destroy(): void;
}

export function createSplitDoc(): SplitDoc {
  const doc = new Y.Doc();
  const root = doc.getMap<string>("root"); // holds "currency"
  const members = doc.getArray<YMember>("members");
  const expenses = doc.getArray<YExpense>("expenses");

  const undoManager = new Y.UndoManager([root, members, expenses], {
    trackedOrigins: new Set([LOCAL_ORIGIN]),
  });

  // Local edits are wrapped so they share one origin and undo as one step.
  const edit = (fn: () => void) => doc.transact(fn, LOCAL_ORIGIN);

  const memberMap = (m: Member): YMember => {
    const ym = new Y.Map<string>();
    ym.set("id", m.id);
    ym.set("name", m.name);
    return ym;
  };

  const expenseMap = (e: Expense): YExpense => {
    const ye = new Y.Map<string | number | string[]>();
    ye.set("id", e.id);
    ye.set("desc", e.desc);
    ye.set("payerId", e.payerId);
    ye.set("amountCents", e.amountCents);
    ye.set("participantIds", e.participantIds);
    return ye;
  };

  const indexOf = <T>(arr: Y.Array<Y.Map<T>>, id: string): number =>
    arr.toArray().findIndex((m) => m.get("id") === id);

  function read(): SplitState {
    return {
      currency: root.get("currency") ?? "$",
      members: members.toArray().map((m) => ({
        id: m.get("id") as string,
        name: m.get("name") as string,
      })),
      expenses: expenses.toArray().map((e) => ({
        id: e.get("id") as string,
        desc: e.get("desc") as string,
        payerId: e.get("payerId") as string,
        amountCents: e.get("amountCents") as number,
        participantIds: [...((e.get("participantIds") as string[]) ?? [])],
      })),
    };
  }

  return {
    read,

    subscribe(cb) {
      const onChange = () => cb();
      // Cover ledger edits and undo-stack changes (so canUndo/canRedo refresh).
      members.observeDeep(onChange);
      expenses.observeDeep(onChange);
      root.observe(onChange);
      undoManager.on("stack-item-added", onChange);
      undoManager.on("stack-item-popped", onChange);
      undoManager.on("stack-cleared", onChange);
      return () => {
        members.unobserveDeep(onChange);
        expenses.unobserveDeep(onChange);
        root.unobserve(onChange);
        undoManager.off("stack-item-added", onChange);
        undoManager.off("stack-item-popped", onChange);
        undoManager.off("stack-cleared", onChange);
      };
    },

    addMember(name) {
      const id = makeId();
      edit(() => members.push([memberMap({ id, name })]));
      return id;
    },

    removeMember(id) {
      edit(() => {
        const mi = indexOf(members, id);
        if (mi >= 0) members.delete(mi, 1);
        // Drop expenses this person paid; strip them from the rest; remove any
        // expense left with no participants. Walk backwards for stable indices.
        for (let i = expenses.length - 1; i >= 0; i--) {
          const e = expenses.get(i);
          if (e.get("payerId") === id) {
            expenses.delete(i, 1);
            continue;
          }
          const parts = (e.get("participantIds") as string[]).filter(
            (p) => p !== id,
          );
          if (parts.length === 0) expenses.delete(i, 1);
          else e.set("participantIds", parts);
        }
      });
    },

    addExpense(expense) {
      edit(() => expenses.push([expenseMap({ ...expense, id: makeId() })]));
    },

    removeExpense(id) {
      edit(() => {
        const i = indexOf(expenses, id);
        if (i >= 0) expenses.delete(i, 1);
      });
    },

    setCurrency(currency) {
      edit(() => root.set("currency", currency));
    },

    reset() {
      edit(() => {
        if (members.length) members.delete(0, members.length);
        if (expenses.length) expenses.delete(0, expenses.length);
        root.set("currency", "$");
      });
      undoManager.clear();
    },

    seedIfEmpty(state) {
      if (members.length || expenses.length || root.has("currency")) return;
      // Seed outside LOCAL_ORIGIN: migrating old data is not an undoable action.
      doc.transact(() => {
        root.set("currency", state.currency);
        for (const m of state.members) members.push([memberMap(m)]);
        for (const e of state.expenses) expenses.push([expenseMap(e)]);
      });
    },

    canUndo: () => undoManager.canUndo(),
    canRedo: () => undoManager.canRedo(),
    undo: () => undoManager.undo(),
    redo: () => undoManager.redo(),

    async connectPersistence(name) {
      const { IndexeddbPersistence } = await import("y-indexeddb");
      return new IndexeddbPersistence(name, doc);
    },

    async connectRoom(url, room) {
      const { WebsocketProvider } = await import("y-websocket");
      return new WebsocketProvider(url, room, doc);
    },

    destroy() {
      undoManager.destroy();
      doc.destroy();
    },
  };
}
