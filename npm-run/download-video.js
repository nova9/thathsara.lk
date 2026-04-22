import { spawn, spawnSync } from "child_process";
import { existsSync, mkdirSync, renameSync } from "fs";
import { resolve, parse, join } from "path";
import { Listr } from "listr2";

const rawArgs = process.argv.slice(2);
const cookiesArgIndex = rawArgs.indexOf("--cookies");
const cookiesValue =
  cookiesArgIndex !== -1 ? rawArgs[cookiesArgIndex + 1] : null;
const urlOrPath = rawArgs.find(
  (arg, i) => !arg.startsWith("--") && rawArgs[i - 1] !== "--cookies",
);
const outputDir = resolve("public/videos");

if (!urlOrPath) {
  console.error(
    "Usage: node scripts/download-video.js <youtube_url_or_local_file> [--cookies <path_to_cookies.txt>]",
  );
  process.exit(1);
}

function hasCommand(commandName) {
  const result = spawnSync("which", [commandName], { encoding: "utf8" });
  return result.status === 0 && result.stdout?.trim();
}

const requiredCommands = ["ffmpeg", "yt-dlp"];
const missingCommands = requiredCommands.filter((cmd) => !hasCommand(cmd));

if (missingCommands.length > 0) {
  console.error(`Missing required commands: ${missingCommands.join(", ")}`);
  process.exit(1);
}

function runCommand(commandName, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(commandName, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => reject(error));
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

function toSnakeCaseFilePath(filePath) {
  const { dir, name, ext } = parse(filePath);
  const snakeCaseName = name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "");
  const newFilePath = join(dir, `${snakeCaseName}${ext}`);

  if (filePath !== newFilePath && existsSync(filePath)) {
    renameSync(filePath, newFilePath);
  }
  return newFilePath;
}

async function runYtDlp(downloadUrl) {
  // Download best mp4 video and best m4a audio and merge
  const args = [
    "-f",
    "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
    "-o",
    `${outputDir}/%(title)s.%(ext)s`,
    "--write-thumbnail",
    "--convert-thumbnails",
    "jpg",
    "--print",
    "after_move:filepath",
    "--no-progress",
  ];

  if (cookiesValue) {
    args.push("--cookies", cookiesValue);
  }

  args.push(downloadUrl);

  const result = await runCommand("yt-dlp", args);

  if (result.code !== 0) {
    throw new Error(
      result.stderr?.trim() || result.stdout?.trim() || "yt-dlp failed.",
    );
  }

  const lines = result.stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const filePath =
    lines.find(
      (l) =>
        l.endsWith(".mp4") ||
        l.endsWith(".mkv") ||
        l.endsWith(".webm") ||
        l.endsWith(".mov"),
    ) || lines[lines.length - 1];

  if (!filePath || !existsSync(filePath)) {
    throw new Error("Could not determine file path from yt-dlp output.");
  }

  const { dir, name } = parse(filePath);
  let thumbPath = join(dir, `${name}.jpg`);

  return { filePath, thumbPath };
}

function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}

async function probeStreams(filePath) {
  const result = await runCommand("ffprobe", [
    "-v", "quiet",
    "-print_format", "json",
    "-show_streams",
    filePath,
  ]);
  if (result.code !== 0) throw new Error("ffprobe failed: " + result.stderr);
  const { streams } = JSON.parse(result.stdout);
  const videoStream = streams.find((s) => s.codec_type === "video");
  const w = videoStream?.width ?? 0;
  const h = videoStream?.height ?? 0;
  const g = w && h ? gcd(w, h) : 1;
  return {
    hasAudio: streams.some((s) => s.codec_type === "audio"),
    dar: `${w / g}/${h / g}`,
  };
}

async function generateVideoDashManifest(filePath) {
  const { name } = parse(filePath);
  const dashDir = join(outputDir, "dash", name);
  const manifestPath = join(dashDir, "manifest.mpd");

  mkdirSync(dashDir, { recursive: true });

  const { hasAudio, dar } = await probeStreams(filePath);

  const args = [
    "-y",
    "-i", filePath,
    "-map", "0:v:0",
    "-map", "0:v:0",
    "-map", "0:v:0",
    ...(hasAudio ? ["-map", "0:a:0"] : []),

    // 1080p — setdar normalises rounded pixel dims to the same display AR across streams
    "-filter:v:0", `scale=-2:1080,setdar=${dar}`,
    "-c:v:0", "libx264",
    "-b:v:0", "3000k",
    "-profile:v:0", "main",

    // 720p
    "-filter:v:1", `scale=-2:720,setdar=${dar}`,
    "-c:v:1", "libx264",
    "-b:v:1", "1500k",
    "-profile:v:1", "main",

    // 480p
    "-filter:v:2", `scale=-2:480,setdar=${dar}`,
    "-c:v:2", "libx264",
    "-b:v:2", "800k",
    "-profile:v:2", "main",

    ...(hasAudio ? ["-c:a", "aac", "-b:a", "128k"] : []),

    // DASH options
    "-f", "dash",
    "-seg_duration", "4",
    "-use_template", "1",
    "-use_timeline", "1",
    "-init_seg_name", "init-$RepresentationID$.m4s",
    "-media_seg_name", "chunk-$RepresentationID$-$Number%05d$.m4s",
    "-adaptation_sets", hasAudio ? "id=0,streams=v id=1,streams=a" : "id=0,streams=v",
    manifestPath,
  ];

  const result = await runCommand("ffmpeg", args);

  if (result.code !== 0) {
    throw new Error(result.stderr?.trim() || "ffmpeg DASH generation failed.");
  }

  return manifestPath;
}

const isUrl =
  urlOrPath.startsWith("http://") || urlOrPath.startsWith("https://");
mkdirSync(outputDir, { recursive: true });

const tasks = new Listr(
  [
    {
      title: `Processing ${urlOrPath}`,
      task: async (ctx, task) => {
        let sourceFile = urlOrPath;

        return new Listr(
          [
            {
              title: "Download video",
              skip: () => !isUrl,
              task: async () => {
                const { filePath, thumbPath } = await runYtDlp(urlOrPath);
                sourceFile = toSnakeCaseFilePath(filePath);
                if (thumbPath && existsSync(thumbPath)) {
                  toSnakeCaseFilePath(thumbPath);
                }
              },
            },
            {
              title: "Format path",
              skip: () => isUrl,
              task: async () => {
                if (!existsSync(sourceFile)) {
                  const match = [".mp4", ".mkv", ".webm", ".mov"].map(ext => sourceFile + ext).find(existsSync);
                  if (!match) throw new Error(`File not found: ${sourceFile}`);
                  sourceFile = match;
                }
                sourceFile = toSnakeCaseFilePath(sourceFile);
              },
            },
            {
              title: "Transcode for editing",
              skip: () => !isUrl,
              task: async () => {
                const { dir, name, ext } = parse(sourceFile);
                const editPath = join(dir, `${name}_edit${ext}`);
                const result = await runCommand("ffmpeg", [
                  "-y",
                  "-i", sourceFile,
                  "-c:v", "libx264",
                  "-profile:v", "high",
                  "-level", "4.0",
                  "-pix_fmt", "yuv420p",
                  "-c:a", "aac",
                  "-b:a", "192k",
                  "-movflags", "+faststart",
                  editPath,
                ]);
                if (result.code !== 0)
                  throw new Error(result.stderr?.trim() || "ffmpeg transcode failed.");
                sourceFile = editPath;
              },
            },
            {
              title: "Generate DASH manifest",
              task: async (ctx, task) => {
                const manifestPath =
                  await generateVideoDashManifest(sourceFile);
                task.output = `Manifest: ${manifestPath}`;
              },
              options: { persistentOutput: true },
            },
          ],
          { concurrent: false },
        );
      },
    },
  ],
  { exitOnError: true },
);

tasks.run().catch((err) => {
  console.error(err);
  process.exit(1);
});
