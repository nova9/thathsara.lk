# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # start dev server (localhost:4321)
npm run build        # astro build + pagefind search index generation
npm run preview      # preview the production build locally

npm run download     # download + tag music from YouTube (requires ffmpeg, yt-dlp, kid3-cli, OPENAI_API_KEY)
npm run video        # download video for embedding
npm run purge-cache  # purge Cloudflare CDN cache after deploy (uses env vars)
```

## Architecture

**Stack:** Astro 6 (SSG) + SCSS + MDX. No JS UI framework — all components are `.astro` files. Zero framework runtime is shipped to the browser.

**Content model:** Blog posts live in `src/posts/` as `.md`/`.mdx` files, typed via Astro Content Collections (`src/content.config.ts`). The schema enforces `title`, `date`, and optional `tags`, `excerpt`, `accentColor`, `featured`, `draft`. `getVisiblePosts()` / `getAllPosts()` in `src/lib/utils.ts` are the primary data-access helpers — `getAllPosts` returns at most 10 posts, featured-first then by `updatedDate ?? date`.

**Routing:**
- `src/pages/index.astro` — homepage
- `src/pages/posts/[...slug].astro` — individual post pages (dynamic route)
- `src/pages/tags/[tag].astro` — tag archive pages
- `src/pages/about.md`, `thoughts.md` — static content pages
- `src/pages/settings.astro` — client-side settings page

**Layout:** `src/layouts/BaseLayout.astro` is the single shared layout. It accepts `title`, `description`, `accentColor`, and `image` props. `accentColor` drives a per-page CSS custom property override (`--color-primary`, `--color-border`) used for post theming.

**Styling:** Hand-written SCSS in `src/styles/`. `main.scss` sets CSS custom properties as design tokens; `dark.scss` overrides them under `@media (prefers-color-scheme: dark)`. Component styles use `lang="scss"` — Astro scopes them automatically. `inlineStylesheets: "always"` in `astro.config.mjs` means all CSS is inlined into HTML (no separate stylesheet requests).

**Client-side JS:** Astro View Transitions (`<ClientRouter />`) is enabled globally, making navigation SPA-like with a progress bar animation. `MusicPlayer` and `VideoPlayer` use `requestIdleCallback` to defer setup. Shaka Player (DASH audio/video) is loaded on-demand from jsDelivr only when the user initiates playback. Umami analytics is injected once on `astro:page-load`, production-only.

**Music pipeline:** `public/music/` holds `.opus` files and MPEG-DASH manifests. `npm run download` uses `yt-dlp` + `ffmpeg` + `kid3-cli` to fetch, convert, and tag tracks, with OpenAI used for metadata generation. The URL queue is hardcoded in `npm-run/download.js`.

**Search:** Pagefind runs as a post-build step (`astro build && pagefind --site dist`), generating a static search index in `dist/pagefind/`. The search UI is wired up in `settings.astro`.

**Deployment:** GitHub Actions (`.github/workflows/deploy.yaml`) builds and deploys to GitHub Pages. Cloudflare sits in front as CDN/proxy; the workflow calls `npm run purge-cache` after deploy.

## Site config

Global metadata (site title, description, copyright) lives in `src/lib/site.ts` (`siteConfig`). The path alias `@/` maps to `src/`.

## Post frontmatter

```yaml
---
title: "Post Title"
date: 2024-01-01
tags: [tag1, tag2]       # optional
excerpt: "..."           # optional; used for meta description
accentColor: "#hex"      # optional; overrides site primary color for this post
featured: true           # optional; floats to top of post list
draft: true              # optional; excludes from build
---
```

## Environment variables

See `.env.example`. Required for utility scripts:
- `OPENAI_API_KEY` / `OPENAI_MODEL` — used by `npm run download` for metadata generation
- Cloudflare credentials — used by `npm run purge-cache`
