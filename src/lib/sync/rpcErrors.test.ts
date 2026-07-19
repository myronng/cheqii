import { describe, expect, it } from "vitest";
import { isPermanentSyncError } from "./rpcErrors";

describe("isPermanentSyncError", () => {
  it("treats RPC guard exceptions (raise exception → P0001) as permanent", () => {
    expect(isPermanentSyncError("P0001")).toBe(true);
  });

  it("treats data exceptions (22*) as permanent", () => {
    expect(isPermanentSyncError("22P02")).toBe(true); // invalid uuid/enum cast
    expect(isPermanentSyncError("22001")).toBe(true); // value too long
  });

  it("treats integrity violations (23*) as permanent", () => {
    expect(isPermanentSyncError("23503")).toBe(true); // FK violation
    expect(isPermanentSyncError("23505")).toBe(true); // unique violation
    expect(isPermanentSyncError("23514")).toBe(true); // check violation
  });

  it("treats insufficient_privilege as permanent", () => {
    expect(isPermanentSyncError("42501")).toBe(true);
  });

  it("treats concurrency, timeout, resource, and connection errors as transient", () => {
    expect(isPermanentSyncError("40001")).toBe(false); // serialization failure
    expect(isPermanentSyncError("40P01")).toBe(false); // deadlock
    expect(isPermanentSyncError("57014")).toBe(false); // statement timeout
    expect(isPermanentSyncError("53300")).toBe(false); // too many connections
    expect(isPermanentSyncError("08006")).toBe(false); // connection failure
  });

  it("treats PostgREST schema-cache misses as transient (migration reload window)", () => {
    expect(isPermanentSyncError("PGRST202")).toBe(false);
  });

  it("defaults unknown or missing codes to transient (never silently drop)", () => {
    expect(isPermanentSyncError("XX000")).toBe(false);
    expect(isPermanentSyncError("")).toBe(false);
    expect(isPermanentSyncError(null)).toBe(false);
    expect(isPermanentSyncError(undefined)).toBe(false);
  });
});
