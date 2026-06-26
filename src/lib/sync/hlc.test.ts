import { describe, expect, it } from "vitest";
import { compareHLC, decodeHLC, encodeHLC, initHLC, tickLocal, tickReceive } from "./hlc";

describe("HLC encode/decode", () => {
  it("round-trips state", () => {
    const s = { wall: 1_700_000_000_000, counter: 42, node: "device-a" };
    expect(decodeHLC(encodeHLC(s))).toEqual(s);
  });

  it("encodes to a lexicographically-comparable string (wall dominates counter)", () => {
    const earlier = encodeHLC({ wall: 10, counter: 999, node: "z" });
    const later = encodeHLC({ wall: 11, counter: 0, node: "a" });
    expect(earlier < later).toBe(true);
  });

  it("tolerates node ids defensively", () => {
    const s = { wall: 5, counter: 1, node: "weird" };
    expect(decodeHLC(encodeHLC(s)).node).toBe("weird");
  });
});

describe("tickLocal", () => {
  it("bumps the counter within the same wall millisecond", () => {
    const a = tickLocal(initHLC("n"), 1000);
    const b = tickLocal(a, 1000);
    expect(b.wall).toBe(1000);
    expect(b.counter).toBe(a.counter + 1);
  });

  it("resets the counter when the wall clock advances", () => {
    const a = tickLocal({ wall: 1000, counter: 5, node: "n" }, 1001);
    expect(a).toEqual({ wall: 1001, counter: 0, node: "n" });
  });

  it("never goes backwards when the physical clock is behind", () => {
    const a = tickLocal({ wall: 2000, counter: 0, node: "n" }, 1000);
    expect(a.wall).toBe(2000);
    expect(a.counter).toBe(1);
  });

  it("produces a strictly increasing sequence of encoded clocks", () => {
    let s = initHLC("n");
    let prev = encodeHLC(s);
    for (let i = 0; i < 100; i++) {
      s = tickLocal(s, 1000); // same ms — stress the counter
      const cur = encodeHLC(s);
      expect(compareHLC(cur, prev)).toBe(1);
      prev = cur;
    }
  });
});

describe("tickReceive", () => {
  it("orders a causally-later local write after a received remote one (clock skew)", () => {
    // Local device clock is 10 min behind; a remote write must still order before
    // the local write that observed it.
    const local = initHLC("local");
    const remote = encodeHLC({ wall: 2_000_000, counter: 0, node: "remote" });
    const afterReceive = tickReceive(local, decodeHLC(remote), 1_000_000 /* behind */);
    const localWrite = encodeHLC(tickLocal(afterReceive, 1_000_001));
    expect(compareHLC(localWrite, remote)).toBe(1);
  });

  it("takes max counter + 1 when walls tie", () => {
    const merged = tickReceive(
      { wall: 5000, counter: 3, node: "a" },
      { wall: 5000, counter: 7, node: "b" },
      5000,
    );
    expect(merged.wall).toBe(5000);
    expect(merged.counter).toBe(8);
    expect(merged.node).toBe("a"); // keeps local identity
  });
});
