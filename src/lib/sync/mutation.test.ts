import { describe, expect, it } from "vitest";
import { HLCClock } from "./clock";
import { createMutation } from "./mutation";

const CHEQUE = "00000000-0000-4000-8000-000000000001";
const USER = "00000000-0000-4000-8000-000000000002";
const ITEM = "00000000-0000-4000-8000-000000000003";

function clock() {
  return new HLCClock("test", { now: () => 1000 });
}

describe("createMutation", () => {
  it("stamps a UUIDv7 id and an HLC, and echoes type/scope/author", () => {
    const m = createMutation(clock(), "UPDATE_ITEM", CHEQUE, USER, { id: ITEM, name: "Coffee" });
    expect(m.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(m.hlc.length).toBeGreaterThan(0);
    expect(m.type).toBe("UPDATE_ITEM");
    expect(m.entity_id).toBe(CHEQUE);
    expect(m.user_id).toBe(USER);
    expect(m.payload).toEqual({ id: ITEM, name: "Coffee" });
  });

  it("advances the clock so two mutations are ordered", () => {
    const c = clock();
    const a = createMutation(c, "UPDATE_ITEM", CHEQUE, USER, { id: ITEM, name: "A" });
    const b = createMutation(c, "UPDATE_ITEM", CHEQUE, USER, { id: ITEM, name: "B" });
    expect(a.hlc < b.hlc).toBe(true);
  });

  it("throws on an invalid payload before anything is persisted", () => {
    // cost must be a non-negative integer in minor units
    expect(() =>
      createMutation(clock(), "UPDATE_ITEM", CHEQUE, USER, { id: ITEM, cost: -5 }),
    ).toThrow();
  });

  it("throws when a required key is missing", () => {
    expect(() => createMutation(clock(), "UPDATE_ITEM", CHEQUE, USER, { name: "no id" })).toThrow();
  });

  it("rejects an UPDATE with no fields to change", () => {
    expect(() => createMutation(clock(), "UPDATE_CHEQUE", CHEQUE, USER, {})).toThrow();
  });

  it("throws on a non-UUID entity_id (envelope validation, not just payload)", () => {
    // The migrated-cheque bug: an md5-derived id is not a valid RFC-4122 UUID, so
    // the server rejects the envelope before dispatch. Fail here instead, at the
    // write site, so it never enters the outbox.
    const badId = "3e749306-74a6-7c0b-471e-1a4ac044b78f"; // invalid version+variant nibbles
    expect(() =>
      createMutation(clock(), "UPDATE_ITEM", badId, USER, { id: ITEM, name: "Coffee" }),
    ).toThrow();
  });

  it("throws on a non-UUID user_id", () => {
    expect(() =>
      createMutation(clock(), "UPDATE_ITEM", CHEQUE, "not-a-uuid", { id: ITEM, name: "Coffee" }),
    ).toThrow();
  });
});
