import { describe, expect, it } from "vitest";
import { HLCClock } from "./clock";
import { compareHLC } from "./hlc";

describe("HLCClock", () => {
  it("emits strictly increasing HLCs even with a frozen physical clock", () => {
    const clock = new HLCClock("dev", { now: () => 1000 });
    let prev = clock.tick();
    for (let i = 0; i < 20; i++) {
      const next = clock.tick();
      expect(compareHLC(next, prev)).toBe(1);
      prev = next;
    }
  });

  it("peek does not advance the clock", () => {
    const clock = new HLCClock("dev", { now: () => 1000 });
    const a = clock.peek();
    const b = clock.peek();
    expect(a).toBe(b);
  });

  it("a local tick after receiving a future remote HLC orders after it", () => {
    const clock = new HLCClock("local", { now: () => 1000 });
    const remote = new HLCClock("remote", { now: () => 5000 }).tick();
    clock.receive(remote);
    expect(compareHLC(clock.tick(), remote)).toBe(1);
  });
});
