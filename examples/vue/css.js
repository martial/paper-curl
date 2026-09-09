// SPDX-License-Identifier: Apache-2.0
import Core from "paper-curl";
import "paper-curl/paper-curl.css";
import "./css.css";
import catalog from "../../tests/browser/css-catalog.json";
import pkg from "../../package.json";
const saved = import.meta.glob("../../docs/css-report.json", {
  eager: true,
  import: "default",
});
let report = Object.values(saved)[0] || null,
  cancelled = false;
const $ = (id) => document.getElementById(id);
const labels = {
  preserved: "Value preserved",
  mismatch: "Value mismatch",
  unsupported: "Browser unsupported",
  native: "Native / frozen",
  untested: "Needs fixture",
  error: "Capture error",
};
const native =
  /^(animation|transition|view-transition|scroll|overscroll|touch-action|pointer-events|cursor|caret|user-select|resize|will-change)(-|$)|^-(webkit|moz)-(animation|transition|user-select|tap-highlight)/;
const generic = [
  "24px",
  "25%",
  "2",
  "0.5",
  "red",
  "auto",
  "none",
  "normal",
  "solid",
  "block",
  "inline",
  "grid",
  "flex",
  "center",
  "start",
  "end",
  "hidden",
  "visible",
  "bold",
  "italic",
  "serif",
  "2px solid red",
  "12px 8px",
  "1 / 1",
  "repeat(2, 1fr)",
  "translateX(12px)",
  "blur(2px)",
  "linear-gradient(red, blue)",
  '"CSS"',
  "--pc-example",
  "3",
  "fixed",
  "local",
  "multiply",
  "content-box",
  "padding-box",
  "border-box",
  "repeat-x",
  "round",
  "space",
  "exclude",
  "xor",
  "source-in",
  "luminance",
  "clone",
  "vertical-rl",
  "squircle",
  "bevel",
  "notch",
  "crispEdges",
  "geometricPrecision",
  "optimizeSpeed",
  "disc",
  "collapse",
  "wrap",
  "row-reverse wrap",
  "break-word",
  "inset(10%)",
  "rect(0px, 100px, 80px, 0px)",
  "1s",
  "alphabetic",
  "reverse",
  "slice",
];
const special = {
  font: "italic 20px/1.4 Arial",
  "font-family": "Georgia, serif",
  "font-size": "22px",
  background: "linear-gradient(red,blue)",
  border: "4px solid red",
  outline: "4px dashed blue",
  "box-shadow": "3px 4px 2px red",
  "text-shadow": "2px 2px red",
  transform: "translate(12px, 4px)",
  rotate: "15deg",
  scale: "0.8",
  translate: "12px 4px",
  "clip-path": "circle(35% at 50% 50%)",
  "grid-template": "40px 40px / 50px 50px",
  "grid-template-areas": '"a b" "a b"',
  filter: "blur(2px)",
  "backdrop-filter": "blur(2px)",
  "stroke-dasharray": "8px 4px",
  d: 'path("M 0 0 L 40 40")',
  "offset-path": 'path("M 0 0 L 40 40")',
  "object-position": "20% 30%",
  "border-image": "linear-gradient(red,blue) 1",
  mask: "linear-gradient(white,transparent)",
  "mask-image": "linear-gradient(white,transparent)",
  "counter-reset": "chapter 2",
  "counter-increment": "chapter 2",
  "counter-set": "chapter 2",
  quotes: '"«" "»"',
  content: '"CSS"',
  "list-style": "square inside",
  "text-decoration": "underline wavy red",
  "font-variation-settings": '"wght" 650',
  "font-feature-settings": '"liga" 0',
  contain: "layout paint",
  container: "test / inline-size",
  "writing-mode": "vertical-rl",
  direction: "rtl",
  position: "relative",
};
const base =
  "display:block;position:relative;width:160px;height:100px;margin:20px;padding:12px;border:4px solid #22332a;background:#f5f4ed;color:#17251e;font:16px/20px Arial;box-sizing:border-box";
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
function make(tag, text) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}
function render() {
  if (!report) {
    $("progress").textContent =
      "Run the benchmark to generate results for this browser.";
    return;
  }
  const totals = {};
  for (const row of report.rows)
    totals[row.status] = (totals[row.status] || 0) + 1;
  $("summary").replaceChildren(
    ...Object.entries(totals).map(([status, n]) => {
      const node = make("div");
      node.append(make("strong", String(n)), make("span", labels[status]));
      return node;
    }),
  );
  $("environment").textContent =
    `PaperCurl ${report.libraryVersion} · ${report.browser} · ${report.completedAt || report.startedAt} · ${report.complete ? "Complete run" : "Partial run"}`;
  const query = $("search").value.trim().toLowerCase(),
    filter = $("filter").value;
  const rows = report.rows.filter(
    (row) =>
      (!query || row.property.includes(query)) &&
      (filter === "all" || row.status === filter),
  );
  $("count").textContent = `${rows.length} / ${report.rows.length} properties`;
  const fragment = document.createDocumentFragment();
  for (const row of rows) {
    const tr = make("tr"),
      name = make("td"),
      link = make("a", row.property);
    link.href = `https://developer.mozilla.org/en-US/docs/Web/CSS/${encodeURIComponent(row.property)}`;
    name.append(link);
    const value = make("td");
    value.append(make("code", row.value || "—"));
    if (row.expected !== undefined) {
      const details = make("details"),
        summary = make("summary", "Recorded values");
      details.append(
        summary,
        make("p", `Native: ${row.expected}`),
        make("p", `Restored: ${row.restored}`),
      );
      if (row.hiddenExpected !== undefined)
        details.append(
          make("p", `Hidden native: ${row.hiddenExpected}`),
          make("p", `Hidden restored: ${row.hiddenRestored}`),
        );
      if (row.detail) details.append(make("p", row.detail));
      value.append(details);
    }
    const status = make("td", labels[row.status]);
    status.className = row.status;
    tr.append(
      name,
      value,
      status,
      make(
        "td",
        row.captureMs === undefined ? "—" : `${row.captureMs.toFixed(1)} ms`,
      ),
    );
    fragment.append(tr);
  }
  $("rows").replaceChildren(fragment);
  $("download").disabled = !report.rows.length;
}
$("search").oninput = render;
$("filter").onchange = render;
$("cancel").onclick = () => {
  cancelled = true;
};
$("download").onclick = () => {
  const blob = new Blob([JSON.stringify(report, null, 2) + "\n"], {
      type: "application/json",
    }),
    url = URL.createObjectURL(blob),
    a = make("a");
  a.href = url;
  a.download = "paper-curl-css-report.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$("run").onclick = async () => {
  cancelled = false;
  $("run").disabled = true;
  $("cancel").hidden = false;
  $("meter").hidden = false;
  $("meter").value = 0;
  const host = make("div");
  host.style.cssText = "width:850px;height:400px";
  host.innerHTML =
    "<article><div data-css-probe>Paper <span>CSS</span></div></article><article><div data-css-probe>Paper <span>CSS</span></div></article>";
  $("fixture").append(host);
  const core = new Core(host, {
    width: 320,
    height: 220,
    textureScale: 1,
    preload: false,
    keyboard: false,
    duration: 0,
    worker: false,
  });
  const targets = [...host.querySelectorAll("[data-css-probe]")];
  const mirror = make("div");
  mirror.style.cssText =
    "position:fixed;left:-10000px;top:0;width:320px;height:220px";
  document.body.append(mirror);
  const shadow = mirror.attachShadow({ mode: "closed" });
  let markup = "";
  const encode = core._encode.bind(core);
  core._encode = (type, value) => {
    if (type === "svg") markup = value;
    return encode(type, value);
  };
  const selected = new URLSearchParams(location.search)
    .get("property")
    ?.split(",");
  const properties = [
    ...new Set([
      ...Object.keys(catalog.properties),
      ...getComputedStyle(targets[0]),
    ]),
  ]
    .filter((p) => !p.startsWith("--") && (!selected || selected.includes(p)))
    .sort();
  const started = performance.now();
  report = {
    schemaVersion: 1,
    libraryVersion: pkg.version,
    browser: navigator.userAgent,
    viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
    startedAt: new Date().toISOString(),
    catalog: {
      source: catalog.source,
      revision: catalog.revision,
      license: catalog.license,
    },
    method:
      "One non-default declaration per property; real SVG rasterization and computed-value round trip on visible and hidden pages. Not a full pixel equivalence test.",
    scope: selected
      ? "Selected properties"
      : "Full catalog and browser inventory",
    total: properties.length,
    complete: false,
    rows: [],
  };
  try {
    for (const property of properties) {
      if (cancelled) break;
      const row = { property, status: "untested" };
      if (!CSS.supports(property, "initial")) row.status = "unsupported";
      else if (native.test(property)) row.status = "native";
      else {
        try {
          for (const target of targets) target.style.cssText = base;
          const initial = getComputedStyle(targets[0]).getPropertyValue(
            property,
          );
          const values = [
            special[property],
            ...(catalog.properties[property]?.keywords || []),
            ...generic,
          ].filter(Boolean);
          for (const value of values) {
            if (!CSS.supports(property, value)) continue;
            targets[0].style.cssText = base;
            targets[0].style.setProperty(property, value);
            const resolved = getComputedStyle(targets[0]).getPropertyValue(
              property,
            );
            if (resolved && resolved !== initial) {
              row.value = value;
              break;
            }
          }
          if (row.value) {
            for (const target of targets) {
              target.style.cssText = base;
              target.style.setProperty(property, row.value);
            }
            if (property === "tab-size")
              row.typedValue = targets[0]
                .computedStyleMap?.()
                .get(property)
                ?.toString();
            core.refresh([0, 1]);
            row.status = "preserved";
            row.captureMs = 0;
            for (const page of [0, 1]) {
              const expected = core._withPageLayout(page, () =>
                getComputedStyle(targets[page]).getPropertyValue(property),
              );
              const before = performance.now();
              await core._snapshot(page);
              row.captureMs += performance.now() - before;
              const parsed = new DOMParser().parseFromString(
                markup,
                "image/svg+xml",
              );
              if (parsed.querySelector("parsererror"))
                throw Error("Serialized SVG failed XML parsing");
              const stage =
                parsed.querySelector("foreignObject").firstElementChild;
              shadow.replaceChildren(document.importNode(stage, true));
              const restored = getComputedStyle(
                shadow.querySelector("[data-css-probe]"),
              ).getPropertyValue(property);
              if (page === 0) {
                row.expected = expected;
                row.restored = restored;
              } else {
                row.hiddenExpected = expected;
                row.hiddenRestored = restored;
              }
              if (expected !== restored) {
                row.status = "mismatch";
                row.sourceStyle = targets[page].style.cssText;
                row.snapshotStyle = shadow
                  .querySelector("[data-css-probe]")
                  .getAttribute("style");
              }
            }
            row.captureMs = Math.round(row.captureMs * 10) / 10;
          }
        } catch (error) {
          row.status = "error";
          row.detail = error.message;
        }
      }
      report.rows.push(row);
      $("meter").value = report.rows.length / properties.length;
      $("progress").textContent =
        `Checking ${report.rows.length}/${properties.length} · ${property}`;
      if (report.rows.length % 8 === 0) await tick();
    }
    report.complete = !cancelled;
    report.completedAt = new Date().toISOString();
    report.durationMs = Math.round(performance.now() - started);
    $("progress").textContent =
      `${report.complete ? "Finished" : "Cancelled"}: ${report.rows.length} properties in ${(report.durationMs / 1000).toFixed(1)} seconds. Capture times include both page states.`;
  } finally {
    core.destroy();
    host.remove();
    mirror.remove();
    $("run").disabled = false;
    $("cancel").hidden = true;
    render();
  }
};
render();
if (report)
  $("progress").textContent =
    `Recorded ${report.rows.length}-property run. Re-run to measure your browser.`;
