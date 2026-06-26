import { describe, expect, it } from "vitest";
import { uuidv7 } from "./uuid";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("uuidv7", () => {
  it("matches the RFC-4122 v7 layout (version 7, variant 10xx)", () => {
    for (let i = 0; i < 50; i++) expect(uuidv7()).toMatch(UUID_RE);
  });

  it("is time-ordered: later timestamps sort lexicographically after earlier ones", () => {
    const early = uuidv7(1_000_000_000_000);
    const late = uuidv7(1_700_000_000_000);
    expect(early < late).toBe(true);
  });

  it("is unique within the same millisecond", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => uuidv7(1_700_000_000_000)));
    expect(ids.size).toBe(1000);
  });
});
