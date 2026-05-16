import { spawn, spawnSync } from "child_process";
import { existsSync, mkdirSync, renameSync } from "fs";
import { resolve, parse, join } from "path";
import { Listr } from "listr2";

const rawArgs = process.argv.slice(2);
const url = rawArgs.find((arg) => !arg.startsWith("--"));
const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
const outputDir = resolve("public/music");
const archivePath = resolve("public/music/downloaded.txt");

const urlQueue = [
  "https://www.youtube.com/watch?v=YAD6ialG6Bs", // Fairytale
  "https://www.youtube.com/watch?v=Zq5WfR4K3zA", // halo 4 legacy
  "https://www.youtube.com/watch?v=FSVHx23ByhM", // ezio's family
  "https://www.youtube.com/watch?v=PRxnQlgB4DI", // ezio and caterina
  "https://www.youtube.com/watch?v=pQI8SwUe7wM", // pobedna pesma
  "https://www.youtube.com/watch?v=_VONMkKkdf4", // ludovico einaudi - experience
];

if (!url && urlQueue.length === 0) {
  console.error(
    "Usage: npm run ingest-music -- <youtube_url> (or add URLs to urlQueue)",
  );
  process.exit(1);
}

if (!apiKey) {
  console.error("Missing OPENAI_API_KEY in environment or .env file.");
  process.exit(1);
}

function hasCommand(commandName) {
  const result = spawnSync("which", [commandName], { encoding: "utf8" });
  return result.status === 0 && result.stdout?.trim();
}

const requiredCommands = ["ffmpeg", "kid3-cli", "yt-dlp"];
const missingCommands = requiredCommands.filter(
  (commandName) => !hasCommand(commandName),
);

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

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

async function runYtDlp(downloadUrl) {
  const args = [
    "-x",
    "--audio-format",
    "opus",
    "--audio-quality",
    "0",
    "--embed-metadata",
    "--embed-thumbnail",
    "-o",
    `${outputDir}/%(title)s.%(ext)s`,
    "--print",
    "title",
    "--print",
    "after_move:filepath",
    "--no-progress",
    "--download-archive",
    archivePath,
    downloadUrl,
  ];

  const result = await runCommand("yt-dlp", args);

  if (result.code !== 0) {
    const stderr = result.stderr?.trim();
    const stdout = result.stdout?.trim();
    let message = "yt-dlp failed.";

    if (stderr) {
      message = stderr;
    } else if (stdout) {
      message = stdout;
    }

    throw new Error(message);
  }

  const lines = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const title = lines[0];
  const filePath = lines[lines.length - 1];

  if (!title || !filePath || !existsSync(filePath)) {
    throw new Error(
      "Could not determine title or file path from yt-dlp output.",
    );
  }

  return { title, filePath };
}

async function checkAlreadyDownloaded(downloadUrl) {
  const args = [
    "--simulate",
    "--skip-download",
    "--no-progress",
    "--download-archive",
    archivePath,
    downloadUrl,
  ];

  const result = await runCommand("yt-dlp", args);

  if (result.code !== 0) {
    const stderr = result.stderr?.trim();
    const stdout = result.stdout?.trim();
    let message = "yt-dlp simulate failed.";

    if (stderr) {
      message = stderr;
    } else if (stdout) {
      message = stdout;
    }

    throw new Error(message);
  }

  const output = `${result.stdout || ""}\n${result.stderr || ""}`;
  return /has already been recorded in the archive/i.test(output);
}

function toSnakeCaseFilePath(filePath) {
  const { dir, name, ext } = parse(filePath);
  const snakeCaseName = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const newFilePath = join(dir, `${snakeCaseName}${ext}`);

  if (filePath !== newFilePath) {
    renameSync(filePath, newFilePath);
  }

  return newFilePath;
}

async function inferMetadata(rawTitle) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "track_metadata",
          schema: {
            type: "object",
            properties: {
              title: { type: "string" },
              artist: { type: "string" },
            },
            required: ["title", "artist"],
            additionalProperties: false,
          },
        },
      },
      messages: [
        {
          role: "system",
          content:
            "You infer clean music metadata. Given a YouTube track title, return best-guess artist and title. Remove extra info like (Official Video), [Lyrics], or resolution tags.",
        },
        {
          role: "user",
          content: rawTitle,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error("OpenAI response was empty.");
  }

  const parsed = JSON.parse(content);

  if (!parsed.title || !parsed.artist) {
    throw new Error("OpenAI response missing title or artist.");
  }

  return { title: parsed.title, artist: parsed.artist };
}

function escapeKid3Value(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function applyTagsWithKid3(filePath, title, artist) {
  const safeTitle = escapeKid3Value(title);
  const safeArtist = escapeKid3Value(artist);
  const args = [
    "-c",
    `set title \"${safeTitle}\"`,
    "-c",
    `set artist \"${safeArtist}\"`,
    filePath,
  ];

  const result = await runCommand("kid3-cli", args);

  if (result.code !== 0) {
    const stderr = result.stderr?.trim();
    throw new Error(stderr || "kid3-cli failed.");
  }
}

async function generateDashManifest(filePath) {
  const { name } = parse(filePath);
  const dashDir = join(outputDir, "dash", name);
  const manifestPath = join(dashDir, "manifest.mpd");

  mkdirSync(dashDir, { recursive: true });

  const args = ["-y", "-i", filePath];
  const addArgs = (group) => args.push(...group.split(" "));

  // Map the audio stream 4 times
  args.push("-map", "0:a", "-map", "0:a", "-map", "0:a", "-map", "0:a");

  // Set codecs and bitrates for each mapped stream
  addArgs("-c:a:0 libopus -b:a:0 32k");
  addArgs("-c:a:1 libopus -b:a:1 64k");
  addArgs("-c:a:2 libopus -b:a:2 128k");
  addArgs("-c:a:3 libopus -b:a:3 256k");

  // Group them into one AdaptationSet (id=0 contains streams 0, 1, 2, and 3)
  addArgs("-f dash -seg_duration 4 -adaptation_sets id=0,streams=v,a");
  args.push(manifestPath);

  const result = await runCommand("ffmpeg", args);

  if (result.code !== 0) {
    const stderr = result.stderr?.trim();
    throw new Error(stderr || "ffmpeg DASH generation failed.");
  }

  return manifestPath;
}

try {
  const targets = url ? [url] : urlQueue;
  const tasks = new Listr(
    targets.map((targetUrl) => ({
      title: `Processing ${targetUrl}`,
      task: async () => {
        let rawTitle = "";
        let snakeCasePath = "";
        let title = "";
        let artist = "";
        let alreadyDownloaded = false;

        return new Listr(
          [
            {
              title: "Check archive",
              task: async (ctx, task) => {
                alreadyDownloaded = await checkAlreadyDownloaded(targetUrl);

                if (alreadyDownloaded) {
                  task.output = "Already downloaded. Skipping.";
                }
              },
              options: { persistentOutput: true },
            },
            {
              title: "Download audio",
              task: async (ctx, task) => {
                if (alreadyDownloaded) {
                  task.skip(
                    `${task.title}: Already downloaded. Skipping download.`,
                  );
                  return;
                }

                const result = await runYtDlp(targetUrl);
                rawTitle = result.title;
                snakeCasePath = toSnakeCaseFilePath(result.filePath);
              },
            },
            {
              title: "Infer metadata",
              task: async (ctx, task) => {
                if (alreadyDownloaded) {
                  task.skip(
                    `${task.title}: Already downloaded. Skipping metadata inference.`,
                  );
                  return;
                }

                const metadata = await inferMetadata(rawTitle);
                title = metadata.title;
                artist = metadata.artist;
                task.output = `YouTube: ${rawTitle} -> ${title} / ${artist}`;
              },
              options: { persistentOutput: true },
            },
            {
              title: "Apply tags",
              task: async (ctx, task) => {
                if (alreadyDownloaded) {
                  task.skip(
                    `${task.title}: Already downloaded. Skipping tag application.`,
                  );
                  return;
                }

                await applyTagsWithKid3(snakeCasePath, title, artist);
              },
            },
            {
              title: "Generate DASH manifest",
              task: async (ctx, task) => {
                if (alreadyDownloaded) {
                  task.skip(
                    `${task.title}: Already downloaded. Skipping DASH generation.`,
                  );
                  return;
                }

                const manifestPath = await generateDashManifest(snakeCasePath);
                task.output = `Manifest: ${manifestPath}`;
              },
              options: { persistentOutput: true },
            },
            {
              title: "Finalize",
              task: async (ctx, task) => {
                if (alreadyDownloaded) {
                  task.skip(
                    `${task.title}: Already downloaded. Skipping finalization.`,
                  );
                  return;
                }

                task.output = `Saved: ${snakeCasePath}`;
              },
              options: { persistentOutput: true },
            },
          ],
          {
            concurrent: false,
            renderer: "verbose",
          },
        );
      },
    })),
    {
      concurrent: true,
      exitOnError: true,
      renderer: "verbose",
      rendererOptions: {
        showTimer: true,
        clearOutput: false,
        collapseSubtasks: false,
      },
    },
  );

  await tasks.run();
} catch (error) {
  console.error(error?.message || error);
  process.exit(1);
}
