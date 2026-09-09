// SPDX-License-Identifier: Apache-2.0
// Runs the actual browser behind a local W3C WebDriver service. No runtime dependency.
// node scripts/benchmark-webdriver.mjs firefox http://127.0.0.1:4445 /path/to/firefox /tmp/firefox.json
// Safari does not need a binary argument: use "-" instead.
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const [browser, endpoint, binary, output] = process.argv.slice(2);
if (!["safari", "firefox", "opera"].includes(browser) || !endpoint || !output)
  throw Error(
    'Usage: benchmark-webdriver.mjs safari|firefox|opera driver-url binary-or-\"-\" output.json',
  );
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(endpoint).hostname))
  throw Error("Use a local WebDriver service for these local fixtures.");
const base = "http://127.0.0.1:8770";
const root = new URL("../", import.meta.url);
const hash = async () =>
  createHash("sha256")
    .update(await readFile(new URL("paper-curl.js", root)))
    .digest("hex");
const coreSha256 = await hash();
const suiteHash = async () => {
  const digest = createHash("sha256");
  for (const path of [
    "tests/browser/regressions.js",
    "tests/browser/css-regressions.js",
    "examples/vue/tests.html",
    "examples/vue/tests.js",
  ]) {
    digest.update(path + "\0");
    digest.update(await readFile(new URL(path, root)));
  }
  return digest.digest("hex");
};
const suiteSha256 = await suiteHash();
const pkg = JSON.parse(await readFile(new URL("package.json", root)));
let session;
async function request(path, body, method = "POST") {
  const response = await fetch(endpoint.replace(/\/$/, "") + path, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(60000),
  });
  const result = await response.json();
  if (!response.ok || result.value?.error || result.status)
    throw Error(result.value?.message || JSON.stringify(result));
  if (path === "/session" && result.sessionId)
    return { sessionId: result.sessionId, capabilities: result.value };
  return result.value;
}
const execute = (script, args = []) =>
  request(`/session/${session}/execute/sync`, { script, args });
async function waitFor(script, timeout = 240000) {
  const deadline = Date.now() + timeout;
  let nextProgress = Date.now() + 30000;
  let last;
  while (Date.now() < deadline) {
    last = await execute(script);
    if (last) return last;
    if (Date.now() >= nextProgress) {
      console.log(
        await execute(
          'return {visibility:document.visibilityState,focused:document.hasFocus(),progress:document.getElementById("results")?.textContent.slice(-500) || document.getElementById("progress")?.textContent}',
        ),
      );
      nextProgress = Date.now() + 30000;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw Error(
    `Timed out. Last page state: ${await execute("return JSON.stringify({visibility:document.visibilityState,focused:document.hasFocus(),text:document.body.innerText.slice(-3000)})")}`,
  );
}
const capabilities =
  browser === "firefox"
    ? { browserName: "firefox", "moz:firefoxOptions": { binary } }
    : browser === "opera"
      ? {
          browserName: "chrome",
          "goog:chromeOptions": {
            binary,
            w3c: true,
            args: ["--no-first-run", "--no-default-browser-check"],
          },
        }
      : { browserName: "safari" };
try {
  const created = await request("/session", {
    capabilities: { alwaysMatch: capabilities },
  });
  session = created.sessionId;
  if (!created.capabilities)
    throw Error("Invalid session response: " + JSON.stringify(created));
  const identity = {
    name: browser,
    version:
      created.capabilities.browserVersion || created.capabilities.version,
    platform:
      created.capabilities.platformName || created.capabilities.platform,
    headless: false,
    driver: "W3C WebDriver",
  };
  console.log(JSON.stringify({ browser: identity }));
  await request(`/session/${session}/window/rect`, {
    width: 1280,
    height: 900,
  });
  await request(`/session/${session}/url`, { url: base + "/css.html" });
  await waitFor('return !!document.getElementById("run")?.onclick', 30000);
  const userAgent = await execute("return navigator.userAgent");
  if (browser === "opera") {
    identity.engineVersion = identity.version;
    identity.version = userAgent.match(/OPR\/([\d.]+)/)?.[1];
  }
  if (browser === "firefox" && !userAgent.includes("Firefox/"))
    throw Error("The driver did not launch Firefox.");
  if (browser === "opera" && !userAgent.includes("OPR/"))
    throw Error("The driver did not launch Opera.");
  if (
    browser === "safari" &&
    (!userAgent.includes("Safari/") || /Chrome|Chromium|OPR/.test(userAgent))
  )
    throw Error("The driver did not launch Safari.");
  const requestedAt = Date.now();
  await waitFor(
    'const b=document.getElementById("run"); if(!b?.onclick || !document.getElementById("report-json")?.textContent) return false; if(!b.disabled)b.click(); return b.disabled',
    30000,
  );
  console.log("Started property sweep.");
  await waitFor('return !document.getElementById("run").disabled');
  const report = JSON.parse(
    await execute('return document.getElementById("report-json").textContent'),
  );
  if (
    !report.complete ||
    report.scope !== "Full catalog and browser inventory" ||
    report.libraryVersion !== pkg.version ||
    report.browser !== userAgent ||
    Date.parse(report.startedAt) < requestedAt - 1000
  )
    throw Error(
      "Property report is stale, incomplete, or has the wrong browser/source. Page: " +
        (await execute(
          'return document.getElementById("progress").textContent',
        )),
    );
  report.browserIdentity = identity;
  report.coreSha256 = coreSha256;
  await writeFile(output, JSON.stringify(report, null, 2) + "\n");
  console.log(
    JSON.stringify({
      propertyCount: report.total,
      counts: report.rows.reduce(
        (acc, row) => ((acc[row.status] = (acc[row.status] || 0) + 1), acc),
        {},
      ),
      durationMs: report.durationMs,
    }),
  );
  await request(`/session/${session}/url`, { url: base + "/tests.html" });
  await waitFor('return !!document.getElementById("run")?.onclick', 30000);
  const startedAt = new Date().toISOString();
  await execute('document.getElementById("run").click()');
  await waitFor('return !document.getElementById("run").disabled');
  report.visual = await execute(
    'const r=document.getElementById("results"); return {passed:Number(r.dataset.passed),failed:Number(r.dataset.failed),output:r.textContent}',
  );
  const summary = report.visual.output.match(
    /(?:^|\n)(\d+) passed, (\d+) failed\.\s*$/,
  );
  if (
    !summary ||
    Number(summary[1]) !== report.visual.passed ||
    Number(summary[2]) !== report.visual.failed ||
    report.visual.passed + report.visual.failed === 0 ||
    ["passed", "failed"].some(
      (field, index) =>
        report.visual.output
          .split("\n")
          .filter((line) => line.startsWith(index === 0 ? "PASS " : "FAIL "))
          .length !== report.visual[field],
    )
  )
    throw Error(
      "Visual suite did not complete; a page reload may have interrupted it.",
    );
  report.visual.startedAt = startedAt;
  report.visual.completedAt = new Date().toISOString();
  report.visual.suiteSha256 = suiteSha256;
  if ((await hash()) !== coreSha256)
    throw Error(
      "Core changed while the benchmark was running; rerun against unchanged source.",
    );
  if ((await suiteHash()) !== suiteSha256)
    throw Error(
      "Visual fixtures changed during the run; rerun against unchanged tests.",
    );
  await writeFile(output, JSON.stringify(report, null, 2) + "\n");
  console.log(
    JSON.stringify({
      visualPassed: report.visual.passed,
      visualFailed: report.visual.failed,
      failures: report.visual.output
        .split("\n")
        .filter((line) => line.startsWith("FAIL")),
    }),
  );
} finally {
  if (session)
    await request(`/session/${session}`, undefined, "DELETE").catch((error) =>
      console.error("Session cleanup:", error.message),
    );
}
