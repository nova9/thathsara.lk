import { spawn } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { resolve } from "path";

// Generates 1200x630 Open Graph / social-share images with ImageMagick.
// Add an entry here to give another page its own social card, then run:
//   pnpm run generate-og            (all cards)
//   pnpm run generate-og split      (just the one with that slug)
//
// Requires ImageMagick: `brew install imagemagick`.

const SFNS = "/System/Library/Fonts/SFNS.ttf";
const SFNS_MONO = "/System/Library/Fonts/SFNSMono.ttf";
const OUT_DIR = resolve("public/og");

// Tool-shell palette (see src/layouts/ToolLayout.astro dark theme).
const theme = {
  bgTop: "#1b1d2e",
  bgBottom: "#14151f",
  accent: "#6366f1",
  accentSoft: "#818cf8",
  title: "#edeefb",
  muted: "#a2a8cb",
  faint: "#6f769b",
};

const cards = [
  {
    slug: "split-expenses",
    eyebrow: "TOOLS",
    title: "Split Expenses",
    lines: [
      "Split shared costs across a group and settle",
      "up with the fewest possible payments.",
    ],
    brand: "thathsara.lk",
    brandSuffix: " / tools",
  },
];

function build(card) {
  const out = resolve(OUT_DIR, `${card.slug}.png`);
  const args = [
    "-size", "1200x630", `gradient:${theme.bgTop}-${theme.bgBottom}`,
    "-font", SFNS,
    // top accent bar
    "(", "-size", "1200x630", "xc:none", "-fill", theme.accent,
    "-draw", "roundrectangle 0,0 1200,8 0,0", ")", "-composite",
    // eyebrow
    "-fill", theme.accentSoft, "-font", SFNS_MONO,
    "-pointsize", "30", "-annotate", "+90+150", card.eyebrow,
    // title
    "-fill", theme.title, "-font", SFNS,
    "-pointsize", "96", "-annotate", "+88+270", card.title,
  ];

  // subtitle lines
  card.lines.forEach((line, i) => {
    args.push("-fill", theme.muted, "-pointsize", "38",
      "-annotate", `+90+${345 + i * 50}`, line);
  });

  // brand footer
  args.push("-fill", theme.faint, "-pointsize", "30", "-annotate", "+90+560", card.brand);
  if (card.brandSuffix) {
    const offset = 90 + card.brand.length * 16;
    args.push("-fill", theme.accentSoft, "-pointsize", "30",
      "-annotate", `+${offset}+560`, card.brandSuffix);
  }

  args.push(out);

  return new Promise((res, rej) => {
    const child = spawn("magick", args, { stdio: "inherit" });
    child.on("error", (err) => {
      if (err.code === "ENOENT") {
        console.error("`magick` not found. Install ImageMagick: brew install imagemagick");
      }
      rej(err);
    });
    child.on("close", (code) => {
      if (code !== 0) return rej(new Error(`magick exited with code ${code}`));
      console.log(`✓ ${out}`);
      res();
    });
  });
}

const filter = process.argv[2];
const selected = filter
  ? cards.filter((c) => c.slug === filter || c.slug.startsWith(filter))
  : cards;

if (selected.length === 0) {
  console.error(`No OG card matches "${filter}". Known: ${cards.map((c) => c.slug).join(", ")}`);
  process.exit(1);
}

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

for (const card of selected) {
  await build(card);
}
