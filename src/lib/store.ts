// Type for the subscriber callback function
export type StoreSubscriber<T> = (
  property: keyof T,
  newValue: T[keyof T],
  state: T,
) => void;

class GlobalStore<T extends Record<string, any>> {
  private storageKey: string;
  private defaultState: T;
  private subscribers: Set<StoreSubscriber<T>> = new Set();
  private _state: T | null = null;
  private isBrowser: boolean;

  constructor(storageKey: string, defaultState: T) {
    this.storageKey = storageKey;
    this.defaultState = defaultState;
    this.isBrowser = typeof window !== "undefined";
  }

  // Getter to lazily initialize the state on the client side
  get state(): T {
    if (!this._state) {
      if (this.isBrowser) {
        const initialData = this._load() || this.defaultState;
        this._state = this._createProxy(initialData);
      } else {
        // Fallback for the server during build/SSR
        return this.defaultState;
      }
    }
    return this._state;
  }

  private _createProxy(data: T): T {
    return new Proxy(data, {
      set: (target: T, property: string | symbol, value: any) => {
        // Enforce that we are only setting keys that exist on our state type
        const key = property as keyof T;

        if (target[key] === value) return true;

        target[key] = value;
        this._save(target);
        this._notify(key, value);
        return true;
      },
    });
  }

  private _load(): T | null {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? (JSON.parse(data) as T) : null;
    } catch (e) {
      return null;
    }
  }

  private _save(target: T): void {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(target));
    } catch (e) {}
  }

  private _notify(property: keyof T, value: T[keyof T]): void {
    this.subscribers.forEach((callback) =>
      callback(property, value, this.state),
    );
  }

  // Register a callback to react to state changes
  subscribe(callback: StoreSubscriber<T>): () => void {
    this.subscribers.add(callback);
    // Return an unsubscribe function for cleanup
    return () => this.subscribers.delete(callback);
  }
}

// Defining the shape of our global application state
export interface AppState {
  easter_egg_banner: Boolean;
  music_player: Boolean;
}

// Export a single global instance with strict typing inferred automatically
export const store = new GlobalStore<AppState>("MY_APP_STATE", {
  easter_egg_banner: false,
  music_player: true
});
