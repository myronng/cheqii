/**
 * UUIDv7 — time-ordered UUID. The first 48 bits are a Unix-millisecond timestamp,
 * so lexicographic (and binary) ordering matches creation order. We use it for
 * mutation ids (see docs/sync-engine-spec.md §1) to get a stable, sortable
 * secondary key alongside the HLC. Passes the generic RFC-4122 UUID validator.
 */
export function uuidv7(now: number = Date.now()): string {
  const bytes = new Uint8Array(16);

  // 48-bit big-endian millisecond timestamp.
  bytes[0] = Math.floor(now / 2 ** 40) & 0xff;
  bytes[1] = Math.floor(now / 2 ** 32) & 0xff;
  bytes[2] = Math.floor(now / 2 ** 24) & 0xff;
  bytes[3] = Math.floor(now / 2 ** 16) & 0xff;
  bytes[4] = Math.floor(now / 2 ** 8) & 0xff;
  bytes[5] = now & 0xff;

  // 74 random bits fill the remainder.
  crypto.getRandomValues(bytes.subarray(6));

  // Version 7 (high nibble of byte 6) and RFC-4122 variant (top two bits of byte 8).
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
