# PaperCurl

A small, editable page-curl library for ordinary HTML. A continuous WebGL sheet bends during a turn; native HTML returns when the page lands. The plain JavaScript core has no runtime dependencies or required build step. An optional **Vue 3 component** keeps your page content reactive.

**New in v0.4.0:** optional encoding workers and loading progress for `prepare()`, automatic preloading, and page turns. [JavaScript and Vue usage →](#preparation-workers-and-loading-progress)

Use **`paper-curl.js` + `paper-curl.css`**. Together they are about 62 KB of formatted, readable source, or 17 KB gzipped. Photographs and example layouts are separate from the library.

## Start here

Open **[minimal.html](minimal.html)** for the smallest editable example. **[index.html](index.html)** is the magazine example to serve locally. **[standalone.html](standalone.html)** contains the entire magazine, including its photograph, in one offline file.

```html
<link rel="stylesheet" href="paper-curl.css" />

<style>
  #book {
    height: 75vh;
    min-height: 380px;
  }
  .page {
    padding: 40px;
    background: #faf9f2;
  }
  .cover {
    background: #245c66;
    color: white;
  }
</style>

<div id="book" aria-label="My magazine">
  <article class="page cover"><h1>My magazine</h1></article>
  <article class="page">
    <h2>First chapter</h2>
    <p>Your content.</p>
  </article>
  <article class="page">
    <h2>Another page</h2>
    <p>More content.</p>
  </article>
  <article class="page cover"><h1>Until next time</h1></article>
</div>

<button id="previous">Previous</button>
<button id="next">Next</button>

<script src="paper-curl.js"></script>
<script>
  const book = new PaperCurl("#book", {
    width: 420,
    height: 594,
    duration: 1100,
    curl: 1.7,
  });

  document.querySelector("#previous").onclick = () => book.prev();
  document.querySelector("#next").onclick = () => book.next();
</script>
```

Each direct child is one page. Write page content in HTML and style it with your own CSS. The library's CSS only handles the book, clipping, and shadows. `width` and `height` are the dimensions you design a page at; the book scales to fit its container.

With `showCover: true`, the first page is a centered front cover. Use an even number of pages to end with a centered back cover. `showCover: false` starts with a normal two-page spread.

## Vue 3

Install from this GitHub repository (this project has not been published to npm):

```sh
npm install github:martial/paper-curl#v0.4.0
```

Vue is an optional peer dependency; use this component in a Vue 3.3+ app:

```vue
<script setup>
import { ref } from "vue";
import PaperCurl from "paper-curl/vue";
import "paper-curl/paper-curl.css";

const book = ref(null);
const page = ref(0);
const title = ref("My journal");
const chapters = ref([
  { id: "one", title: "First chapter" },
  { id: "two", title: "Another page" },
]);
</script>

<template>
  <input v-model="title" aria-label="Journal title" />
  <PaperCurl
    ref="book"
    v-model="page"
    class="journal"
    :width="420"
    :height="594"
    :duration="1200"
    :curl="1.8"
  >
    <article class="page">
      <h1>{{ title }}</h1>
    </article>
    <article v-for="chapter in chapters" :key="chapter.id" class="page">
      <h2>{{ chapter.title }}</h2>
    </article>
    <article class="page"><h1>Until next time</h1></article>
  </PaperCurl>
  <button @click="book?.prev()">Previous</button>
  <span>Page {{ page + 1 }}</span>
  <button @click="book?.next()">Next</button>
</template>

<style scoped>
.journal {
  height: 70vh;
}
.page {
  padding: 40px;
  background: #faf9f2;
}
</style>
```

Each direct slot element or component is one page. Use a stable, unique `:key` for each `v-for` page. Nested template fragments are flattened; whitespace and comments are ignored. Scoped styles, child component state, Vue events, and `provide`/`inject` continue working. Vue owns the content inside stable page targets; the renderer arranges those targets without moving Vue's own child nodes.

Reactive text, images, and DOM updates invalidate only the changed pages automatically. Unaffected page textures and downloaded image/font assets stay cached. Pages can be added, removed, reordered, or initially empty. Structural changes rebuild the book and preserve the visible page where possible. Editing content during a turn cancels that turn safely. Call `book.refresh()` after CSS-only changes or form properties that do not create a DOM mutation.

Props have the same names/defaults as the core options below, using kebab-case in templates (`:show-cover="false"`). `duration`, `curl`, and `shadows` update live; layout props rebuild the renderer. `start-page` sets the initial page. Optional `v-model` tracks the first visible page index, starting at zero; assign a page index to navigate. An index on the right of an open spread selects that spread.

Events:

- `@change="state => …"` — initial state and changed page/spread/count.
- `@ready="book => …"` — mounted or rebuilt, with the exposed navigation API.
- `@progress="update => …"` — page preparation counts and stages; see [preparation and workers](#preparation-workers-and-loading-progress).
- `@error="error => …"` — image/font capture or WebGL failure; native navigation remains available.

The component ref exposes `next()`, `prev()`, `first()`, `last()`, `goTo(index)`, `goToSpread(index)`, `prepare(indices?)`, `refresh()`, and the core's read-only state getters. Use `@change` or `v-model` for reactive state in templates. Unmounting cleans up the observer, listeners, capture work, and GPU resources. ESM imports are safe during SSR; the book renders an empty shell on the server and initializes after mounting in the browser.

Try the editable **[Vue demo](examples/vue/App.vue)**:

```sh
git clone https://github.com/martial/paper-curl.git
cd paper-curl
npm install
npm run dev:vue
```

Open the local URL printed by Vite. The demo includes Google Fonts, remote photographs, editable content, page insertion/removal, and mount/unmount controls. `npm run build:vue` builds it into `dist/vue`. Vue and Vite are only used by the optional integration/example.

## Adjust the feel

```js
book.setOptions({
  duration: 1400, // milliseconds for a full turn
  curl: 1.9, // bending strength; supported range 0.2–2.5
  shadows: true,
});
```

The constructor also accepts:

- `showCover: true` — display a single front cover.
- `startPage: 0` — initial page, using a zero-based index.
- `padding: 52` — room for the page and its shadows, in pixels.
- `maxScale: 1` — maximum scale relative to the design dimensions.
- `textureScale: 2` — resolution of page snapshots during turns.
- `keyboard: true` — arrow keys, Home, and End while the book has focus.
- `preload: true` — prepare the next and previous turning sheets shortly after mounting and after each completed turn. Preparation is bounded to nearby pages, including in long documents. Use `false` to prepare pages only on demand.
- `worker: false` — opt into a reusable encoding worker, with automatic fallback.
- `onProgress(update)` — progress from manual preparation, automatic preloading, and clicked turns.
- `fontCSS: ""` — optional `@font-face` rules for fonts created through the `FontFace` API or stylesheets that cannot be read/fetched. Use absolute font URLs or data URLs. Normal stylesheets, including Google Fonts, are embedded automatically.
- `onChange(state)` — called at initialization and after a completed or cancelled turn.
- `onError(error)` — called if the browser cannot prepare or render a page.

Defaults for page dimensions and motion are `width: 450`, `height: 636`, `duration: 1150`, and `curl: 1.72`.

## Navigate

```js
book.next();
book.prev();
book.first();
book.last();
book.goTo(4); // page index, starting at zero
book.goToSpread(2); // spread index, starting at zero

console.log(book.page, book.spread, book.pageCount, book.spreadCount);
console.log(book.isAnimating);
```

Calls during a turn update the destination. Reversing direction and returning to the cover clear the temporary rendering layer when the turn finishes.

Change notifications include `{ page, spread, pages, pageCount, spreadCount }`. `pages` lists the visible page indices. You can use a callback or an event:

```js
document.querySelector("#book").addEventListener("pagechange", (event) => {
  console.log(event.detail.pages);
});
```

## Edit content

Keep references to your page elements, edit their HTML or styles, then refresh the texture cache:

```js
const page = document.querySelector("#chapter-one");
page.querySelector("h2").textContent = "A new title";
book.refresh([1]); // refresh the chapter page; retain other pages and downloaded assets
```

`refresh()` without arguments explicitly clears every page texture and the image/font/stylesheet caches. `refresh(index)` or `refresh([indices])` invalidates just those page textures, retaining shared assets.

To add, remove, or reorder pages after initialization, call `book.destroy()`, edit the original container, and create a new instance. `destroy()` restores the original page elements and removes listeners, animation frames, and GPU resources.

## Preparation, workers and loading progress

`prepare()` now has two arguments: `prepare(pageIndices?, options?)`. It returns a `Promise<boolean>`. The page indices are zero-based; omit them for the next and previous turning sheets. Use an explicit array to prepare more pages. The optional second argument accepts `onProgress` for that call.

### Plain JavaScript

Use the four-page `#book` markup from [Start here](#start-here), add these status elements, and replace its initialization script with the JavaScript below (inside an async function or an ES module):

```html
<progress id="preparation" max="1" value="0" aria-label="Pages prepared"></progress>
<p id="preparation-status" role="status"></p>
```

```js
const progressElement = document.querySelector("#preparation");
const statusElement = document.querySelector("#preparation-status");
const book = new PaperCurl("#book", {
  worker: true, // optional; default false
  onProgress(update) {
    // Receives explicit preparation, background preloading, and clicked turns.
    console.log(update.source, update.phase, update.completed, update.total);
  },
});

try {
  const ready = await book.prepare([0, 1, 2, 3], {
    onProgress(update) {
      // Receives only this prepare() request.
      progressElement.value = update.progress;
      statusElement.textContent = `${update.completed}/${update.total} pages · ${update.status}`;
    },
  });
  if (ready) book.next();
} catch (error) {
  statusElement.textContent = error.message;
}
```

You can also listen for `prepareprogress` on the book element. Its `event.detail` is the same progress object. Use a callback or the event according to your app; registering both observes the same updates twice.

### Vue 3

```vue
<script setup>
import { ref } from "vue";
import PaperCurl from "paper-curl/vue";
import "paper-curl/paper-curl.css";

const book = ref(null);
const progress = ref(null);
const error = ref("");

function track(update) {
  // Ignore late completion from an older concurrent preparation request.
  if (!progress.value || update.id >= progress.value.id) progress.value = update;
}
function mounted() { progress.value = null; }
async function prepare() {
  try {
    await book.value.prepare([0, 1, 2, 3]);
  } catch (e) {
    error.value = e.message;
  }
}
</script>

<template>
  <PaperCurl ref="book" class="journal" :worker="true" @ready="mounted" @progress="track">
    <article>Cover</article>
    <article>First page</article>
    <article>Second page</article>
    <article>Back cover</article>
  </PaperCurl>
  <button @click="prepare">Prepare pages</button>
  <progress v-if="progress" :value="progress.progress" max="1" aria-label="Pages prepared" />
  <span v-if="progress" role="status">{{ progress.completed }}/{{ progress.total }} pages · {{ progress.status }}</span>
  <p v-if="error" role="alert">{{ error }}</p>
</template>

<style scoped>
.journal { height: 70vh; }
article { padding: 40px; background: #faf9f2; }
</style>
```

The Vue ref also accepts `prepare(indices, { onProgress })`. `@progress` includes automatic preloading and clicked turns; the per-call callback includes only that call. `@ready` means the component instance mounted or rebuilt, and does **not** mean the page textures are prepared. Each new instance restarts progress IDs, so clear your displayed progress on `@ready`. Changing `worker` rebuilds the instance just like the other layout props.

### Progress fields

- `id`: preparation request ID, increasing within one book instance. Concurrent calls share captures but have separate progress reports.
- `source`: `manual`, `preload`, or `turn`.
- `status`: `preparing`, `ready`, `cancelled`, or `error`.
- `phase`: `queued`, `assets`, `layout`, `encoding`, `rasterizing`, `ready`, or `error`.
- `page`: page index associated with the latest update, or `null` for a request-wide update.
- `pages`: the requested page indices.
- `completed`, `total`: completed page textures and requested page count.
- `progress`: `completed / total`, in the range 0–1; 1 for an empty request.

Progress measures completed **pages**, not bytes downloaded or elapsed time. It can stay at zero while a large first page loads. Use `phase` for an indeterminate stage label alongside the page progress bar. A cached page completes immediately. Check `status === "ready"` for successful completion; failed or cancelled preparation never emits that terminal status. Refresh/destroy cancels active preparation requests, while underlying captures shared with other operations can finish independently. Asset failures reject `prepare()`; invalidated or unavailable preparation resolves to `false`.

### What the worker does

`worker: true` moves Blob-to-data-URL encoding for image/font assets and SVG URI encoding to one reusable Web Worker per book. The worker is embedded in the core JS file; there is no additional worker file or runtime dependency. The Vue prop is `:worker="true"`.

DOM cloning, layout/computed styles, font matching, SVG rasterization, and WebGL upload remain on the main thread. Downloads are already asynchronous. A worker can move encoding work away from interaction, but startup, message copies, and scheduling have a cost; it is optional and is **not** a promise of lower total preparation time. Compare it on your content and devices.

Unsupported or blocked workers fall back to the existing encoding path. Sites with a restrictive Content Security Policy need to allow a Blob worker (typically `worker-src 'self' blob:`) to use this option. `destroy()` terminates the worker and settles pending worker jobs.

## Keep turns responsive

Leave `preload` enabled so image/font preparation happens while the user reads. The next sheet is prepared first, followed by the previous sheet; mounting a long book does not capture every page. Pending captures are reused if a click arrives before preparation finishes.

For content edits, prefer `refresh([pageIndex])` over a full `refresh()`; the Vue component does this automatically. Font preparation matches the page's actual text runs with the browser's font matcher, including weights, italics, variable ranges and Unicode subsets. It does not wait for unrelated document fonts. Parsed stylesheets, embedded faces and decoded font/image data are reused across page captures. Image and font preparation runs concurrently. Unusual font shorthand values use a conservative family-based fallback to preserve fidelity.

For an explicit readiness signal, call `prepare()` on the core instance or Vue component ref:

```js
const ready = await book.prepare(); // prepare the next and previous turning sheets
if (ready) book.next();            // reuse prepared textures

await book.prepare([0, 1, 2, 3]);  // optionally prepare specific pages ahead of time
```

The promise resolves to `true` when all requested textures are ready, or `false` if preparation was invalidated by refresh/destroy or WebGL is unavailable. Asset errors and invalid indices reject the promise; handle them in your app. Preparing pages does not navigate or change the visible content. At most two pages are captured concurrently. Preparing a whole long book retains more canvas memory; nearby preparation is the default.

In Vue, `@ready` means the instance has mounted, not that its assets have finished loading. Its API supports `await api.prepare()` too. After changing content, wait for Vue to apply the update before requesting preparation. A first click before the requested page's fonts/images have loaded can still wait on the network; subsequent prepared turns do no font loading or embedding.

`duration` controls how long the animation lasts; reducing it does not shorten page preparation. `textureScale` controls snapshot resolution and memory use; lowering it to `1` reduces capture work at the cost of sharpness on high-density displays.

The repeatable [performance benchmark](tests/browser/PERFORMANCE.md) separates time before the first curl frame from JavaScript drawing time. The optional encoding worker moves only the stages described above off the main thread; DOM layout and rasterization still need the browser document.

## Images and browser support

Page textures use native browser HTML-to-SVG rasterization. Remote `<img>`, responsive `srcset`/`<picture>` sources, lazy images, CSS backgrounds, and SVG `<image>` assets are embedded before a turn. Image servers must allow CORS for capture. An image being visible in HTML does not imply its server permits canvas capture. If a server blocks access, the library emits an actionable error and completes navigation using native pages, with no blank curl layer. Serve such assets from your own origin or use embedded data URLs.

Google Fonts and other accessible `@font-face` stylesheets are embedded into the page texture, preserving the font during a turn. Wait for asynchronously inserted font stylesheets to load before creating the book, or call `refresh()` afterward. For fonts loaded programmatically, provide their original `@font-face` rules through `fontCSS`; browsers do not expose the font bytes from a `FontFace` object. System fonts need no extra setup.

For an HTML file opened directly without a server, use system fonts and embed images as data URLs; the standalone example does this automatically. Snapshots support ordinary text, images, and CSS layouts. Generated pseudo-element content and live video/canvas are not captured comprehensively. Keep those out of turning-page artwork. Interactive elements remain native at rest.

The curved renderer requires WebGL and SVG `foreignObject` rasterization. If rendering is unavailable, navigation falls back to immediate native page changes. Reduced-motion preferences are respected. Chromium has been checked locally; this initial version has not yet been validated across every browser and device.

## Develop

```sh
npm install
npm test
npm run build
```

There are no production dependencies. The optional build script creates `standalone.html` from the editable magazine example. It also generates `paper-curl.mjs` from the readable `paper-curl.js` source. The ESM entry has no global side effects; classic script and CommonJS usage remain supported.

Files to edit:

- `paper-curl.js` — rendering, interaction, and public API.
- `paper-curl.css` — book mechanics and default shadows.
- `vue/index.mjs` — Vue component and lifecycle integration.
- `examples/vue/App.vue` — editable Vue demo.
- `minimal.html` — quickest place to try your own content.
- `index.html` — magazine pages.
- `demo.css` — magazine typography and layout.
- `demo.js` — example controls and initialization.

## Browser regression checks

`npm test` checks navigation races, cleanup, page geometry, reactive Vue updates, keyed page insertion/reordering, model synchronization, and SSR imports. `npm run build:vue` checks the production Vue bundle.

For the actual image/font/WebGL pixel tests, run these in separate terminals:

```sh
npm run test:fixtures
npm run dev:vue
```

Open `/tests.html` on the Vite URL and click **Run browser checks**. The second server on port 8771 provides repeatable CORS-allowed and CORS-blocked remote images. The suite checks a real worker, a deliberately CSP-blocked worker fallback, progress phases, pending-job cleanup, several Google Fonts, variable weights, italics, extended characters, programmatic fonts, and an intentionally stalled unrelated font. It compares captured glyphs with native canvas text, checks that text edits reuse embedded faces, inspects both sides of the WebGL curl, and performs repeated full navigation plus rapid reversals. Font tests need internet access. Expected CSP, CORS and slow-font 404 errors belong to deliberate failure fixtures.

## License

[Apache License 2.0](LICENSE). Copyright 2026 Martial Geoffre-Rouland.

The coastal photograph was generated for the example. The distributed library contains no StPageFlip, html2canvas, or other third-party runtime code.
