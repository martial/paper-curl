// SPDX-License-Identifier: Apache-2.0
// Usage: node scripts/document-css-report.mjs /absolute/path/to/download.json
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = new URL("../", import.meta.url);
const source = process.argv[2];
if (!source) throw Error("Pass the complete JSON downloaded from /css.html");
const report = JSON.parse(await readFile(source, "utf8"));
const pkg = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
if (
  !report.complete ||
  report.scope !== "Full catalog and browser inventory" ||
  report.rows.length !== report.total ||
  report.total < 669 ||
  report.libraryVersion !== pkg.version
)
  throw Error(
    "The report must be a complete inventory run of the current library version.",
  );
report.coreSha256 = createHash("sha256")
  .update(await readFile(new URL("paper-curl.js", root)))
  .digest("hex");
const labels = {
  preserved: "Value preserved",
  mismatch: "Value mismatch",
  unsupported: "Browser unsupported",
  native: "Native / frozen",
  untested: "Needs a dedicated fixture",
  error: "Capture error",
};
const counts = Object.fromEntries(
  Object.keys(labels).map((status) => [
    status,
    report.rows.filter((row) => row.status === status).length,
  ]),
);
const times = report.rows
  .flatMap((row) => (row.captureMs === undefined ? [] : [row.captureMs]))
  .sort((a, b) => a - b);
const quantile = (q) =>
  times.length ? times[Math.max(0, Math.ceil(times.length * q) - 1)] : null;
report.summary = {
  counts,
  captureMedianMs: quantile(0.5),
  captureP95Ms: quantile(0.95),
  timedProperties: times.length,
};
const docs = new URL("docs/", root);
await mkdir(docs, { recursive: true });
await writeFile(
  new URL("css-report.json", docs),
  JSON.stringify(report, null, 2) + "\n",
);
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
const csv = (value) => '"' + String(value ?? "").replaceAll('"', '""') + '"';
await writeFile(
  new URL("css-report.csv", docs),
  [
    fields.map(csv).join(","),
    ...report.rows.map((row) =>
      fields.map((field) => csv(row[field])).join(","),
    ),
  ].join("\n") + "\n",
);
const code = (value) =>
  "`" +
  String(value ?? "—")
    .replaceAll("`", "′")
    .replaceAll("\n", " ") +
  "`";
let inventory = `# CSS property inventory\n\nGenerated from the complete PaperCurl ${report.libraryVersion} benchmark on ${report.completedAt}.\n\nBrowser: ${report.browser}. DPR: ${report.viewport.dpr}.\n\n[Method and limitations](CSS_SUPPORT.md) · [JSON evidence](css-report.json) · [CSV](css-report.csv) · [Searchable live benchmark](https://paper-curl-vue.martialou543257.chatgpt.site/css.html)\n\nA preserved computed value is not a claim that every value or rendered pixel of a property works. Each row records one declaration, real SVG rasterization, and a computed-value comparison on visible and hidden pages.\n`;
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
      inventory += `; native ${code(row.expected)} → restored ${code(row.restored)}; hidden native ${code(row.hiddenExpected)} → restored ${code(row.hiddenRestored)}`;
    if (row.detail) inventory += `; ${row.detail.replaceAll("\n", " ")}`;
    inventory += ".\n";
  }
}
await writeFile(new URL("CSS_PROPERTIES.md", docs), inventory);
let results = `<!-- BEGIN GENERATED CSS RESULTS -->\nRecorded on ${report.completedAt}, using **PaperCurl ${report.libraryVersion}** and **${report.browser}** at DPR ${report.viewport.dpr}. The full inventory contains **${report.total} properties** and ran in ${(report.durationMs / 1000).toFixed(1)} seconds.\n\n`;
for (const [status, label] of Object.entries(labels))
  results += `- **${counts[status]} ${label.toLowerCase()}**.\n`;
results += `\nMedian capture time: **${quantile(0.5)} ms**; p95: **${quantile(0.95)} ms**, per tested declaration across **two snapshots** (visible and hidden page). These are diagnostic local timings, not a cold-network or device guarantee. The property sweep uses system fonts and main-thread encoding.\n<!-- END GENERATED CSS RESULTS -->`;
const support = new URL("CSS_SUPPORT.md", docs);
let text = await readFile(support, "utf8");
if (!text.includes("<!-- BEGIN GENERATED CSS RESULTS -->"))
  throw Error("CSS_SUPPORT.md is missing the results marker");
text = text.replace(
  /<!-- BEGIN GENERATED CSS RESULTS -->[\s\S]*?<!-- END GENERATED CSS RESULTS -->/,
  results,
);
await writeFile(support, text);
process.stdout.write(
  JSON.stringify(
    {
      properties: report.total,
      ...report.summary,
      coreSha256: report.coreSha256,
    },
    null,
    2,
  ) + "\n",
);
