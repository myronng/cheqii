// =============================================================================
// Two-device convergence E2E (Phase 6). Manual run (needs the dev server, local
// Supabase with the Turnstile test secret, Playwright, and docker for the invite
// insert). Verifies: A creates a cheque, B joins via an editor invite, both edit,
// and A (idle) converges via Realtime liveness — exercising invite redemption +
// RLS + the sync engine end-to-end across two distinct users.
//   1) TURNSTILE_SECRET=1x0000000000000000000000000000000AA vp exec supabase start
//   2) vp dev   3) vp exec playwright install chromium (once)
//   4) node e2e/two-device-convergence.mjs   → expect "PASS: converged to 80.00"
// =============================================================================
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";

const browser = await chromium.launch();
const errors = [];
const log = (...a) => console.log(...a);

try {
  // ---- Device A: create a cheque, set item-1 cost = $50 ----
  const pageA = await (await browser.newContext()).newPage();
  pageA.on("pageerror", (e) => errors.push("A: " + e.message));
  // /new is the canonical "create a cheque" entry (the listing's tile + the empty
  // state both link here; there's no longer a header button).
  await pageA.goto("http://localhost:5173/new", { waitUntil: "load" });
  await pageA.waitForURL(/\/cheques\/[0-9a-f-]{36}/, { timeout: 25000 });
  const chequeId = pageA.url().split("/cheques/")[1];
  log("A created cheque", chequeId);

  const costA = pageA.locator('input[inputmode="decimal"]').first();
  await costA.fill("50");
  await costA.blur();
  await pageA.waitForTimeout(1000);
  log("A total after $50:", (await pageA.locator(".grand .value").first().textContent())?.trim());

  // ---- create an editor invite for the cheque (invite-mgmt UI is deferred) ----
  const inviteId = randomUUID();
  execSync(
    `docker exec supabase_db_cheqii psql -U postgres -d postgres -c ` +
      `"insert into invites (id, cheque_id, role) values ('${inviteId}','${chequeId}','editor');"`,
    { stdio: "ignore" },
  );
  log("editor invite created");

  // ---- Device B: join via invite (→ /auth chooser → guest → join → cheque) ----
  const pageB = await (await browser.newContext()).newPage();
  pageB.on("pageerror", (e) => errors.push("B: " + e.message));
  await pageB.goto(`http://localhost:5173/invite/${chequeId}#${inviteId}`, { waitUntil: "load" });
  // invite (signed out) → /auth chooser → pick "Continue as guest" → join → cheque
  await pageB.getByRole("button", { name: /continue as guest/i }).click({ timeout: 30000 });
  await pageB.waitForURL(new RegExp(`/cheques/${chequeId}`), { timeout: 30000 });
  await pageB.waitForTimeout(1500);
  log("B joined; total:", (await pageB.locator(".grand .value").first().textContent())?.trim());

  // B sets item-2 cost = $30 → cheque total should be $80
  const costB = pageB.locator('input[inputmode="decimal"]').nth(1);
  await costB.fill("30");
  await costB.blur();
  await pageB.waitForTimeout(1000);
  log("B total after $30:", (await pageB.locator(".grand .value").first().textContent())?.trim());

  // ---- A must converge to $80 via Realtime (idle receiver) ----
  let aTotal = "";
  for (let i = 0; i < 24; i++) {
    aTotal = (await pageA.locator(".grand .value").first().textContent())?.trim() ?? "";
    if (aTotal === "80.00") break;
    await pageA.waitForTimeout(500);
  }
  const bTotal = (await pageB.locator(".grand .value").first().textContent())?.trim();
  log("A converged total:", aTotal, "| B total:", bTotal);
  log(
    aTotal === "80.00" && bTotal === "80.00"
      ? "PASS: converged to 80.00 on both devices"
      : "FAIL: did not converge",
  );
} finally {
  log("console errors:", errors.length);
  errors.slice(0, 8).forEach((e) => log("  " + e));
  await browser.close();
}
