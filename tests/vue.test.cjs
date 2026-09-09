// SPDX-License-Identifier: Apache-2.0
const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
let Vue, PaperCurl, Core, window, current;

test.before(async () => {
  const { Window } = await import("happy-dom");
  window = new Window();
  for (const name of [
    "window",
    "document",
    "navigator",
    "HTMLElement",
    "Element",
    "SVGElement",
    "Node",
    "MutationObserver",
    "CustomEvent",
    "AbortController",
  ]) {
    Object.defineProperty(globalThis, name, {
      value: name === "window" ? window : window[name],
      configurable: true,
    });
  }
  globalThis.getComputedStyle = window.getComputedStyle.bind(window);
  globalThis.matchMedia = window.matchMedia.bind(window);
  globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window);
  globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
  window.HTMLCanvasElement.prototype.getContext = () => null;
  window.HTMLElement.prototype.getBoundingClientRect = () => ({
    width: 1000,
    height: 800,
    top: 0,
    left: 0,
  });
  Vue = await import("vue");
  ({ default: Core } = await import("../paper-curl.mjs"));
  const original = Core.prototype._rest;
  Core.prototype._rest = function () {
    current = this;
    return original.call(this);
  };
  ({ default: PaperCurl } = await import("../vue/index.mjs"));
});
test.after(() => window?.happyDOM.abort());
async function flush() {
  await Vue.nextTick();
  await new Promise((resolve) => setTimeout(resolve, 5));
  await Vue.nextTick();
}
async function fixture() {
  const items = Vue.ref([0, 1, 2, 3]),
    title = Vue.ref("Original"),
    clicks = Vue.ref(0),
    model = Vue.ref(0);
  const width = Vue.ref(400),
    curl = Vue.ref(1.7),
    visible = Vue.ref(true),
    reference = Vue.ref();
  const changes = [],
    errors = [],
    warnings = [];
  const Child = Vue.defineComponent({
    setup() {
      const count = Vue.ref(0);
      return () =>
        Vue.h(
          "button",
          { onClick: () => count.value++ },
          `Child ${count.value}`,
        );
    },
  });
  const App = {
    setup() {
      return () =>
        visible.value
          ? Vue.h(
              PaperCurl,
              {
                ref: reference,
                width: width.value,
                curl: curl.value,
                preload: false,
                duration: 0,
                modelValue: model.value,
                "onUpdate:modelValue": (value) => (model.value = value),
                onChange: (state) => changes.push(state),
                onError: (error) => errors.push(error),
              },
              {
                default: () => [
                  Vue.h(
                    Vue.Fragment,
                    null,
                    items.value.map((id) =>
                      Vue.h("article", { key: id, "data-page": id }, [
                        Vue.h("h2", title.value),
                        Vue.h(
                          "button",
                          { class: "click", onClick: () => clicks.value++ },
                          `Clicks ${clicks.value}`,
                        ),
                        Vue.h(Child),
                      ]),
                    ),
                  ),
                ],
              },
            )
          : null;
    },
  };
  const root = document.createElement("div");
  document.body.append(root);
  const app = Vue.createApp(App);
  app.config.warnHandler = (message) => warnings.push(message);
  app.mount(root);
  await flush();
  return {
    items,
    title,
    clicks,
    model,
    width,
    curl,
    visible,
    reference,
    root,
    changes,
    errors,
    warnings,
    close: async () => {
      app.unmount();
      root.remove();
      await flush();
    },
  };
}
test("Vue slots keep live bindings, events and child component state", async () => {
  const f = await fixture();
  const instance = current;
  assert.equal(f.reference.value.pageCount, 4);
  f.title.value = "Edited";
  await flush();
  assert.equal(f.root.querySelector("h2").textContent, "Edited");
  f.root.querySelector(".click").click();
  await flush();
  assert.equal(f.clicks.value, 1);
  const child = f.root.querySelector("article button:last-child");
  child.click();
  await flush();
  assert.equal(child.textContent, "Child 1");
  f.reference.value.last();
  await flush();
  f.reference.value.first();
  await flush();
  assert.equal(child.textContent, "Child 1");
  assert.equal(
    current,
    instance,
    "ordinary content/model updates must not recreate the WebGL context",
  );
  assert.deepEqual(f.warnings, []);
  await f.close();
});
test("keyed v-for pages can be inserted, reordered, removed and emptied", async () => {
  const f = await fixture();
  const original = f.root.querySelector('[data-page="1"]');
  f.reference.value.goTo(1);
  await flush();
  f.items.value = [0, 4, 1, 2, 3];
  await flush();
  assert.equal(f.reference.value.pageCount, 5);
  assert.equal(f.root.querySelector('[data-page="1"]'), original);
  f.items.value = [3, 2, 1, 4, 0];
  await flush();
  assert.deepEqual(
    current.pages.map((page) => Number(page.firstElementChild.dataset.page)),
    [3, 2, 1, 4, 0],
  );
  f.items.value = [0];
  await flush();
  assert.equal(f.reference.value.pageCount, 1);
  f.items.value = [];
  await flush();
  assert.equal(f.reference.value.pageCount, 0);
  assert.equal(f.root.querySelector(".pc-rig"), null);
  f.items.value = [9, 10];
  await flush();
  assert.equal(f.reference.value.pageCount, 2);
  assert.deepEqual(f.warnings, []);
  await f.close();
});
test("Vue model navigation, live props and structural props remain synchronized", async () => {
  const f = await fixture();
  const instance = current;
  f.model.value = 3;
  await flush();
  assert.equal(f.reference.value.page, 3);
  f.reference.value.first();
  await flush();
  assert.equal(f.model.value, 0);
  f.curl.value = 2.1;
  await flush();
  assert.equal(current.options.curl, 2.1);
  assert.equal(current, instance);
  f.width.value = 500;
  await flush();
  assert.equal(current.options.width, 500);
  assert.equal(instance.destroyed, true);
  assert.ok(f.changes.length < 8, "no pagechange/v-model update loop");
  assert.deepEqual(f.warnings, []);
  await f.close();
});
test("v-model acknowledgements do not interrupt multi-spread navigation", async () => {
  const f = await fixture(),
    instance = current;
  instance.renderer = { clear() {}, dispose() {}, setPages() {}, draw() {} };
  instance._snapshot = async () => document.createElement("canvas");
  instance.reduced = { matches: false };
  instance.options.duration = 0;
  f.reference.value.last();
  await flush();
  await flush();
  assert.equal(f.reference.value.page, 3);
  assert.equal(f.model.value, 3);
  f.reference.value.first();
  await flush();
  await flush();
  assert.equal(f.reference.value.page, 0);
  assert.equal(f.model.value, 0);
  assert.equal(current, instance);
  assert.deepEqual(f.warnings, []);
  await f.close();
});
test("Vue unmount restores targets before Vue removes Teleports and cancels pending work", async () => {
  const f = await fixture(),
    instance = current;
  let resolve;
  instance.renderer = {
    clear() {},
    dispose() {},
    setPages() {
      throw new Error("obsolete upload");
    },
  };
  instance._snapshot = () =>
    new Promise((done) => {
      resolve = done;
    });
  f.reference.value.next();
  assert.equal(instance.loading, true);
  f.visible.value = false;
  await flush();
  assert.equal(instance.destroyed, true);
  assert.equal(f.root.querySelector(".pc-rig"), null);
  resolve(document.createElement("canvas"));
  await flush();
  f.visible.value = true;
  await flush();
  assert.equal(f.reference.value.pageCount, 4);
  assert.equal(f.root.querySelectorAll(".pc-rig").length, 1);
  assert.deepEqual(f.warnings, []);
  await f.close();
});
test("ESM and Vue exports import and server-render without browser globals", () => {
  const script = `import { createSSRApp, h } from 'vue'; import { renderToString } from 'vue/server-renderer'; import Core from 'paper-curl'; import PaperCurl from 'paper-curl/vue'; if(typeof Core !== 'function') throw Error('missing ESM export'); const html=await renderToString(createSSRApp({render:()=>h(PaperCurl,null,{default:()=>h('article','SSR')})})); if(!html.includes('<div')) throw Error('missing shell'); if(globalThis.PaperCurl) throw Error('ESM polluted global');`;
  execFileSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: require("node:path").join(__dirname, ".."),
  });
});

test("a local child edit invalidates only its page and keeps shared assets", async () => {
  const f = await fixture(),
    instance = current;
  const cached = Promise.resolve(document.createElement("canvas"));
  for (let i = 0; i < 4; i++) instance.cache.set(i, cached);
  instance.assets.set("photo", "bytes");
  f.root.querySelector("article button:last-child").click();
  await flush();
  assert.equal(instance.cache.has(0), false);
  for (let i = 1; i < 4; i++) assert.equal(instance.cache.get(i), cached);
  assert.equal(instance.assets.get("photo"), "bytes");
  assert.deepEqual(f.warnings, []);
  await f.close();
});
