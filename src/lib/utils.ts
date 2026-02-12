import { getCollection } from "astro:content";

function normalizeDate(value: string | Date | undefined): Date {
  if (!value) {
    return new Date(0);
  }

  if (value instanceof Date) {
    return value;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date(0);
  }

  return parsed;
}

export function toDateLabel(value: string | Date | undefined): string {
  return normalizeDate(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function getSummary(content?: string): string {
  return `${content?.slice(0, 300) || ""}${(content?.length ?? 0) > 200 ? "..." : ""}`;
}

export async function getVisiblePosts() {
  return await getCollection("posts", ({ data }) => data.draft !== true);
}
