/** Bounded negative cache: only SHA-256 fingerprints of rejected credentials. */
export class DeveloperTokenMisses {
  constructor(private entries = new Map<string, number>()) {}
  has(fingerprint: string, now = Date.now()) {
    const until = this.entries.get(fingerprint);
    if (until !== undefined && until > now) return true;
    this.entries.delete(fingerprint);
    return false;
  }
  remember(fingerprint: string, now = Date.now()) {
    for (const [key, until] of this.entries)
      if (until <= now) this.entries.delete(key);
    if (this.entries.size >= 4096)
      this.entries.delete(this.entries.keys().next().value!);
    this.entries.set(fingerprint, now + 60_000);
  }
}
const state = globalThis as typeof globalThis & {
  oclrDeveloperTokenMisses?: Map<string, number>;
};
export const developerTokenMisses = new DeveloperTokenMisses(
  (state.oclrDeveloperTokenMisses ??= new Map()),
);
