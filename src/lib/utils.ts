import { getCollection } from "astro:content";
import type { CollectionEntry } from "astro:content";

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
  return `${content?.slice(0, 300) || ""}${(content?.length ?? 0) > 300 ? "..." : ""}`;
}

export async function getVisiblePosts(): Promise<CollectionEntry<"posts">[]> {
  return getCollection(
    "posts",
    ({ data }: CollectionEntry<"posts">) => data.draft !== true,
  );
}

export async function getAllPosts(): Promise<CollectionEntry<"posts">[]> {
  const getSortDate = (post: CollectionEntry<"posts">) =>
    post.data.updatedDate ?? post.data.date;

  return (await getVisiblePosts())
    .sort((a, b) => {
      if (a.data.featured && !b.data.featured) return -1;
      if (!a.data.featured && b.data.featured) return 1;
      return getSortDate(b).valueOf() - getSortDate(a).valueOf();
    })
    .slice(0, 10);
}
