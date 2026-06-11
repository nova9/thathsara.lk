// Global app settings, persisted to localStorage (one key per setting).
// Read with store.get, write with store.set; subscribers fire on change,
// including changes made from other tabs.

export interface AppState {
  musicPlayer: boolean;
  easterEggBanner: boolean;
}

const DEFAULTS: AppState = {
  musicPlayer: true,
  easterEggBanner: true,
};

// Storage key names predate the store; kept so existing visitors'
// saved choices survive.
const STORAGE_KEYS: Record<keyof AppState, string> = {
  musicPlayer: "music-toggle-setting",
  easterEggBanner: "banner-toggle-setting",
};

type Subscriber = (value: boolean) => void;

class SettingsStore {
  private subs = new Map<keyof AppState, Set<Subscriber>>();

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("storage", (e) => {
        const entry = (
          Object.entries(STORAGE_KEYS) as [keyof AppState, string][]
        ).find(([, storageKey]) => storageKey === e.key);
        if (entry) this.notify(entry[0], e.newValue === "true");
      });
    }
  }

  get(key: keyof AppState): boolean {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS[key]);
      return raw === null ? DEFAULTS[key] : raw === "true";
    } catch {
      return DEFAULTS[key];
    }
  }

  set(key: keyof AppState, value: boolean): void {
    if (this.get(key) === value) return;
    try {
      localStorage.setItem(STORAGE_KEYS[key], String(value));
    } catch {
      // Private browsing or storage disabled; still notify so the UI reacts.
    }
    this.notify(key, value);
  }

  subscribe(key: keyof AppState, cb: Subscriber): () => void {
    let set = this.subs.get(key);
    if (!set) {
      set = new Set();
      this.subs.set(key, set);
    }
    set.add(cb);
    return () => set.delete(cb);
  }

  private notify(key: keyof AppState, value: boolean): void {
    this.subs.get(key)?.forEach((cb) => cb(value));
  }
}

export const store = new SettingsStore();
