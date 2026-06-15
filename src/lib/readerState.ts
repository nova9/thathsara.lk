// Per-reader state, built on the same reactive store as everything else.
//
//   readPosts  (reader:read)     — post ids the reader has scrolled to the bottom of
//   unlocked   (reader:unlocked) — set once every visible post has been read
//                                  (drives the colophon glyph + nav banner)

import { persisted } from "./store";

export const readPosts = persisted<string[]>("reader:read", []);

// Legacy format: "1" when unlocked, absent/"" otherwise.
export const unlocked = persisted(
  "reader:unlocked",
  false,
  (raw) => raw === "1",
  (value) => (value ? "1" : ""),
);

export function addRead(id: string) {
  const read = readPosts.get();
  if (!read.includes(id)) readPosts.set([...read, id]);
}

export function hasReadAll(allPostIds: string[]): boolean {
  const read = readPosts.get();
  return allPostIds.every((id) => read.includes(id));
}
