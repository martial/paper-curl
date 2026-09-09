// SPDX-License-Identifier: Apache-2.0
import Core from "paper-curl";
import "paper-curl/paper-curl.css";
const out = document.querySelector("#results");
const photo =
  "https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=1000&auto=format&fit=crop&q=85";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const page = (i) =>
  `<article><p>FIELD NOTES · ${i}</p><h2>A slower kind of story.</h2>${i % 2 ? '<p>Take the long way home. Follow the street that looks like it leads nowhere.</p><p style="font-weight:500">Room to breathe.</p>' : `<img src="${photo}" alt="Coast">`}<p style="font-style:italic;font-family:'Playfair Display'">Stay curious.</p></article>`;
document.querySelector("#run").onclick = async () => {
  document.querySelector("#run").disabled = true;
  out.textContent = "Measuring…";
  const host = document.createElement("div");
  host.className = "fixture";
  host.innerHTML = Array.from({ length: 8 }, (_, i) => page(i)).join("");
  document.querySelector("#fixture").replaceChildren(host);
  await Promise.all([...host.querySelectorAll("img")].map((i) => i.decode()));
  await document.fonts.ready;
  const entries = [],
    errors = [],
    frameCosts = [];
  const options = {
    width: 420,
    height: 594,
    duration: 100,
    preload: new URLSearchParams(location.search).get("preload") === "true",
    onError: (e) => errors.push(e.message),
  };
  const book = new Core(host, options);
  const counts = { snapshots: 0, fontBytes: 0 };
  const snap = book._snapshot.bind(book);
  book._snapshot = async (i) => {
    if (!book.cache.has(i)) counts.snapshots++;
    return snap(i);
  };
  const font = book._fontStyles.bind(book);
  book._fontStyles = async (...args) => {
    const value = await font(...args);
    counts.fontBytes = Math.max(counts.fontBytes, value.length);
    return value;
  };
  await sleep(1500);
  async function measure(label, action) {
    const start = performance.now();
    let delay = null;
    const draw = book.renderer.draw.bind(book.renderer);
    book.renderer.draw = (...args) => {
      if (delay === null) delay = performance.now() - start;
      const before = performance.now();
      const result = draw(...args);
      frameCosts.push(performance.now() - before);
      return result;
    };
    action();
    const deadline = performance.now() + 30000;
    while (book.isAnimating || book.current !== book.desired) {
      if (performance.now() > deadline) throw Error("Timed out");
      await sleep(10);
    }
    book.renderer.draw = draw;
    entries.push({ label, ms: Math.round(delay ?? performance.now() - start) });
    out.textContent = entries.map((e) => `${e.label}: ${e.ms} ms`).join("\n");
  }
  try {
    await measure("First next", () => book.next());
    await sleep(600);
    await measure("Second next", () => book.next());
    await sleep(600);
    await measure("Cached previous", () => book.prev());
    host.querySelector("h2").textContent = "Edited cover";
    if (new URLSearchParams(location.search).get("targeted") === "true")
      book.refresh([0]);
    else book.refresh();
    await measure("Next after editing cover", () => book.next());
    const resources = performance
      .getEntriesByType("resource")
      .filter((r) => r.name.includes("fonts.gstatic.com"));
    frameCosts.sort((a, b) => a - b);
    out.textContent +=
      "\n" +
      JSON.stringify({
        options,
        counts,
        fontRequests: resources.length,
        drawMsP95: frameCosts[Math.floor(frameCosts.length * 0.95)],
        errors,
      });
    out.dataset.complete = "true";
  } catch (e) {
    out.textContent += "\nFAIL " + e.message;
  } finally {
    document.querySelector("#run").disabled = false;
    book.destroy();
  }
};
