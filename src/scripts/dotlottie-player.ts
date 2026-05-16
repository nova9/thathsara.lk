import { DotLottie } from "@lottiefiles/dotlottie-web";
import wasmUrl from "@lottiefiles/dotlottie-web/dotlottie-player.wasm?url";

DotLottie.setWasmUrl(wasmUrl);

class DotLottiePlayer extends HTMLElement {
  private canvas: HTMLCanvasElement;
  private instance: DotLottie | null = null;
  private ready = false;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.canvas = document.createElement("canvas");
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.shadowRoot!.appendChild(this.canvas);
  }

  static get observedAttributes() {
    return ["src", "loop", "autoplay"];
  }

  attributeChangedCallback() {
    if (this.ready) this.loadAnimation();
  }

  connectedCallback() {
    this.loadAnimation();
    this.ready = true;
  }

  disconnectedCallback() {
    this.instance?.destroy();
    this.instance = null;
  }

  private loadAnimation() {
    const src = this.getAttribute("src");
    if (!src) return;

    this.instance?.destroy();
    this.instance = new DotLottie({
      canvas: this.canvas,
      src,
      autoplay: this.hasAttribute("autoplay"),
      loop: this.hasAttribute("loop"),
    });
  }
}

if (!customElements.get("dotlottie-player")) {
  customElements.define("dotlottie-player", DotLottiePlayer);
}
