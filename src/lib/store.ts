// Reactive localStorage cell: get / set / subscribe, synced across tabs.
// Every piece of global, persisted state in the app is one of these — read
// with .get(), write with .set(), react with .subscribe(). Never touch
// localStorage directly.

type Subscriber<T> = (value: T) => void;

export interface Cell<T> {
  get(): T;
  set(value: T): void;
  subscribe(cb: Subscriber<T>): () => void;
}

export function persisted<T>(
  key: string,
  initial: T,
  parse: (raw: string) => T = JSON.parse,
  stringify: (value: T) => string = JSON.stringify,
): Cell<T> {
  const subs = new Set<Subscriber<T>>();

  const get = (): T => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : parse(raw);
    } catch {
      return initial;
    }
  };

  // Mirror changes made in other tabs.
  if (typeof window !== "undefined") {
    window.addEventListener("storage", (e) => {
      if (e.key === key) subs.forEach((cb) => cb(get()));
    });
  }

  return {
    get,
    set(value) {
      try {
        localStorage.setItem(key, stringify(value));
      } catch {
        // Private browsing or storage disabled; still notify so the UI reacts.
      }
      subs.forEach((cb) => cb(value));
    },
    subscribe(cb) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
  };
}

// Default JSON codec already produces the legacy "true"/"false" strings these
// keys predate the store with, so existing visitors' choices survive.
export const musicPlayer = persisted("music-toggle-setting", true);
export const easterEggBanner = persisted("banner-toggle-setting", true);

// Number cell; legacy format is a bare float string, e.g. "0.9".
export const musicVolume = persisted("music-player-volume", 0.9, parseFloat, String);
