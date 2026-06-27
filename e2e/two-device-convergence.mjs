// =============================================================================
// Two-device convergence E2E (Phase 6). Manual run (needs the dev server, local
// Supabase with the Turnstile test secret, Playwright, and docker for the invite
// insert). Verifies: A creates a bill, B joins via an editor invite, both edit,
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
  // ---- Device A: create a bill, set item-1 cost = $50 ----
  const pageA = await (await browser.newContext()).newPage();
  pageA.on("pageerror", (e) => errors.push("A: " + e.message));
  await pageA.goto("http://localhost:5173/", { waitUntil: "load" });
  await pageA
    .getByRole("button", { name: /new bill/i })
    .first()
    .click();
  await pageA.waitForURL(/\/bills\/[0-9a-f-]{36}/, { timeout: 25000 });
  const billId = pageA.url().split("/bills/")[1];
  log("A created bill", billId);

  const costA = pageA.locator('input[inputmode="decimal"]').first();
  await costA.fill("50");
  await costA.blur();
  await pageA.waitForTimeout(1000);
  log("A total after $50:", (await pageA.locator(".grand .value").first().textContent())?.trim());

  // ---- create an editor invite for the bill (invite-mgmt UI is deferred) ----
  const inviteId = randomUUID();
  execSync(
    `docker exec supabase_db_cheqii psql -U postgres -d postgres -c ` +
      `"insert into invites (id, bill_id, role) values ('${inviteId}','${billId}','editor');"`,
    { stdio: "ignore" },
  );
  log("editor invite created");

  // ---- Device B: join via invite (→ /auth anon sign-in → join → bill) ----
  const pageB = await (await browser.newContext()).newPage();
  pageB.on("pageerror", (e) => errors.push("B: " + e.message));
  await pageB.goto(`http://localhost:5173/invite/${billId}#${inviteId}`, { waitUntil: "load" });
  await pageB.waitForURL(new RegExp(`/bills/${billId}`), { timeout: 30000 });
  await pageB.waitForTimeout(1500);
  log("B joined; total:", (await pageB.locator(".grand .value").first().textContent())?.trim());

  // B sets item-2 cost = $30 → bill total should be $80
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
