export class Toggle {
  static bind(btn: HTMLButtonElement, eventName: string, signal?: AbortSignal) {
    const isOn = localStorage.getItem(btn.id) === "true";
    btn.setAttribute("aria-checked", String(isOn));

    btn.addEventListener(
      "click",
      () => {
        const isNowOn = btn.getAttribute("aria-checked") !== "true";
        document.dispatchEvent(
          new CustomEvent(eventName, { detail: { on: isNowOn } }),
        );
      },
      { signal },
    );

    document.addEventListener(eventName, (e) => {
      const customEvent = e as CustomEvent<{ on: Boolean }>;
      if (customEvent.detail.on) {
        btn.setAttribute("aria-checked", "true");
        localStorage.setItem(btn.id, "true");
      } else {
        btn.setAttribute("aria-checked", "false");
        localStorage.setItem(btn.id, "false");
      }
    });
  }

  static dispatch(eventName: string, state: boolean, storageKey?: string) {
    if (storageKey) localStorage.setItem(storageKey, String(state));
    document.dispatchEvent(new CustomEvent(eventName, { detail: { state } }));
  }

  static onChange(eventName: string, cb: (isOn: boolean) => void) {
    document.addEventListener(eventName, (e) => {
      cb((e as CustomEvent<{ on: boolean }>).detail.on);
    });
  }
}
