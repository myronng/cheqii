import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type EngineStore, type LogRow, SyncEngine } from "./engine.svelte";
import type { Mutation } from "./mutations";

const CHEQUE = "00000000-0000-4000-8000-000000000001";
const USER = "00000000-0000-4000-8000-000000000002";
const OTHER = "00000000-0000-4000-8000-000000000003";

const hlc = (n: number) => `${String(n).padStart(15, "0")}:00000:dev`;

function mut(id: string, over: Partial<Mutation> = {}): Mutation {
  return {
    id,
    type: "UPDATE_CHEQUE",
    entity_id: CHEQUE,
    user_id: USER,
    hlc: hlc(1),
    payload: { name: id },
    ...over,
  } as Mutation;
}

function logRow(id: string, seq: number, over: Partial<LogRow> = {}): LogRow {
  return {
    id,
    type: "UPDATE_CHEQUE",
    entity_id: CHEQUE,
    user_id: OTHER,
    hlc: hlc(seq),
    payload: { name: id },
    seq_id: seq,
    ...over,
  };
}

function okResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}

interface HarnessOpts {
  outbox?: Mutation[];
  cursors?: Record<string, number>;
  fetchFn: typeof fetch;
  getUserId?: () => string | undefined;
}

function harness(opts: HarnessOpts) {
  const outbox = (opts.outbox ?? []).slice();
  const cursors = { ...opts.cursors };
  const store: EngineStore = {
    loadOutbox: vi.fn(async () => outbox.slice()),
    clearOutbox: vi.fn(async (ids: string[]) => {
      for (const id of ids) {
        const i = outbox.findIndex((m) => m.id === id);
        if (i >= 0) outbox.splice(i, 1);
      }
    }),
    getCursors: vi.fn(async () => ({ ...cursors })),
    setCursor: vi.fn(async (e: string, s: number) => {
      cursors[e] = s;
    }),
  };
  const clock = { receive: vi.fn() };
  const onIncoming = vi.fn(async () => {});
  const engine = new SyncEngine({
    db: store,
    clock,
    getUserId: opts.getUserId ?? (() => USER),
    // active entities = whatever cursors the test seeded (preserves prior behavior)
    getActiveEntityIds: () => Object.keys(cursors),
    onIncoming,
    fetchFn: opts.fetchFn,
  });
  return { engine, store, clock, onIncoming, cursors };
}

function body(fetchFn: ReturnType<typeof vi.fn>, call = 0) {
  const calls = fetchFn.mock.calls as unknown as unknown[][];
  const init = calls[call][1] as RequestInit;
  return JSON.parse(init.body as string);
}

describe("SyncEngine", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("pushes the user's pending mutations in HLC order, then clears them", async () => {
    const fetchFn = vi.fn(async () =>
      okResponse({ processedIds: ["a", "b"], newMutations: [], cursors: { [CHEQUE]: 5 } }),
    );
    const { engine, store } = harness({
      outbox: [mut("a", { hlc: hlc(2) }), mut("b", { hlc: hlc(1) })],
      fetchFn,
    });
    await engine.ready;
    await vi.advanceTimersByTimeAsync(1);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(body(fetchFn).mutations.map((m: Mutation) => m.id)).toEqual(["b", "a"]); // HLC asc
    expect(engine.pendingCount).toBe(0);
    expect(store.clearOutbox).toHaveBeenCalledWith(["a", "b"]);
    expect(store.setCursor).toHaveBeenCalledWith(CHEQUE, 5);
  });

  it("applies incoming peer mutations and feeds their HLCs to the clock", async () => {
    const incoming = [logRow("x", 4), logRow("y", 5)];
    const fetchFn = vi.fn(async () =>
      okResponse({ processedIds: [], newMutations: incoming, cursors: { [CHEQUE]: 5 } }),
    );
    const { engine, onIncoming, clock } = harness({ cursors: { [CHEQUE]: 0 }, fetchFn });
    await engine.ready;
    await vi.advanceTimersByTimeAsync(1);

    expect(onIncoming).toHaveBeenCalledTimes(1);
    const applied = (onIncoming.mock.calls[0] as unknown as [LogRow[]])[0];
    expect(applied.map((r) => r.id)).toEqual(["x", "y"]);
    expect(clock.receive).toHaveBeenCalledTimes(2);
  });

  it("never re-applies the caller's own just-acked mutations", async () => {
    const fetchFn = vi.fn(async () =>
      okResponse({
        processedIds: ["a"],
        newMutations: [logRow("a", 9, { user_id: USER })], // echo of our own push
        cursors: { [CHEQUE]: 9 },
      }),
    );
    const { engine, onIncoming } = harness({ outbox: [mut("a")], fetchFn });
    await engine.ready;
    await vi.advanceTimersByTimeAsync(1);
    expect(onIncoming).not.toHaveBeenCalled();
  });

  it("only pushes mutations authored by the current user", async () => {
    const fetchFn = vi.fn(async () =>
      okResponse({ processedIds: [], newMutations: [], cursors: {} }),
    );
    const { engine } = harness({
      outbox: [mut("mine"), mut("theirs", { user_id: OTHER })],
      fetchFn,
    });
    await engine.ready;
    await vi.advanceTimersByTimeAsync(1);
    expect(body(fetchFn).mutations.map((m: Mutation) => m.id)).toEqual(["mine"]);
  });

  it("pulls even with an empty outbox (outbox-independent liveness)", async () => {
    const fetchFn = vi.fn(async () =>
      okResponse({ processedIds: [], newMutations: [logRow("z", 2)], cursors: { [CHEQUE]: 2 } }),
    );
    const { engine, onIncoming } = harness({ cursors: { [CHEQUE]: 1 }, fetchFn });
    await engine.ready;
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(body(fetchFn).mutations).toEqual([]);
    expect(onIncoming).toHaveBeenCalledTimes(1);
  });

  it("retries with backoff after a failed round, then recovers", async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValue(okResponse({ processedIds: ["a"], newMutations: [], cursors: {} }));
    const { engine } = harness({ outbox: [mut("a")], fetchFn });
    await engine.ready;
    await vi.advanceTimersByTimeAsync(1); // first attempt → rejects
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(engine.pendingCount).toBe(1); // left in outbox

    await vi.advanceTimersByTimeAsync(3000); // backoff (~2s + jitter) elapses → retry
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(engine.pendingCount).toBe(0);
  });

  it("is single-flight: triggers during an in-flight round coalesce into one rerun", async () => {
    let release!: () => void;
    const fetchFn = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          release = () => resolve(okResponse({ processedIds: [], newMutations: [], cursors: {} }));
        }),
    );
    const { engine } = harness({ cursors: { [CHEQUE]: 0 }, fetchFn });
    await engine.ready;
    await vi.advanceTimersByTimeAsync(1); // first round in-flight (fetch pending)
    expect(fetchFn).toHaveBeenCalledTimes(1);

    engine.pull();
    engine.pull(); // both arrive mid-flight → at most one rerun
    expect(fetchFn).toHaveBeenCalledTimes(1);

    release();
    await vi.advanceTimersByTimeAsync(1); // finish round 1, fire the single rerun
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
