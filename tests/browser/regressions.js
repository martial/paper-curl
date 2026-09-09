// SPDX-License-Identifier: Apache-2.0
import Core from "../../paper-curl.mjs";
const results = document.querySelector("#results"),
  fixtures = document.querySelector("#fixtures");
const assert = (value, message) => {
  if (!value) throw Error(message);
};
const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function settled(book) {
  const deadline = performance.now() + 15000;
  do {
    await sleep(10);
    if (performance.now() > deadline) throw Error("navigation did not settle");
  } while (book.isAnimating || book.current !== book.desired);
  await frame();
}
const pixel = (canvas, x, y) => [
  ...canvas.getContext("2d").getImageData(x, y, 1, 1).data,
];
const red = (p) => p[0] > 230 && p[1] < 70 && p[2] < 40;
const blue = (p) => p[0] < 30 && p[1] < 100 && p[2] > 230;
function colorCount(canvas, matches) {
  const { data } = canvas
    .getContext("2d")
    .getImageData(0, 0, canvas.width, canvas.height);
  let count = 0;
  for (let i = 0; i < data.length; i += 4)
    if (matches(data.subarray(i, i + 4))) count++;
  return count;
}
const img = (url) => `<img src="${url}" alt="Fixture">`;
const origin = "http://127.0.0.1:8771";
async function fixture(pages, options = {}) {
  const host = document.createElement("div");
  host.className = "fixture";
  host.innerHTML = pages.map((page) => `<article>${page}</article>`).join("");
  fixtures.append(host);
  await Promise.all(
    [...host.querySelectorAll("img")].map((image) =>
      image.decode().catch(() => {}),
    ),
  );
  const errors = [];
  const book = new Core(host, {
    width: 400,
    height: 400,
    textureScale: 1,
    duration: 45,
    preload: false,
    onError: (e) => errors.push(e.message),
    ...options,
  });
  const close = () => {
    book.destroy();
    host.remove();
  };
  return { host, book, errors, close };
}
function inkWidth(canvas) {
  const { data, width, height } = canvas
    .getContext("2d")
    .getImageData(0, 0, canvas.width, canvas.height);
  let min = width,
    max = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (
        data[i] < 90 &&
        data[i + 1] < 90 &&
        data[i + 2] < 90 &&
        data[i + 3] > 180
      ) {
        min = Math.min(min, x);
        max = Math.max(max, x);
      }
    }
  return max - min + 1;
}
document.querySelector("#run").onclick = async () => {
  const button = document.querySelector("#run");
  button.disabled = true;
  results.textContent = "";
  document.querySelector("#proof").replaceChildren();
  let passed = 0,
    failed = 0;
  async function check(name, run) {
    try {
      await run();
      passed++;
      results.textContent += `PASS ${name}\n`;
    } catch (e) {
      failed++;
      results.textContent += `FAIL ${name}: ${e.message}\n`;
    }
  }
  // Rules intentionally live outside the captured page. Inline declarations
  // alone would survive cloneNode and hide missing computed-style properties.
  const strokeStyles = document.createElement("style");
  strokeStyles.textContent = `
    .stroke-text {
      --ink: rgb(255, 0, 0);
      font: 700 100px/140px Arial, sans-serif;
      padding: 20px;
      color: rgb(0, 0, 255);
      -webkit-text-stroke: 3px var(--ink);
      -webkit-text-fill-color: transparent;
    }
    .stroke-filled { -webkit-text-stroke-width: 12px; -webkit-text-fill-color: currentColor; }
    .stroke-behind { paint-order: stroke fill; }
    .stroke-vector {
      --ink: rgb(255, 0, 0);
      fill: rgb(0, 0, 255);
      stroke: var(--ink);
      stroke-width: 12px;
    }
    .stroke-vector line { stroke-width: 20px; stroke-linecap: round; stroke-dasharray: 30px 30px; stroke-dashoffset: 10px; }
    .stroke-vector polyline { fill: none; stroke-linejoin: round; }
    .stroke-border {
      position: absolute; left: 40px; top: 40px; width: 160px; height: 120px;
      border-top: 10px solid red; border-right: 10px solid blue;
      border-bottom: 10px solid blue; border-left: 10px solid red;
      outline: 5px solid rgb(0, 128, 0); outline-offset: 5px;
    }
  `;
  document.head.append(strokeStyles);
  for (const worker of [false, true]) {
    await check(
      `CSS text strokes, inherited fill and paint order survive capture (worker=${worker})`,
      async () => {
        const f = await fixture(
          [
            '<div class="stroke-text"><span>OOO</span></div>',
            '<div class="stroke-text stroke-filled"><span>OOO</span></div>',
            '<div class="stroke-text stroke-filled stroke-behind"><span>OOO</span></div>',
          ],
          { worker },
        );
        try {
          const hollow = await f.book._snapshot(0);
          assert(colorCount(hollow, red) > 800, "text stroke disappeared");
          assert(
            colorCount(hollow, blue) === 0,
            "transparent text fill was lost",
          );
          const front = await f.book._snapshot(1),
            behind = await f.book._snapshot(2);
          assert(
            colorCount(front, blue) > 500,
            "currentColor text fill was lost",
          );
          assert(
            colorCount(behind, red) > 800,
            "stroke-first outline disappeared",
          );
          assert(
            colorCount(behind, red) < colorCount(front, red) * 0.85,
            "paint-order did not place the stroke behind the fill",
          );
          assert(
            colorCount(behind, blue) > colorCount(front, blue) * 1.15,
            "paint-order changed the fill incorrectly",
          );
        } finally {
          f.close();
        }
      },
    );
    await check(
      `CSS SVG strokes preserve color, width, caps, joins and dashes (worker=${worker})`,
      async () => {
        const f = await fixture(
          [
            '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><g class="stroke-vector"><rect x="40" y="40" width="120" height="80"/><line x1="40" y1="180" x2="240" y2="180"/><polyline points="50,300 100,250 150,300"/></g></svg>',
          ],
          { worker },
        );
        try {
          const canvas = await f.book._snapshot(0);
          assert(
            red(pixel(canvas, 36, 80)),
            "SVG stroke width/color disappeared",
          );
          assert(blue(pixel(canvas, 100, 80)), "SVG CSS fill disappeared");
          assert(red(pixel(canvas, 34, 180)), "round line cap disappeared");
          assert(
            red(pixel(canvas, 54, 180)),
            "dash offset shifted the visible dash",
          );
          assert(
            !red(pixel(canvas, 75, 180)),
            "dash gap or offset disappeared",
          );
          assert(red(pixel(canvas, 96, 180)), "next dash disappeared");
          assert(red(pixel(canvas, 100, 247)), "rounded join disappeared");
          assert(!red(pixel(canvas, 100, 243)), "round join became a miter");
        } finally {
          f.close();
        }
      },
    );
    await check(
      `CSS borders retain different sides and offset outlines (worker=${worker})`,
      async () => {
        const f = await fixture(['<div class="stroke-border"></div>'], {
          worker,
        });
        try {
          const canvas = await f.book._snapshot(0);
          assert(
            red(pixel(canvas, 100, 45)) && red(pixel(canvas, 45, 100)),
            "top/left borders disappeared",
          );
          assert(
            blue(pixel(canvas, 195, 100)) && blue(pixel(canvas, 100, 155)),
            "right/bottom borders disappeared",
          );
          const green = pixel(canvas, 32, 100);
          assert(
            green[0] < 20 && green[1] > 110 && green[1] < 150 && green[2] < 20,
            "offset outline disappeared",
          );
          assert(
            pixel(canvas, 37, 100)
              .slice(0, 3)
              .every((v) => v > 240),
            "outline offset gap disappeared",
          );
        } finally {
          f.close();
        }
      },
    );
  }
  strokeStyles.remove();
  await check(
    "real worker encoding preserves font/image pixels and reports preparation stages",
    async () => {
      const f = await fixture(
        [
          img(origin + "/red.svg"),
          `<div style="font:80px Bungee;color:black">iiiiii</div>`,
        ],
        { worker: true },
      );
      const updates = [];
      try {
        assert(
          await f.book.prepare(undefined, {
            onProgress: (p) => updates.push(p),
          }),
          "prepare failed",
        );
        assert(f.book.assetWorker instanceof Worker, "real worker not running");
        assert(
          red(pixel(await f.book._snapshot(0), 100, 100)),
          "worker image encoding changed pixels",
        );
        const reference = document.createElement("canvas");
        reference.width = reference.height = 400;
        const c = reference.getContext("2d");
        c.fillStyle = "white";
        c.fillRect(0, 0, 400, 400);
        c.fillStyle = "black";
        c.font = "80px Bungee";
        c.fillText("iiiiii", 0, 100);
        assert(
          Math.abs(inkWidth(await f.book._snapshot(1)) - inkWidth(reference)) <
            4,
          "worker font mismatch",
        );
        for (const phase of ["assets", "layout", "encoding", "rasterizing"])
          assert(
            updates.some((p) => p.phase === phase),
            `missing ${phase} progress`,
          );
        assert(
          updates.at(-1).status === "ready" && updates.at(-1).progress === 1,
          "missing ready status",
        );
        assert(
          updates.every((p, i) => !i || p.progress >= updates[i - 1].progress),
          "progress went backwards",
        );
        assert(f.book.workerJobs.size === 0, "worker jobs leaked");
        const slow = f.book._encode(
          "svg",
          "<svg>" + "x".repeat(500000) + "</svg>",
        );
        f.book.destroy();
        let rejected = false;
        try {
          await slow;
        } catch {
          rejected = true;
        }
        assert(
          rejected && !f.book.assetWorker && !f.book.workerJobs.size,
          "worker destroy did not settle pending work",
        );
      } finally {
        f.close();
      }
    },
  );
  await check(
    "CSP-blocked worker falls back without breaking capture or progress",
    async () => {
      const iframe = document.createElement("iframe");
      iframe.src = "./worker-fallback.html";
      fixtures.append(iframe);
      try {
        const deadline = performance.now() + 10000;
        while (
          !iframe.contentDocument?.querySelector("#result")?.dataset.status
        ) {
          if (performance.now() > deadline)
            throw Error("worker fallback fixture timed out");
          await sleep(20);
        }
        const result = iframe.contentDocument.querySelector("#result");
        assert(result.dataset.status === "pass", result.textContent);
      } finally {
        iframe.remove();
      }
    },
  );
  await check("remote CORS image survives the real page snapshot", async () => {
    const f = await fixture([
      img(origin + "/red.svg"),
      img(origin + "/blue.svg"),
    ]);
    try {
      assert(f.book.renderer, "WebGL unavailable");
      assert(
        red(pixel(await f.book._snapshot(0), 100, 100)),
        "image disappeared",
      );
    } finally {
      f.close();
    }
  });
  await check(
    "picture/source, srcset and lazy images keep their displayed source",
    async () => {
      const f = await fixture([
        `<picture><source srcset="${origin}/blue.svg" media="(min-width: 1px)"><img src="${origin}/red.svg" loading="lazy"></picture>`,
        `<img src="${origin}/red.svg" srcset="${origin}/blue.svg 1x" loading="lazy">`,
      ]);
      try {
        for (let i = 0; i < 2; i++)
          assert(
            blue(pixel(await f.book._snapshot(i), 100, 100)),
            `responsive source wrong on page ${i}`,
          );
      } finally {
        f.close();
      }
    },
  );
  await check("remote CSS background image survives capture", async () => {
    const f = await fixture([
      `<div style="width:100%;height:100%;background:url('${origin}/red.svg') center/cover"></div>`,
    ]);
    try {
      assert(
        red(pixel(await f.book._snapshot(0), 100, 100)),
        "background missing",
      );
    } finally {
      f.close();
    }
  });
  await check("SVG image elements embed remote href assets", async () => {
    const f = await fixture([
      `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><image href="${origin}/red.svg" width="400" height="400"/></svg>`,
    ]);
    try {
      assert(
        red(pixel(await f.book._snapshot(0), 100, 100)),
        "SVG image missing",
      );
    } finally {
      f.close();
    }
  });
  await check(
    "Google Font glyphs match the live font instead of a fallback",
    async () => {
      await document.fonts.load("80px Bungee");
      await document.fonts.ready;
      const text = "iiiiii";
      const f = await fixture([
        `<div style="font:80px/120px Bungee,serif;color:black;white-space:nowrap">${text}</div>`,
      ]);
      try {
        const actual = await f.book._snapshot(0);
        const reference = document.createElement("canvas");
        reference.width = reference.height = 400;
        const c = reference.getContext("2d");
        c.fillStyle = "white";
        c.fillRect(0, 0, 400, 400);
        c.fillStyle = "black";
        c.font = "80px Bungee";
        c.fillText(text, 0, 100);
        const fallback = document.createElement("canvas");
        fallback.width = fallback.height = 400;
        const fc = fallback.getContext("2d");
        fc.fillStyle = "white";
        fc.fillRect(0, 0, 400, 400);
        fc.fillStyle = "black";
        fc.font = "80px serif";
        fc.fillText(text, 0, 100);
        const a = inkWidth(actual),
          r = inkWidth(reference),
          b = inkWidth(fallback);
        document.querySelector("#proof").append(actual, reference);
        assert(
          Math.abs(r - b) > 10,
          "font fixture does not distinguish fallback",
        );
        assert(
          Math.abs(a - r) < 4,
          `captured ink ${a}px, web font ${r}px, fallback ${b}px`,
        );
      } finally {
        f.close();
      }
    },
  );
  await check("extended Latin glyphs survive font subsetting", async () => {
    const text = "ĀęĐ";
    await document.fonts.load("80px Bungee", text);
    const f = await fixture([
      `<div style="font:80px/120px Bungee,serif;color:black;white-space:nowrap">${text}</div>`,
    ]);
    try {
      const captured = await f.book._snapshot(0);
      const reference = document.createElement("canvas");
      reference.width = reference.height = 400;
      const context = reference.getContext("2d");
      context.fillStyle = "white";
      context.fillRect(0, 0, 400, 400);
      context.fillStyle = "black";
      context.font = "80px Bungee";
      context.fillText(text, 0, 100);
      assert(
        Math.abs(inkWidth(captured) - inkWidth(reference)) < 4,
        "needed font subset missing",
      );
    } finally {
      f.close();
    }
  });
  await check(
    "mixed font styles and variable weights match native glyphs",
    async () => {
      for (const [family, weight, style] of [
        ["Raleway", 350, "italic"],
        ["Raleway", 650, "normal"],
        ["DM Sans", 650, "normal"],
        ["DM Sans", 350, "italic"],
        ["Space Mono", 700, "italic"],
        ["Bungee", 700, "normal"],
      ]) {
        const text = "Wmi ĀęĐ",
          font = `${style} ${weight} 48px '${family}'`;
        const f = await fixture([
          `<div style="font:${font};font-feature-settings:'kern';line-height:80px;white-space:nowrap">${text}</div>`,
        ]);
        try {
          const captured = await f.book._snapshot(0);
          const reference = document.createElement("canvas");
          reference.width = reference.height = 400;
          const c = reference.getContext("2d");
          c.fillStyle = "white";
          c.fillRect(0, 0, 400, 400);
          c.fillStyle = "black";
          c.font = font;
          c.fillText(text, 0, 70);
          document.querySelector("#proof").append(captured, reference);
          assert(
            Math.abs(inkWidth(captured) - inkWidth(reference)) < 4,
            `${family} ${weight} ${style}: captured ${inkWidth(captured)}px, native ${inkWidth(reference)}px`,
          );
          const used = [...f.book.fontCache.keys()].join("\n");
          if (style === "normal")
            assert(
              !used.includes("font-style: italic"),
              "unused italic face embedded",
            );
          if (family !== "DM Sans")
            assert(
              !used.includes('font-family: "DM Sans"'),
              "container font embedded without text",
            );
        } finally {
          f.close();
        }
      }
    },
  );
  await check(
    "explicit fontCSS handles programmatic fonts without fetching unrelated sheets",
    async () => {
      const source = await fetch(
        "https://fonts.googleapis.com/css2?family=Bungee",
      ).then((r) => r.text());
      const rules = new CSSStyleSheet();
      rules.replaceSync(source);
      const rule = [...rules.cssRules].find((r) =>
        r.style?.getPropertyValue("unicode-range").includes("U+0-FF"),
      );
      assert(rule, "Latin font rule missing");
      const family = "Programmatic Display";
      const face = new FontFace(family, rule.style.getPropertyValue("src"), {
        unicodeRange: rule.style.getPropertyValue("unicode-range"),
      });
      document.fonts.add(face);
      const f = await fixture(
        [
          `<div style="font:48px '${family}';font-stretch:91.5%">Programmatic</div>`,
        ],
        {
          fontCSS: rule.cssText.replace(
            /font-family:[^;]+;/,
            `font-family: '${family}';`,
          ),
        },
      );
      try {
        const captured = await f.book._snapshot(0);
        assert(inkWidth(captured) > 200, "programmatic font missing");
        assert(f.book.styleSheets.size === 0, "unrelated external CSS fetched");
        assert(f.book.fontCache.size === 1, "wrong font face count");
      } finally {
        f.close();
        document.fonts.delete(face);
      }
    },
  );
  await check(
    "a stalled unrelated font does not block page capture",
    async () => {
      const slow = new FontFace(
        "Unrelated Slow Font",
        `url('${origin}/slow-font?${Date.now()}')`,
      );
      document.fonts.add(slow);
      slow.load().catch(() => {});
      const f = await fixture([
        `<div style="font:48px Bungee">Fast page</div>`,
      ]);
      try {
        assert(slow.status === "loading", "slow font did not start");
        const captured = await f.book._snapshot(0);
        assert(
          slow.status === "loading",
          "capture waited for an unrelated font",
        );
        assert(inkWidth(captured) > 100, "page text missing");
      } finally {
        f.close();
        document.fonts.delete(slow);
      }
    },
  );
  await check(
    "editing Latin text reuses embedded faces and leaves warm turns ready",
    async () => {
      const f = await fixture([
        `<div style="font:48px Bungee">First title</div>`,
        `<p style="font:italic 48px 'Space Mono'">Second</p>`,
      ]);
      try {
        assert(await f.book.prepare(), "explicit preparation failed");
        let embeds = 0;
        const embed = f.book._embedURLs.bind(f.book);
        f.book._embedURLs = (...args) => {
          if (args[0].startsWith("@font-face")) embeds++;
          return embed(...args);
        };
        f.book.pages[0].firstChild.textContent = "Changed title";
        f.book.refresh(0);
        assert(await f.book.prepare(), "edited preparation failed");
        assert(embeds === 0, "same faces embedded again after an edit");
        let misses = 0;
        const snapshot = f.book._snapshot.bind(f.book);
        f.book._snapshot = (i) => {
          if (!f.book.cache.has(i)) misses++;
          return snapshot(i);
        };
        assert(await f.book._prepare(1), "turn failed");
        assert(misses === 0, "prepared turn captured text on click");
      } finally {
        f.close();
      }
    },
  );
  await check(
    "nearby preloaded pages need no new capture when clicked",
    async () => {
      const f = await fixture(
        Array.from({ length: 8 }, (_, i) =>
          img(origin + (i % 2 ? "/blue.svg" : "/red.svg")),
        ),
      );
      try {
        await f.book._preload();
        assert(f.book.cache.size === 2, "startup prepared distant pages");
        let misses = 0;
        const snapshot = f.book._snapshot.bind(f.book);
        f.book._snapshot = (index) => {
          if (!f.book.cache.has(index)) misses++;
          return snapshot(index);
        };
        assert(await f.book._prepare(1), "warm turn failed");
        assert(misses === 0, "clicked turn recaptured ready pages");
      } finally {
        f.close();
      }
    },
  );
  await check(
    "both faces upload to WebGL and remain visible through the curl",
    async () => {
      const f = await fixture([
        img(origin + "/red.svg"),
        img(origin + "/blue.svg"),
        img(origin + "/red.svg"),
        img(origin + "/blue.svg"),
      ]);
      try {
        assert(
          await f.book._prepare(1),
          "prepare failed: " + f.errors.join(","),
        );
        const gl = f.book.renderer.gl,
          canvas = f.book.renderer.canvas;
        for (const progress of [0.02, 0.3, 0.65, 0.98]) {
          f.book._draw(progress);
          const pixels = new Uint8Array(canvas.width * canvas.height * 4);
          gl.readPixels(
            0,
            0,
            canvas.width,
            canvas.height,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            pixels,
          );
          let colored = 0;
          for (let i = 0; i < pixels.length; i += 4)
            if (pixels[i + 3] > 200 && (pixels[i] > 120 || pixels[i + 2] > 120))
              colored++;
          assert(colored > 1000, `blank WebGL page at ${progress}`);
        }
      } finally {
        f.close();
      }
    },
  );
  await check(
    "24 full turns, rapid reversal, last → first leave one cover and no layer",
    async () => {
      const f = await fixture(
        Array.from({ length: 6 }, (_, i) =>
          img(origin + (i % 2 ? "/blue.svg" : "/red.svg")),
        ),
      );
      try {
        for (let i = 0; i < 12; i++) {
          f.book.last();
          await settled(f.book);
          f.book.first();
          await settled(f.book);
        }
        f.book.next();
        f.book.last();
        f.book.first();
        await settled(f.book);
        assert(f.book.page === 0, "wrong destination");
        assert(f.book.renderer.canvas.hidden, "curl canvas left visible");
        assert(
          f.host.querySelectorAll(".pc-page:not([hidden])").length === 1,
          "extra native page",
        );
        assert(!f.host.querySelector(".pc-capture"), "capture leaked");
        assert(!f.errors.length, f.errors.join(","));
      } finally {
        f.close();
      }
    },
  );
  await check(
    "CORS-blocked images preserve native pages and report an actionable error",
    async () => {
      const f = await fixture([
        img(origin + "/blocked.svg"),
        img(origin + "/blue.svg"),
        img(origin + "/red.svg"),
        img(origin + "/blue.svg"),
      ]);
      try {
        f.book.next();
        await settled(f.book);
        assert(
          f.errors.some((e) => e.includes("CORS")),
          "missing CORS error",
        );
        assert(f.book.page === 1, "fallback failed");
        assert(f.book.renderer.canvas.hidden, "blank layer remains");
        assert(
          f.host.querySelectorAll(".pc-page:not([hidden])").length === 2,
          "native fallback not visible",
        );
        f.book.first();
        await settled(f.book);
        assert(f.book.page === 0, "cover not restored");
      } finally {
        f.close();
      }
    },
  );
  await check(
    "content refresh and destroy cancel in-flight captures",
    async () => {
      const f = await fixture([
        img(origin + "/red.svg"),
        img(origin + "/blue.svg"),
      ]);
      try {
        f.book.next();
        f.book.refresh();
        await settled(f.book);
        assert(f.book.page === 0, "obsolete turn revived");
        f.book.next();
        f.book.destroy();
        await sleep(200);
        assert(!f.host.querySelector(".pc-curl"), "canvas leaked");
        assert(!f.host.querySelector(".pc-capture"), "capture leaked");
      } finally {
        f.close();
      }
    },
  );
  results.textContent += `\n${passed} passed, ${failed} failed.`;
  results.dataset.passed = passed;
  results.dataset.failed = failed;
  button.disabled = false;
};
