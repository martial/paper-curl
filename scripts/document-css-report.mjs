// SPDX-License-Identifier: Apache-2.0
// Import a completed run, then regenerate all browser documentation.
// node scripts/document-css-report.mjs /absolute/path/report.json [chromium|firefox|opera|safari]
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = new URL("../", import.meta.url);
const docs = new URL("docs/", root);
const directory = new URL("css-reports/", docs);
const pkg = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
const names = {
  chromium: "Chromium",
  firefox: "Firefox",
  opera: "Opera",
  safari: "Safari",
};
const labels = {
  preserved: "Value preserved",
  mismatch: "Value mismatch",
  unsupported: "Browser unsupported",
  native: "Native / frozen",
  untested: "Needs a dedicated fixture",
  error: "Capture error",
};
const infer = (ua) =>
  /OPR\//.test(ua)
    ? "opera"
    : /Firefox\//.test(ua)
      ? "firefox"
      : /Chrom(?:e|ium)\//.test(ua)
        ? "chromium"
        : /Safari\//.test(ua)
          ? "safari"
          : null;
const version = (ua) =>
  ua.match(
    {
      opera: /OPR\/([\d.]+)/,
      firefox: /Firefox\/([\d.]+)/,
      chromium: /Chrom(?:e|ium)\/([\d.]+)/,
      safari: /Version\/([\d.]+)/,
    }[infer(ua)],
  )?.[1];
const quantile = (values, q) =>
  values.length ? values[Math.max(0, Math.ceil(values.length * q) - 1)] : null;
const code = (value) =>
  "`" +
  String(value ?? "—")
    .replaceAll("`", "′")
    .replaceAll("\n", " ") +
  "`";
const csv = (value) => '"' + String(value ?? "").replaceAll('"', '""') + '"';
const json = (value) => JSON.stringify(value, null, 2) + "\n";
await mkdir(directory, { recursive: true });
const [source, requestedKey] = process.argv.slice(2);
if (source) {
  const report = JSON.parse(await readFile(source, "utf8"));
  const key = requestedKey || infer(report.browser || "");
  if (!names[key] || infer(report.browser || "") !== key)
    throw Error("Report user agent does not match the browser key.");
  if (
    !report.complete ||
    report.scope !== "Full catalog and browser inventory" ||
    report.rows.length !== report.total ||
    report.total < 669 ||
    report.libraryVersion !== pkg.version
  )
    throw Error(
      "Import a complete inventory from the current library version.",
    );
  if (
    new Set(report.rows.map((row) => row.property)).size !== report.total ||
    report.rows.some((row) => !labels[row.status])
  )
    throw Error("Invalid or duplicate property rows.");
  const coreSha256 = createHash("sha256")
    .update(await readFile(new URL("paper-curl.js", root)))
    .digest("hex");
  if (report.coreSha256 && report.coreSha256 !== coreSha256)
    throw Error(
      "Report source checksum differs from the current core; rerun the browser.",
    );
  report.coreSha256 = coreSha256;
  report.browserIdentity ||= { name: key, version: version(report.browser) };
  if (report.visual?.output) {
    for (const [field, prefix] of [
      ["passed", "PASS "],
      ["failed", "FAIL "],
    ])
      if (
        report.visual.output
          .split("\n")
          .filter((line) => line.startsWith(prefix)).length !==
        report.visual[field]
      )
        throw Error("Visual counters disagree with the recorded test output.");
  }
  const counts = Object.fromEntries(
    Object.keys(labels).map((status) => [
      status,
      report.rows.filter((row) => row.status === status).length,
    ]),
  );
  const times = report.rows
    .flatMap((row) => (row.captureMs === undefined ? [] : [row.captureMs]))
    .sort((a, b) => a - b);
  report.summary = {
    counts,
    captureMedianMs: quantile(times, 0.5),
    captureP95Ms: quantile(times, 0.95),
    timedProperties: times.length,
  };
  await writeFile(new URL(key + ".json", directory), json(report));
  console.log(
    json({
      browser: key,
      version: report.browserIdentity.version,
      properties: report.total,
      ...report.summary,
      visual: report.visual
        ? { passed: report.visual.passed, failed: report.visual.failed }
        : null,
    }),
  );
}
const reports = {};
for (const key of Object.keys(names)) {
  try {
    reports[key] = JSON.parse(
      await readFile(new URL(key + ".json", directory), "utf8"),
    );
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
const links = (key) =>
  `[Full property list](css-reports/${key}.md) · [JSON evidence](css-reports/${key}.json) · [CSV](css-reports/${key}.csv)`;
let overview =
  "# CSS property inventories by browser\n\n[Method and known limits](CSS_SUPPORT.md) · [Searchable live benchmark](https://paper-curl-vue.martialou543257.chatgpt.site/css.html)\n\nEach browser has its own inventory and tested declarations. A preserved value is not proof of visual equivalence. Browser-specific properties, flags, versions, and automatic candidate selection mean counts are not a directly comparable support score.\n";
let results = "<!-- BEGIN GENERATED CSS RESULTS -->\n";
for (const [key, name] of Object.entries(names)) {
  const report = reports[key];
  results += `\n### ${name}\n\n`;
  overview += `\n## ${name}\n\n`;
  if (!report) {
    const note =
      key === "safari"
        ? "Not measured yet. Real Safari automation requires macOS authorization and Safari’s **Allow remote automation** setting. No WebKit or Chromium result is substituted."
        : "No measured report is recorded yet.";
    results += note + "\n";
    overview += note + "\n";
    continue;
  }
  const { counts, captureMedianMs, captureP95Ms } = report.summary;
  const visual = report.visual
    ? `Visual/browser suite: **${report.visual.passed} passed, ${report.visual.failed} failed**.`
    : "Visual/browser suite: not recorded in this report.";
  const description = `**${name} ${report.browserIdentity?.version || version(report.browser)}**, PaperCurl **${report.libraryVersion}**, recorded ${report.completedAt}; DPR ${report.viewport.dpr}.\n\n${report.total} properties: **${counts.preserved} preserved values**, **${counts.mismatch} mismatches**, **${counts.unsupported} browser-unsupported**, **${counts.native} native/frozen**, **${counts.untested} unverified**, **${counts.error} capture errors**.\n\n${visual}\n\nCapture median **${captureMedianMs} ms**, p95 **${captureP95Ms} ms**, for two snapshots per tested declaration. Full sweep: ${(report.durationMs / 1000).toFixed(1)} seconds.\n\n${links(key)}\n`;
  results += description;
  overview += description;
  const fields = [
    "property",
    "status",
    "value",
    "expected",
    "restored",
    "hiddenExpected",
    "hiddenRestored",
    "captureMs",
    "detail",
  ];
  await writeFile(
    new URL(key + ".csv", directory),
    [
      fields.map(csv).join(","),
      ...report.rows.map((row) =>
        fields.map((field) => csv(row[field])).join(","),
      ),
    ].join("\n") + "\n",
  );
  let inventory = `# ${name} CSS property inventory\n\nPaperCurl ${report.libraryVersion}; ${report.completedAt}.\n\nBrowser: ${report.browser}. DPR ${report.viewport.dpr}.\n\n[All browsers](../CSS_PROPERTIES.md) · [Method and limits](../CSS_SUPPORT.md) · [JSON evidence](${key}.json) · [CSV](${key}.csv)\n\nOne selected declaration is tested per property on visible and hidden pages. These values do not certify every rendered pixel or value combination.\n\n${visual}\n`;
  if (report.attemptNotes?.length)
    inventory +=
      "\n## Run observations\n\n" +
      report.attemptNotes.map((note) => "- " + note + "\n").join("");
  if (report.visual?.output) {
    const failures = report.visual.output
      .split("\n")
      .filter((line) => line.startsWith("FAIL "));
    if (failures.length)
      inventory +=
        "\n## Observed visual failures\n\n" +
        failures.map((line) => "- " + line.slice(5) + "\n").join("");
  }
  for (const [status, label] of Object.entries(labels)) {
    const rows = report.rows.filter((row) => row.status === status);
    if (!rows.length) continue;
    inventory += `\n## ${label} (${rows.length})\n\n`;
    for (const row of rows) {
      inventory += `- ${code(row.property)}`;
      if (row.value) inventory += ` — tested ${code(row.value)}`;
      if (row.captureMs !== undefined)
        inventory += `; ${row.captureMs} ms for both page states`;
      if (status === "mismatch")
        inventory += `; native ${code(row.expected)} → restored ${code(row.restored)}; hidden ${code(row.hiddenExpected)} → ${code(row.hiddenRestored)}`;
      if (row.detail) inventory += `; ${row.detail.replaceAll("\n", " ")}`;
      inventory += ".\n";
    }
  }
  await writeFile(new URL(key + ".md", directory), inventory);
}
results +=
  "\nTimings are local diagnostics, not a controlled browser speed ranking. Runs use different browser engines and may differ in viewport, DPR, font caches, and scheduling. Each JSON records its environment, exact core checksum, and failures.\n<!-- END GENERATED CSS RESULTS -->";
await writeFile(new URL("CSS_PROPERTIES.md", docs), overview);
const support = new URL("CSS_SUPPORT.md", docs);
let text = await readFile(support, "utf8");
text = text.replace(
  /<!-- BEGIN GENERATED CSS RESULTS -->[\s\S]*?<!-- END GENERATED CSS RESULTS -->/,
  results,
);
await writeFile(support, text);
// Preserve the original public Chrome report paths for existing links.
if (reports.chromium) {
  await writeFile(new URL("css-report.json", docs), json(reports.chromium));
  await writeFile(
    new URL("css-report.csv", docs),
    await readFile(new URL("chromium.csv", directory)),
  );
}
