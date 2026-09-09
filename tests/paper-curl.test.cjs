const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const source = fs.readFileSync(
  path.join(__dirname, "../paper-curl.js"),
  "utf8",
);

async function fixture(options = {}) {
  const { Window } = await import("happy-dom");
  const window = new Window();
  window.document.body.innerHTML =
    '<div id="book">' +
    Array.from(
      { length: 8 },
      (_, i) => `<article id="p${i}"><h2>Page ${i}</h2></article>`,
    ).join("") +
    "</div>";
  const root = window.document.querySelector("#book");
  root.getBoundingClientRect = () => ({
    width: 1000,
    height: 800,
    left: 0,
    top: 0,
  });
  window.HTMLCanvasElement.prototype.getContext = () => null;
  window.HTMLElement.prototype.setPointerCapture = function () {};
  window.HTMLElement.prototype.releasePointerCapture = function () {};
  window.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
  let clock = 0,
    id = 0;
  const frames = new Map();
  Object.defineProperty(window.performance, "now", {
    value: () => clock,
    configurable: true,
  });
  window.requestAnimationFrame = (callback) => {
    frames.set(++id, callback);
    return id;
  };
  window.cancelAnimationFrame = (handle) => frames.delete(handle);
  window.eval(source);
  const changes = [],
    errors = [];
  const book = new window.PaperCurl(root, {
    preload: false,
    onChange: (state) => changes.push(state),
    onError: (error) => errors.push(error),
    ...options,
  });
  const canvas = window.document.createElement("canvas");
  canvas.className = "pc-curl";
  canvas.hidden = true;
  book.center.append(canvas);
  const renderer = {
    uploads: 0,
    cleared: 0,
    canvas,
    setPages() {
      this.uploads++;
      canvas.hidden = false;
    },
    draw() {},
    clear() {
      this.cleared++;
      canvas.hidden = true;
    },
    dispose() {
      this.clear();
      canvas.remove();
    },
  };
  book.renderer = renderer;
  book._snapshot = async () => window.document.createElement("canvas");
  book.book.getBoundingClientRect = () => ({
    width: book.width * 2,
    height: book.height,
    left: 0,
    top: 0,
  });
  async function drain() {
    for (let i = 0; i < 1000; i++) {
      await new Promise((resolve) => setImmediate(resolve));
      clock += 40;
      const batch = [...frames.values()];
      frames.clear();
      batch.forEach((callback) => callback(clock));
      await new Promise((resolve) => setImmediate(resolve));
      if (!book.isAnimating && !frames.size) return;
    }
    throw new Error("Page animation did not settle");
  }
  const visible = () => book.wrappers.filter((page) => !page.hidden);
  const close = () => {
    book.destroy();
    window.happyDOM.abort();
  };
  return {
    window,
    root,
    book,
    renderer,
    changes,
    errors,
    drain,
    visible,
    close,
  };
}

test("front cover is centered and only its native page is visible", async () => {
  const f = await fixture();
  assert.equal(f.book.page, 0);
  assert.equal(f.book.spreadCount, 5);
  assert.equal(f.visible().length, 1);
  assert.equal(
    f.book.center.style.transform,
    `translateX(${-f.book.width / 2}px)`,
  );
  f.close();
});

test("navigation reaches both bounds and clears the turning layer", async () => {
  const f = await fixture();
  f.book.last();
  await f.drain();
  assert.equal(f.book.page, 7);
  assert.equal(f.visible().length, 1);
  f.book.first();
  await f.drain();
  assert.equal(f.book.page, 0);
  assert.equal(f.visible().length, 1);
  assert.equal(f.renderer.canvas.hidden, true);
  assert.equal(f.book.active, null);
  assert.equal(f.root.hasAttribute("aria-busy"), false);
  f.book.prev();
  await f.drain();
  assert.equal(f.book.page, 0);
  f.close();
});

test("rapid direction changes settle at the latest requested destination", async () => {
  const f = await fixture();
  f.book.next();
  f.book.next();
  f.book.prev();
  await f.drain();
  assert.equal(f.book.spread, 1);
  assert.equal(f.visible().length, 2);
  f.book.last();
  await new Promise((resolve) => setImmediate(resolve));
  f.book.first();
  await f.drain();
  assert.equal(f.book.spread, 0);
  assert.equal(f.renderer.canvas.hidden, true);
  f.close();
});

test("return to cover while page images are still preparing leaves no layer", async () => {
  const f = await fixture();
  let resolve;
  const pending = new Promise((done) => {
    resolve = done;
  });
  f.book._snapshot = () => pending;
  f.book.next();
  assert.equal(f.book.loading, true);
  f.book.first();
  resolve(f.window.document.createElement("canvas"));
  await f.drain();
  assert.equal(f.book.page, 0);
  assert.equal(f.visible().length, 1);
  assert.equal(f.renderer.canvas.hidden, true);
  f.close();
});

test("navigation can interrupt a drag during asynchronous image preparation", async () => {
  const f = await fixture();
  let resolve;
  const pending = new Promise((done) => {
    resolve = done;
  });
  f.book._snapshot = () => pending;
  f.book.book.dispatchEvent(
    new f.window.PointerEvent("pointerdown", {
      button: 0,
      pointerId: 1,
      clientX: f.book.width * 2 - 3,
      clientY: f.book.height - 3,
      bubbles: true,
    }),
  );
  assert.ok(f.book.drag);
  f.book.first();
  resolve(f.window.document.createElement("canvas"));
  await f.drain();
  assert.equal(f.book.page, 0);
  assert.equal(f.book.drag, null);
  assert.equal(f.renderer.canvas.hidden, true);
  f.close();
});

test("refresh invalidates pending captures without reviving an obsolete animation", async () => {
  const f = await fixture();
  let resolve;
  const pending = new Promise((done) => {
    resolve = done;
  });
  f.book._snapshot = () => pending;
  f.book.next();
  f.book.refresh();
  resolve(f.window.document.createElement("canvas"));
  await f.drain();
  assert.equal(f.book.page, 0);
  assert.equal(f.renderer.uploads, 0);
  assert.equal(f.book.isAnimating, false);
  f.close();
});

test("destroy restores original elements and cancels pending work", async () => {
  const f = await fixture();
  const originals = [...f.book.pages];
  let resolve;
  const pending = new Promise((done) => {
    resolve = done;
  });
  f.book._snapshot = () => pending;
  f.book.next();
  f.book.destroy();
  resolve(f.window.document.createElement("canvas"));
  await new Promise((done) => setImmediate(done));
  assert.deepEqual([...f.root.children], originals);
  assert.equal(f.root.querySelector(".pc-curl"), null);
  assert.equal(f.renderer.uploads, 0);
  assert.equal(f.root.hasAttribute("tabindex"), false);
  f.window.happyDOM.abort();
});

test("ordinary two-page mode starts without a single cover", async () => {
  const f = await fixture({ showCover: false });
  assert.equal(f.book.spreadCount, 4);
  assert.equal(f.visible().length, 2);
  assert.deepEqual([...f.book.state.pages], [0, 1]);
  f.close();
});

test("zero-duration turns still perform cleanup", async () => {
  const f = await fixture({ duration: 0 });
  f.book.goTo(5);
  await f.drain();
  assert.equal(f.book.page, 5);
  assert.equal(f.renderer.canvas.hidden, true);
  f.close();
});

test("page geometry is finite, continuous at the spine, and flat at both endpoints", () => {
  const context = { module: { exports: {} } };
  context.globalThis = context;
  vm.runInNewContext(
    source.replace(
      /global\.PaperCurl\s*=\s*PaperCurl;/,
      "global.SheetRenderer=SheetRenderer;global.PaperCurl=PaperCurl;",
    ),
    context,
  );
  const sheet = Object.create(context.SheetRenderer.prototype);
  Object.assign(sheet, {
    cols: 112,
    rows: 32,
    designWidth: 450,
    designHeight: 636,
    curl: 1.72,
    vertices: new Float32Array(113 * 33 * 8),
    gl: { bindBuffer() {}, bufferSubData() {} },
  });
  for (const progress of [0, 0.1, 0.3, 0.5, 0.7, 0.9, 1])
    for (const corner of [-1, 1]) {
      sheet.geometry(progress, corner);
      assert.ok(sheet.vertices.every(Number.isFinite));
      for (let row = 0; row <= sheet.rows; row++) {
        const spine = row * (sheet.cols + 1) * 8;
        assert.ok(Math.abs(sheet.vertices[spine]) < 0.001);
        assert.ok(Math.abs(sheet.vertices[spine + 2]) < 0.001);
      }
      if (progress === 0 || progress === 1)
        for (let i = 0; i < sheet.vertices.length; i += 8) {
          assert.ok(Math.abs(sheet.vertices[i + 2]) < 0.001);
          assert.ok(
            Math.abs(
              sheet.vertices[i] -
                sheet.vertices[i + 6] * 450 * (progress === 0 ? 1 : -1),
            ) < 0.001,
          );
        }
    }
});

test("targeted refresh preserves unaffected textures and downloaded assets", async () => {
  const f = await fixture();
  const cached = Promise.resolve(f.window.document.createElement("canvas"));
  f.book.cache.set(0, cached);
  f.book.cache.set(1, cached);
  f.book.assets.set("image", "bytes");
  f.book.fontCache.set("face", "css");
  f.book.styleSheets.set("sheet", "rules");
  f.book.refresh([0]);
  assert.equal(f.book.cache.has(0), false);
  assert.equal(f.book.cache.get(1), cached);
  assert.equal(f.book.assets.get("image"), "bytes");
  assert.equal(f.book.fontCache.get("face"), "css");
  assert.equal(f.book.styleSheets.get("sheet"), "rules");
  f.book.refresh();
  assert.equal(f.book.cache.size, 0);
  assert.equal(f.book.assets.size, 0);
  assert.equal(f.book.fontCache.size, 0);
  assert.equal(f.book.styleSheets.size, 0);
  f.close();
});

test("preloading prioritizes only the next and previous sheets near the current spread", async () => {
  const f = await fixture({ startPage: 5 });
  const pages = [];
  f.book._snapshot = async (index) => {
    pages.push(index);
    return f.window.document.createElement("canvas");
  };
  await f.book._preload();
  assert.deepEqual(pages, [6, 7, 4, 5]);
  f.close();
});

test("destroy interrupts a click during background preparation", async () => {
  const f = await fixture();
  let resolve;
  const pending = new Promise((done) => {
    resolve = done;
  });
  const seen = [];
  f.book._snapshot = (index) => {
    seen.push(index);
    return pending;
  };
  const warm = f.book._preload();
  f.book.next();
  f.book.destroy();
  resolve(f.window.document.createElement("canvas"));
  await warm;
  await new Promise((done) => setImmediate(done));
  assert.equal(f.renderer.uploads, 0);
  assert.equal(f.root.querySelector(".pc-curl"), null);
  assert.deepEqual(seen, [0, 1, 0, 1]);
  f.window.happyDOM.abort();
});

test("explicit preparation warms requested pages without navigating", async () => {
  const f = await fixture();
  const pages = [];
  f.book._snapshot = async (index) => {
    pages.push(index);
  };
  assert.equal(await f.book.prepare(), true);
  assert.deepEqual(pages, [0, 1]);
  pages.length = 0;
  assert.equal(await f.book.prepare([3, 3, 4, 5]), true);
  assert.deepEqual(pages, [3, 4, 5]);
  assert.equal(f.book.page, 0);
  assert.equal(f.renderer.uploads, 0);
  await assert.rejects(f.book.prepare([99]), /valid page/);
  f.close();
});

test("preparation reports invalidation and propagates capture failures", async () => {
  const f = await fixture();
  let finish;
  f.book._snapshot = () =>
    new Promise((done) => {
      finish = done;
    });
  const pending = f.book.prepare(0);
  f.book.refresh(0);
  finish();
  assert.equal(await pending, false);
  f.book._snapshot = async () => {
    throw Error("CORS blocked");
  };
  await assert.rejects(f.book.prepare(1), /CORS blocked/);
  f.book.destroy();
  assert.equal(await f.book.prepare(), false);
  f.close();
});
