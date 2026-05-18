export class Toggle {
  static bind(btn: HTMLButtonElement, eventName: string, signal?: AbortSignal) {
    const isOff = localStorage.getItem(btn.id) === "true";
    btn.setAttribute("aria-checked", String(!isOff));

    btn.addEventListener("click", () => {
      const isNowOn = btn.getAttribute("aria-checked") !== "true";
      btn.setAttribute("aria-checked", String(isNowOn));
      localStorage.setItem(btn.id, String(!isNowOn));
      document.dispatchEvent(
        new CustomEvent(eventName, { detail: { on: isNowOn } }),
      );
    }, { signal });
  }

  static onChange(eventName: string, cb: (isOn: boolean) => void) {
    document.addEventListener(eventName, (e) => {
      cb((e as CustomEvent<{ on: boolean }>).detail.on);
    });
  }
}
