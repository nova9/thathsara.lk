// The antilibrary: books I own but have not read yet.
// The unread shelf is the more honest one. It measures what I don't know,
// and it should keep growing. See Taleb, on Umberto Eco's library.

export interface Book {
  title: string;
  author: string;
  /** A short subject label, used as a tag. */
  subject: string;
  /** ISO date the book entered the shelf. */
  acquired: string;
  /** Why it waits, or what draws me to it. The soul of the entry. */
  note: string;
}

export const antilibrary: Book[] = [
  {
    title: "Build a Large Language Model (From Scratch)",
    author: "Sebastian Raschka",
    subject: "Machine Learning",
    acquired: "2026-06-10",
    note: "Code a GPT from nothing but PyTorch. From scratch is my style.",
  },
];
