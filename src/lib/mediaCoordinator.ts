// Ephemeral, per-tab playback coordination: starting one media source pauses
// the others, so only one thing plays at a time.
//
// This is NOT in the persisted store on purpose — "what's playing right now" is
// transient session state that must not survive reloads or sync across tabs.
// A coordinator is allowed to know about the things it coordinates, so the
// cross-media DOM lookups live here rather than inside either player component.

type Source = "music" | "video";

export function announcePlayback(source: Source, id?: string) {
  if (source !== "music") {
    const audio = document.getElementById("bg-audio") as HTMLMediaElement | null;
    if (audio && !audio.paused) audio.pause();
  }

  document.querySelectorAll<HTMLElement>(".video-player").forEach((p) => {
    const v = p.querySelector("video");
    if (!v || v.paused) return;
    if (source === "video" && id === p.id) return;
    v.pause();
  });
}
