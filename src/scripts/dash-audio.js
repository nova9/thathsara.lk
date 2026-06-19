class DashAudio extends HTMLElement {
  constructor() {
    super();
    this.audio = document.createElement("audio");
    if (this.hasAttribute("preload")) {
      this.audio.setAttribute("preload", this.getAttribute("preload"));
    }
    this.audio.crossOrigin = "anonymous";
    this.appendChild(this.audio);
    this.shakaPlayer = null;
    this.shakaPromise = null;
    this.analyser = null;
    // Safari routes Shaka's MSE/DASH audio outside the Web Audio graph, so the
    // AnalyserNode reads all zeros. Force the progressive fallback file there.
    this.preferProgressive = /apple/i.test(navigator.vendor);
  }

  ensureAnalyser() {
    if (this.analyser) return this.analyser;

    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.audioCtx = new Ctx();
    this.sourceNode = this.audioCtx.createMediaElementSource(this.audio);
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.8;
    this.sourceNode.connect(this.analyser);
    this.analyser.connect(this.audioCtx.destination);
    this._freq = new Uint8Array(this.analyser.frequencyBinCount);
    return this.analyser;
  }

  getLevel() {
    if (!this.analyser) return 0;
    this.analyser.getByteFrequencyData(this._freq);
    let sum = 0;
    for (let i = 0; i < this._freq.length; i++) sum += this._freq[i];
    return sum / (this._freq.length * 255);
  }

  async getShaka() {
    if (window.shaka) return window.shaka;
    if (this.shakaPromise) return this.shakaPromise;

    this.dispatchEvent(new Event("shakaloading"));
    this.shakaPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src =
        "https://cdn.jsdelivr.net/npm/shaka-player/dist/shaka-player.dash.js";
      script.onload = () => {
        this.dispatchEvent(new Event("shakaloaded"));
        resolve(window.shaka);
      };
      script.onerror = (err) => {
        this.dispatchEvent(new Event("shakaloaded"));
        reject(err);
      };
      document.head.appendChild(script);
    });
    return this.shakaPromise;
  }

  connectedCallback() {
    // If the element is reconnected before the destruction fires, cancel it.
    if (this._destroyTimeout) {
      clearTimeout(this._destroyTimeout);
      this._destroyTimeout = null;
    }

    if (this._eventsBound) return;
    this._eventsBound = true;
    const events = ["play", "playing", "waiting", "canplay", "pause", "ended"];
    events.forEach((evt) => {
      this.audio.addEventListener(evt, () => {
        this.dispatchEvent(new Event(evt));
      });
    });
  }

  disconnectedCallback() {
    // Astro View Transitions unmount/remount persistent elements.
    // Use setTimeout to defer destruction and allow connectedCallback to cancel it.
    this._destroyTimeout = setTimeout(() => {
      if (!this.isConnected) {
        this.destroyShaka();
      }
    }, 0); // 0ms is enough because connectedCallback fires synchronously during DOM swaps
  }

  async loadTrack(manifestUrl, fallbackUrl) {
    if (this.preferProgressive) manifestUrl = null;
    if (!manifestUrl) {
      this.destroyShaka();
      this.audio.src = fallbackUrl;
      return;
    }

    try {
      const shakaLib = await this.getShaka();
      shakaLib.polyfill.installAll();

      if (!shakaLib.Player.isBrowserSupported()) {
        this.destroyShaka();
        this.audio.src = fallbackUrl;
        return;
      }

      if (!this.shakaPlayer) {
        this.shakaPlayer = new shakaLib.Player();
        await this.shakaPlayer.attach(this.audio);
        this.shakaPlayer.addEventListener("error", (event) => {
          console.error("Shaka error", event?.detail || event);
        });
      }

      await this.shakaPlayer.load(manifestUrl);
    } catch (error) {
      console.error(error);
      this.destroyShaka();
      this.audio.src = fallbackUrl;
    }
  }

  destroyShaka() {
    if (this.shakaPlayer) {
      this.shakaPlayer.destroy();
      this.shakaPlayer = null;
    }
  }

  play() {
    this.ensureAnalyser();
    if (this.audioCtx?.state === "suspended") this.audioCtx.resume();
    return this.audio.play();
  }

  pause() {
    this.audio.pause();
  }

  get paused() {
    return this.audio.paused;
  }

  get readyState() {
    return this.audio.readyState;
  }

  get volume() {
    return this.audio.volume;
  }

  set volume(v) {
    this.audio.volume = v;
  }
}

if (!customElements.get("dash-audio")) {
  customElements.define("dash-audio", DashAudio);
}
