import fs from "node:fs";
import path from "node:path";
import * as mm from "music-metadata";

export type Track = {
  url: string;
  manifestUrl: string | null;
  title: string;
  artist: string;
};

const AUDIO_EXTENSIONS = [".mp3", ".webm", ".opus"];

export async function getMusicTracks(): Promise<Track[]> {
  const musicDir = path.join(process.cwd(), "public", "music");
  const dashDir = path.join(musicDir, "dash");

  if (!fs.existsSync(musicDir)) return [];

  const audioFiles = fs
    .readdirSync(musicDir)
    .filter((f) => AUDIO_EXTENSIONS.some((ext) => f.endsWith(ext)));

  return Promise.all(
    audioFiles.map(async (f) => {
      const filePath = path.join(musicDir, f);
      const fileName = f.replace(/\.[^/.]+$/, "");
      const manifestPath = path.join(dashDir, fileName, "manifest.mpd");
      const metadata = await mm.parseFile(filePath, { skipCovers: true });
      return {
        url: `/music/${f}`,
        manifestUrl: fs.existsSync(manifestPath)
          ? `/music/dash/${fileName}/manifest.mpd`
          : null,
        title: metadata.common.title || fileName,
        artist: metadata.common.artist || "Unknown Artist",
      };
    }),
  );
}
