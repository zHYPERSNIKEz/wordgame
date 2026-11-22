import path from "node:path";
import { createHelpers, launchBrowser } from "./browser.mjs";
import { startSpaServer } from "./spa-server.mjs";
import { tier1Tests } from "./suites/tier1-features.mjs";
import { tier2Tests } from "./suites/tier2-boundaries.mjs";
import { tier3Tests } from "./suites/tier3-combinations.mjs";
import { tier4Tests } from "./suites/tier4-scenarios.mjs";

const TIERS = [
  { key: "1", label: "Tier 1 (Features)", tests: tier1Tests },
  { key: "2", label: "Tier 2 (Boundaries)", tests: tier2Tests },
  { key: "3", label: "Tier 3 (Combinations)", tests: tier3Tests },
  { key: "4", label: "Tier 4 (Scenarios)", tests: tier4Tests },
];

function parseArgs(argv) {
  const opts = {
    tier: "all",
    baseUrl: null,
    list: false,
    filter: null,
    rootDir: path.resolve("dist/public"),
  };

  for (const arg of argv) {
    if (arg === "--list") {
      opts.list = true;
    } else if (arg.startsWith("--tier=")) {
      opts.tier = arg.slice("--tier=".length).trim().toLowerCase();
    } else if (arg.startsWith("--base-url=")) {
      opts.baseUrl = arg.slice("--base-url=".length).trim().replace(/\/+$/, "");
    } else if (arg.startsWith("--filter=")) {
      opts.filter = arg.slice("--filter=".length).trim().toLowerCase();
    } else if (arg.startsWith("--root-dir=")) {
      opts.rootDir = path.resolve(arg.slice("--root-dir=".length).trim());
    } else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: node e2e/run-e2e.mjs [--tier=1|2|3|4|all] [--base-url=<url>] [--list] [--filter=<text>]"
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown CLI argument: ${arg}`);
    }
  }

  if (!["all", "1", "2", "3", "4"].includes(opts.tier)) {
    throw new Error(`Invalid --tier="${opts.tier}". Expected 1, 2, 3, 4, or all.`);
  }

  return opts;
}

function selectTiers(opts) {
  const selected =
    opts.tier === "all" ? TIERS : TIERS.filter((t) => t.key === opts.tier);
  return selected.map((tier) => ({
    ...tier,
    tests: opts.filter
      ? tier.tests.filter(
          (t) =>
            t.id.toLowerCase().includes(opts.filter) ||
            t.name.toLowerCase().includes(opts.filter)
        )
      : tier.tests,
  }));
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const selectedTiers = selectTiers(opts);
  const totalSelected = selectedTiers.reduce((sum, t) => sum + t.tests.length, 0);

  if (opts.filter && totalSelected === 0) {
    throw new Error(`No tests matched --filter="${opts.filter}".`);
  }

  if (opts.list) {
    for (const tier of selectedTiers) {
      console.log(`\n=== ${tier.label} (${tier.tests.length}) ===`);
      for (const t of tier.tests) {
        console.log(`  ${t.id} [${t.area}] ${t.name}`);
      }
    }
    console.log(`\nTotal listed tests: ${totalSelected}`);
    return;
  }

  // Explicitly sanitize DB/OAuth env vars for standalone demo fidelity
  delete process.env.DATABASE_URL;
  delete process.env.OAUTH_SERVER_URL;
  delete process.env.VITE_OAUTH_PORTAL_URL;

  let spaServer = null;
  let browser = null;

  try {
    const baseUrl = opts.baseUrl
      ? opts.baseUrl
      : (spaServer = await startSpaServer({ rootDir: opts.rootDir })).baseUrl;

    console.log(`[e2e] Target URL: ${baseUrl}`);
    browser = await launchBrowser();
    console.log(`[e2e] Browser driver: ${browser.driverName}`);

    let totalPassed = 0;
    let totalFailed = 0;
    const failures = [];
    const tierStats = [];

    for (const tier of selectedTiers) {
      let tierPassed = 0;
      let tierFailed = 0;
      console.log(`\n--- Running ${tier.label} (${tier.tests.length} tests) ---`);

      for (const test of tier.tests) {
        const startMs = Date.now();
        const context = await browser.newContext();
        let page = null;
        try {
          page = await context.newPage();
          const h = createHelpers(page, baseUrl);
          await test.run(h);
          h.assertZeroErrors();

          const elapsed = Date.now() - startMs;
          tierPassed++;
          totalPassed++;
          console.log(`  PASS ${test.id} (${elapsed}ms) — ${test.name}`);
        } catch (err) {
          const elapsed = Date.now() - startMs;
          tierFailed++;
          totalFailed++;
          const msg = err?.message || String(err);
          console.error(`  FAIL ${test.id} (${elapsed}ms) — ${test.name}\n       ${msg}`);
          failures.push({ id: test.id, name: test.name, error: msg });
        } finally {
          if (page) await page.close().catch(() => {});
          await context.close().catch(() => {});
        }
      }

      tierStats.push({
        label: tier.label,
        total: tier.tests.length,
        passed: tierPassed,
        failed: tierFailed,
      });
    }

    console.log("\n=== E2E Summary ===");
    for (const s of tierStats) {
      console.log(`  ${s.label}: ${s.passed}/${s.total} passed, ${s.failed} failed`);
    }
    console.log(
      `  TOTAL: ${totalPassed}/${totalPassed + totalFailed} passed, ${totalFailed} failed`
    );

    if (totalFailed > 0) {
      console.error("\nFailed tests:");
      for (const f of failures) {
        console.error(`  - ${f.id}: ${f.error}`);
      }
      process.exitCode = 1;
    }
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (spaServer) await spaServer.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error(`[e2e] Fatal error: ${err?.stack || err?.message || err}`);
  process.exit(1);
});
