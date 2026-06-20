// Single source of truth for the browser-tools palette.
// Consumed by src/layouts/ToolLayout.astro (renders the --t-* CSS variables)
// and npm-run/generate-og.js (social-card colors). Plain .js so the Node OG
// script can import it without a TypeScript loader.

const light = {
  bg: "#eef1fb",
  surface: "#ffffff",
  surface2: "#f6f7fd",
  border: "#e4e7f2",
  text: "#1b1d2e",
  muted: "#6b7191",
  faint: "#9aa0bf",
  accent: "#6366f1",
  accentStrong: "#4f46e5",
  accentSoft: "#eef0ff",
  pos: "#0ea371",
  posSoft: "#e3f7ee",
  neg: "#e1395a",
  negSoft: "#fde8ec",
  shadow:
    "0 1px 2px rgba(27, 29, 46, 0.04), 0 8px 24px -12px rgba(27, 29, 46, 0.18)",
};

const dark = {
  bg: "#101220",
  surface: "#1a1d2e",
  surface2: "#21243a",
  border: "#2b2f48",
  text: "#edeefb",
  muted: "#a2a8cb",
  faint: "#6f769b",
  accent: "#818cf8",
  accentStrong: "#a5b0ff",
  accentSoft: "#232744",
  pos: "#34d399",
  posSoft: "#1632312e",
  neg: "#fb7185",
  negSoft: "#3a1f2a",
  shadow:
    "0 1px 2px rgba(0, 0, 0, 0.3), 0 12px 28px -14px rgba(0, 0, 0, 0.6)",
};

export const toolTheme = { light, dark };

// Social-card colors. `bgTop`/`bgBottom` are a deep gradient unique to the
// cards; everything else reuses the dark tool palette so a palette change
// flows through to the generated OG images automatically.
export const ogCard = {
  bgTop: "#1b1d2e",
  bgBottom: "#14151f",
  accent: light.accent,
  accentSoft: dark.accent,
  title: dark.text,
  muted: dark.muted,
  faint: dark.faint,
};

// Maps semantic keys above to their --t-* CSS variable names.
const cssVar = {
  bg: "--t-bg",
  surface: "--t-surface",
  surface2: "--t-surface-2",
  border: "--t-border",
  text: "--t-text",
  muted: "--t-muted",
  faint: "--t-faint",
  accent: "--t-accent",
  accentStrong: "--t-accent-strong",
  accentSoft: "--t-accent-soft",
  pos: "--t-pos",
  posSoft: "--t-pos-soft",
  neg: "--t-neg",
  negSoft: "--t-neg-soft",
  shadow: "--t-shadow",
};

function declarations(tokens, indent) {
  return Object.entries(tokens)
    .map(([key, value]) => `${indent}${cssVar[key]}: ${value};`)
    .join("\n");
}

// Renders the :root color variables plus their dark-scheme overrides.
export function toolThemeCss() {
  return `:root {
${declarations(light, "  ")}
}
@media (prefers-color-scheme: dark) {
  :root {
${declarations(dark, "    ")}
  }
}`;
}
