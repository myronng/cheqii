import { describe, expect, it } from "vitest";
import { HLCClock } from "./clock";
import { createMutation } from "./mutation";

const BILL = "00000000-0000-4000-8000-000000000001";
const USER = "00000000-0000-4000-8000-000000000002";
const ITEM = "00000000-0000-4000-8000-000000000003";

function clock() {
  return new HLCClock("test", { now: () => 1000 });
}

describe("createMutation", () => {
  it("stamps a UUIDv7 id and an HLC, and echoes type/scope/author", () => {
    const m = createMutation(clock(), "UPDATE_ITEM", BILL, USER, { id: ITEM, name: "Coffee" });
    expect(m.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(m.hlc.length).toBeGreaterThan(0);
    expect(m.type).toBe("UPDATE_ITEM");
    expect(m.entity_id).toBe(BILL);
    expect(m.user_id).toBe(USER);
    expect(m.payload).toEqual({ id: ITEM, name: "Coffee" });
  });

  it("advances the clock so two mutations are ordered", () => {
    const c = clock();
    const a = createMutation(c, "UPDATE_ITEM", BILL, USER, { id: ITEM, name: "A" });
    const b = createMutation(c, "UPDATE_ITEM", BILL, USER, { id: ITEM, name: "B" });
    expect(a.hlc < b.hlc).toBe(true);
  });

  it("throws on an invalid payload before anything is persisted", () => {
    // cost must be a non-negative integer in minor units
    expect(() =>
      createMutation(clock(), "UPDATE_ITEM", BILL, USER, { id: ITEM, cost: -5 }),
    ).toThrow();
  });

  it("throws when a required key is missing", () => {
    expect(() => createMutation(clock(), "UPDATE_ITEM", BILL, USER, { name: "no id" })).toThrow();
  });

  it("rejects an UPDATE with no fields to change", () => {
    expect(() => createMutation(clock(), "UPDATE_BILL", BILL, USER, {})).toThrow();
  });
});
