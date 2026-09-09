// SPDX-License-Identifier: Apache-2.0
import Current from "paper-curl";
import "paper-curl/paper-curl.css";
const baseline = new URLSearchParams(location.search).has("baseline");
const baselinePath = "./baseline.mjs";
const Core = baseline
  ? (await import(/* @vite-ignore */ baselinePath)).default
  : Current;
const families = [
  "DM Sans",
  "Playfair Display",
  "Cormorant Garamond",
  "Space Mono",
  "Bungee",
];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const out = document.querySelector("#results");
document.querySelector("#run").onclick = async () => {
  document.querySelector("#run").disabled = true;
  delete out.dataset.complete;
  out.textContent = "Preparing…";
  performance.clearResourceTimings();
  const host = document.createElement("div");
  host.className = "fixture";
  host.innerHTML = Array.from({ length: 10 }, (_, i) => {
    const family = families[i % families.length];
    return `<article><div class="specimen" style="font-family:'${family}';font-weight:${i % 2 ? 700 : 400}">Page ${i + 1}: Aa Wmi</div><div class="specimen" style="font:italic 48px/100px 'Playfair Display'">ĀęĐ curious.</div><p style="font:16px 'DM Sans'">A readable page with several styles.</p></article>`;
  }).join("");
  document.querySelector("#fixture").replaceChildren(host);
  const errors = [],
    captures = [],
    turns = [];
  const book = new Core(host, {
    width: 500,
    height: 350,
    textureScale: 1,
    duration: 80,
    preload: false,
    worker: new URLSearchParams(location.search).get("worker") === "true",
    onError: (e) => errors.push(e.message),
  });
  let embeddedBytes = 0,
    embeddingJobs = 0;
  const embed = book._embedURLs.bind(book);
  book._embedURLs = (...args) => {
    if (args[0].startsWith("@font-face")) embeddingJobs++;
    return embed(...args);
  };
  const font = book._fontStyles.bind(book);
  book._fontStyles = async (...args) => {
    const css = await font(...args);
    embeddedBytes += css.length;
    return css;
  };
  const started = performance.now();
  try {
    for (let i = 0; i < 10; i++) {
      const before = performance.now();
      await book._snapshot(i);
      captures.push(Math.round(performance.now() - before));
    }
    const preparationMs = Math.round(performance.now() - started);
    const jobsBeforeEdit = embeddingJobs;
    host.querySelector("p").textContent =
      "Different Latin text, the same fonts.";
    book.refresh([0]);
    await book._snapshot(0);
    const editEmbeddingJobs = embeddingJobs - jobsBeforeEdit;
    for (let i = 0; i < 8; i++) {
      const start = performance.now();
      let latency;
      const draw = book.renderer.draw.bind(book.renderer);
      book.renderer.draw = (...args) => {
        latency ??= performance.now() - start;
        return draw(...args);
      };
      i < 4 ? book.next() : book.prev();
      while (book.isAnimating || book.current !== book.desired) {
        if (performance.now() - start > 30000) throw Error("Turn timed out");
        await sleep(10);
      }
      book.renderer.draw = draw;
      turns.push(Math.round((latency ?? 0) * 10) / 10);
    }
    out.textContent = JSON.stringify(
      {
        version: baseline ? "baseline" : "current",
        worker: book.options.worker,
        families,
        capturesMs: captures,
        preparationMs,
        embeddedFontKB: Math.round(embeddedBytes / 1024),
        embeddingJobs,
        editEmbeddingJobs,
        preparedTurnMs: turns,
        fontRequests: performance
          .getEntriesByType("resource")
          .filter((r) => r.name.includes("fonts.gstatic.com")).length,
        errors,
      },
      null,
      2,
    );
    out.dataset.complete = "true";
  } catch (e) {
    out.textContent += "\nFAIL " + e.message;
  } finally {
    book.destroy();
    document.querySelector("#run").disabled = false;
  }
};
