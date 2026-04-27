class DashVideo extends HTMLElement {
  constructor() {
    super();
    this.video = this.querySelector("video");
    this.shakaPlayer = null;
    this.shakaPromise = null;
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
    const events = [
      "play",
      "playing",
      "waiting",
      "canplay",
      "pause",
      "ended",
      "timeupdate",
      "progress",
      "loadedmetadata",
      "volumechange",
    ];
    events.forEach((evt) => {
      this.video.addEventListener(evt, () => {
        this.dispatchEvent(new Event(evt));
      });
    });
  }

  disconnectedCallback() {
    // Astro View Transitions unmount/remount persistent elements.
    // Defer destruction so connectedCallback can cancel it during DOM swaps.
    this._destroyTimeout = setTimeout(() => {
      if (!this.isConnected) {
        this.destroyShaka();
      }
    }, 0);
  }

  async loadVideo(manifestUrl, fallbackUrl) {
    if (!manifestUrl) {
      this.destroyShaka();
      if (fallbackUrl) {
        this.video.src = fallbackUrl;
      }
      return;
    }

    // Lock height during load to prevent layout shift while shaka attaches.
    const lockedHeight = this.getBoundingClientRect().height;
    if (lockedHeight > 0) {
      this.style.height = lockedHeight + "px";
      this.video.addEventListener(
        "playing",
        () => {
          this.style.height = "";
        },
        { once: true },
      );
    }

    try {
      const shakaLib = await this.getShaka();
      shakaLib.polyfill.installAll();

      if (!shakaLib.Player.isBrowserSupported()) {
        this.destroyShaka();
        if (fallbackUrl) this.video.src = fallbackUrl;
        return;
      }

      if (!this.shakaPlayer) {
        this.shakaPlayer = new shakaLib.Player();
        await this.shakaPlayer.attach(this.video);

        this.shakaPlayer.configure({
          streaming: {
            bufferingGoal: 3600,
            rebufferingGoal: 2,
            bufferBehind: 3600,
          },
        });

        this.shakaPlayer.addEventListener("error", (event) => {
          console.error("Shaka error", event?.detail || event);
        });
      }

      await this.shakaPlayer.load(manifestUrl);
      this.dispatchEvent(new Event("shakaready"));
    } catch (error) {
      console.error("Error loading Shaka player", error);
      this.destroyShaka();
      if (fallbackUrl) this.video.src = fallbackUrl;
    }
  }

  getTracks() {
    if (!this.shakaPlayer) return [];
    return this.shakaPlayer.getVariantTracks();
  }

  selectTrack(id) {
    if (!this.shakaPlayer) return;
    if (id === "auto") {
      this.shakaPlayer.configure({ abr: { enabled: true } });
      return;
    }
    this.shakaPlayer.configure({ abr: { enabled: false } });
    const track = this.shakaPlayer.getVariantTracks().find((t) => t.id == id);
    if (track) {
      this.shakaPlayer.selectVariantTrack(track, true);
    }
  }

  destroyShaka() {
    if (this.shakaPlayer) {
      this.shakaPlayer.destroy();
      this.shakaPlayer = null;
    }
  }

  play() {
    return this.video.play();
  }

  pause() {
    this.video.pause();
  }

  get paused() {
    return this.video.paused;
  }
}

if (!customElements.get("dash-video")) {
  customElements.define("dash-video", DashVideo);
}
