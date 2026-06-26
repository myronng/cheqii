import { describe, expect, it } from "vitest";
import { format, minorUnitDigits, parse, scale } from "./money";

describe("minorUnitDigits / scale", () => {
  it("returns 2 for typical currencies", () => {
    expect(minorUnitDigits("USD")).toBe(2);
    expect(minorUnitDigits("CAD")).toBe(2);
    expect(scale("USD")).toBe(100);
  });
  it("returns 0 for JPY (no minor unit)", () => {
    expect(minorUnitDigits("JPY")).toBe(0);
    expect(scale("JPY")).toBe(1);
  });
  it("returns 3 for KWD", () => {
    expect(minorUnitDigits("KWD")).toBe(3);
    expect(scale("KWD")).toBe(1000);
  });
  it("is case-insensitive and falls back to 2 for unknown codes", () => {
    expect(minorUnitDigits("usd")).toBe(2);
    expect(minorUnitDigits("ZZZ")).toBe(2);
  });
});

describe("format", () => {
  it("formats cents as major-unit currency", () => {
    expect(format(1234, "USD", "en-US")).toBe("$12.34");
  });
  it("formats JPY with no decimals", () => {
    expect(format(1234, "JPY", "en-US")).toBe("¥1,234");
  });
});

describe("parse", () => {
  it("parses a major-unit string to minor units", () => {
    expect(parse("12.34", "USD")).toBe(1234);
    expect(parse("0.05", "USD")).toBe(5);
    expect(parse("12", "JPY")).toBe(12);
  });
  it("rounds to the nearest minor unit (no fractional cents)", () => {
    expect(parse("12.345", "USD")).toBe(1235);
    expect(parse("12.344", "USD")).toBe(1234);
  });
  it("strips currency symbols and grouping", () => {
    expect(parse("$1,234.50", "USD")).toBe(123450);
  });
  it("returns null for non-numeric input", () => {
    expect(parse("", "USD")).toBeNull();
    expect(parse("abc", "USD")).toBeNull();
    expect(parse(".", "USD")).toBeNull();
  });
});
