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
