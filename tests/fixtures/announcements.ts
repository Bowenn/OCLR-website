export const announcements = [
  {
    slug: "synthetic-announcement",
    title: "Synthetic test announcement",
    summary: "Isolated browser content fixture; not an OCLR announcement.",
    published: true,
    publishedAt: "2020-01-01T00:00:00Z",
    sections: [
      {
        heading: "Synthetic fixture section",
        body: "Plain text is escaped, including <script> markers. This is test content only.",
      },
    ],
  },
  {
    slug: "private-announcement",
    title: "Hidden editorial fixture",
    summary: "Must remain private.",
    published: false,
    publishedAt: null,
    sections: [{ heading: "Private", body: "Unapproved editorial content." }],
  },
];
