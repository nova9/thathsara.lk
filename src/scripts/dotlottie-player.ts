type DotLottieCtor = typeof import("@lottiefiles/dotlottie-web").DotLottie;
type DotLottieInstance = InstanceType<DotLottieCtor>;

let dotLottiePromise: Promise<DotLottieCtor> | null = null;

function getDotLottie(): Promise<DotLottieCtor> {
  if (dotLottiePromise) return dotLottiePromise;
  dotLottiePromise = Promise.all([
    import("@lottiefiles/dotlottie-web"),
    import("@lottiefiles/dotlottie-web/dotlottie-player.wasm?url"),
  ]).then(([{ DotLottie }, { default: wasmUrl }]) => {
    DotLottie.setWasmUrl(wasmUrl);
    return DotLottie;
  });
  return dotLottiePromise;
}

class DotLottiePlayer extends HTMLElement {
  private canvas: HTMLCanvasElement;
  private spinner: HTMLDivElement;
  private instance: DotLottieInstance | null = null;
  private ready = false;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `
      :host { position: relative; display: inline-block; }
      canvas { width: 100%; height: 100%; opacity: 0; transition: opacity 200ms ease; }
      canvas.ready { opacity: 1; }
      .spinner {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 24px;
        height: 24px;
        margin: -12px 0 0 -12px;
        border-radius: 50%;
        border: 2px solid currentColor;
        border-top-color: transparent;
        opacity: 0.4;
        animation: dlspin 0.8s linear infinite;
      }
      .spinner.hidden { display: none; }
      @keyframes dlspin { to { transform: rotate(360deg); } }
      @media (prefers-reduced-motion: reduce) {
        .spinner { animation: none; }
      }
    `;
    this.shadowRoot!.appendChild(style);

    this.canvas = document.createElement("canvas");
    this.shadowRoot!.appendChild(this.canvas);

    this.spinner = document.createElement("div");
    this.spinner.className = "spinner";
    this.shadowRoot!.appendChild(this.spinner);
  }

  static get observedAttributes() {
    return ["src", "loop", "autoplay"];
  }

  attributeChangedCallback() {
    if (this.ready) this.render();
  }

  connectedCallback() {
    this.render();
    this.ready = true;
  }

  disconnectedCallback() {
    this.instance?.destroy();
    this.instance = null;
  }

  private async render() {
    const src = this.getAttribute("src");
    if (!src) return;

    this.spinner.classList.remove("hidden");
    this.canvas.classList.remove("ready");

    const DotLottie = await getDotLottie();
    if (!this.isConnected) return;

    this.instance?.destroy();
    this.instance = new DotLottie({
      canvas: this.canvas,
      src,
      autoplay: this.hasAttribute("autoplay"),
      loop: this.hasAttribute("loop"),
    });

    this.instance.addEventListener("load", () => {
      this.spinner.classList.add("hidden");
      this.canvas.classList.add("ready");
    });
  }
}

if (!customElements.get("dotlottie-player")) {
  customElements.define("dotlottie-player", DotLottiePlayer);
}
