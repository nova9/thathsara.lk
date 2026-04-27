import { spawn } from "child_process";
import { existsSync } from "fs";
import { resolve, parse, join } from "path";

const args = process.argv.slice(2);
const videoArg = args.find((a) => !a.startsWith("--"));
const timeArg = args.find((a) => a.startsWith("--time="))?.split("=")[1] ?? "00:00:01";

if (!videoArg) {
  console.error("Usage: npm run thumbnail <video_file> [--time=HH:MM:SS]");
  process.exit(1);
}

const videoPath = resolve(videoArg);
if (!existsSync(videoPath)) {
  console.error(`File not found: ${videoPath}`);
  process.exit(1);
}

const { dir, name } = parse(videoPath);
const outPath = join(dir, `${name}.jpg`);

console.log(`Extracting thumbnail at ${timeArg} → ${outPath}`);

const child = spawn(
  "ffmpeg",
  ["-y", "-ss", timeArg, "-i", videoPath, "-frames:v", "1", "-q:v", "2", outPath],
  { stdio: "inherit" },
);

child.on("close", (code) => {
  if (code !== 0) {
    console.error("ffmpeg failed.");
    process.exit(code);
  }
  console.log(`Done: ${outPath}`);
});
