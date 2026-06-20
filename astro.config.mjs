import { defineConfig, fontProviders } from "astro/config";
import sitemap from "@astrojs/sitemap";

import mdx from "@astrojs/mdx";

import svelte from "@astrojs/svelte";

export default defineConfig({
  site: "https://thathsara.lk",
  trailingSlash: "always",
  devToolbar: { enabled: false },
  integrations: [sitemap(), mdx(), svelte()],
  fonts: [
    {
      provider: fontProviders.google(),
      name: "DM Sans",
      cssVariable: "--font-dm-sans",
      weights: [300, 400, 500],
      styles: ["normal"],
      subsets: ["latin"],
      fallbacks: ["sans-serif"],
    },
  ],
});