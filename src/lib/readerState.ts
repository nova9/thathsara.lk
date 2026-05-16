// Per-reader state, kept in localStorage.
//
//   reader:read       — post ids the reader has scrolled to the bottom of
//   reader:unlocked   — set once the reader has read every visible post
//                       (drives the colophon glyph + nav banner)

export const READ_KEY = "reader:read";
export const UNLOCKED_KEY = "reader:unlocked";

export function getRead(): string[] {
  return JSON.parse(localStorage.getItem(READ_KEY) || "[]");
}

export function addRead(id: string) {
  const read = getRead();
  if (!read.includes(id)) {
    read.push(id);
    localStorage.setItem(READ_KEY, JSON.stringify(read));
  }
}

export function isUnlocked(): boolean {
  return !!localStorage.getItem(UNLOCKED_KEY);
}

export function setUnlocked() {
  localStorage.setItem(UNLOCKED_KEY, "1");
}

export function clearUnlocked() {
  localStorage.removeItem(UNLOCKED_KEY);
}

export function hasReadAll(allPostIds: string[]): boolean {
  const read = getRead();
  return allPostIds.every((id) => read.includes(id));
}
