import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

import mdx from "@astrojs/mdx";

export default defineConfig({
  site: "https://thathsara.lk",
  trailingSlash: "always",
  integrations: [sitemap(), mdx()],
  build: {
    inlineStylesheets: "always",
  },
});