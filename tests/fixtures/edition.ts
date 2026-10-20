import type { Edition } from "../../src/lib/editions";
// Synthetic only; never imported by application code.
export const edition: Edition = {
  slug: "test-cup",
  season: null,
  branding: { logo: null, background: null, keyVisual: null },
  name: "Synthetic test edition",
  published: true,
  status: "upcoming",
  summary: "Isolated automated test fixture.",
  timeZone: "Asia/Taipei",
  rules: {
    version: "test-v1",
    sections: [
      {
        heading: "Test rules",
        body: "Synthetic rules for automated testing only.",
      },
    ],
  },
  eligibility: "Synthetic test policy; not OCLR eligibility rules.",
  registration: {
    enabled: true,
    opensAt: "2025-01-01T00:00:00Z",
    closesAt: "2099-01-01T00:00:00Z",
    withdrawUntil: "2099-01-01T00:00:00Z",
    questions: [],
  },
  schedule: [{ label: "Synthetic draft", at: null }],
};
