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
    title: "The Black Swan",
    author: "Nassim Nicholas Taleb",
    subject: "Uncertainty",
    acquired: "2024-03-12",
    note: "The book that named this shelf. Fitting that I have not finished it.",
  },
  {
    title: "Gödel, Escher, Bach",
    author: "Douglas Hofstadter",
    subject: "Cognition",
    acquired: "2024-07-02",
    note: "Everyone says it rewires how you think. I keep saving it for a quieter month that never arrives.",
  },
  {
    title: "The Brothers Karamazov",
    author: "Fyodor Dostoevsky",
    subject: "Fiction",
    acquired: "2023-11-20",
    note: "Bought after an argument about faith I lost. Still bracing myself for it.",
  },
  {
    title: "The Art of Computer Programming, Vol. 1",
    author: "Donald Knuth",
    subject: "Computing",
    acquired: "2025-01-08",
    note: "Aspiration more than plan. It sits there as a standing dare.",
  },
];
