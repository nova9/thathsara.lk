import { spawn } from "child_process";
import { existsSync } from "fs";
import { resolve, parse, join } from "path";

const inputPath = resolve(process.argv[2] || "");

if (!inputPath || !existsSync(inputPath)) {
  console.error("Usage: npm run mov-to-mp4 <file.mov>");
  process.exit(1);
}

const { dir, name } = parse(inputPath);
const outputPath = join(dir, `${name}.mp4`);

console.log(`Converting ${inputPath} → ${outputPath}`);

const child = spawn("ffmpeg", [
  "-y",
  "-i", inputPath,
  "-c:v", "libx264",
  "-profile:v", "high",
  "-level", "4.0",
  "-pix_fmt", "yuv420p",
  "-c:a", "aac",
  "-b:a", "192k",
  "-movflags", "+faststart",
  outputPath,
], { stdio: "inherit" });

child.on("close", (code) => {
  if (code !== 0) process.exit(code);
  console.log(`Done: ${outputPath}`);
});
