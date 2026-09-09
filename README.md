# PaperCurl

A small, editable page-curl library for ordinary HTML. A continuous WebGL sheet bends during a turn; native HTML returns when the page lands. No runtime dependencies, framework, or build step.

Use **`paper-curl.js` + `paper-curl.css`**. Together they are about 39 KB of formatted, readable source, or 11 KB gzipped. Photographs and example layouts are separate from the library.

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
- `preload: true` — prepare page textures sequentially after initialization. Use `false` for long documents to prepare pages on demand.
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
book.refresh();
```

To add, remove, or reorder pages after initialization, call `book.destroy()`, edit the original container, and create a new instance. `destroy()` restores the original page elements and removes listeners, animation frames, and GPU resources.

## Images and browser support

The example uses native browser HTML-to-SVG rasterization to prepare textures. For served pages, image URLs must be same-origin or permit CORS. For a file you want to open directly without a server, embed images as data URLs; the standalone example does this automatically.

Page snapshots support ordinary text, images, and CSS layouts. Generated pseudo-element content, live video/canvas, and custom web fonts are not captured comprehensively. Keep these out of turning-page artwork or use system fonts and ordinary HTML elements. Interactive elements remain native at rest; snapshots are refreshed explicitly after content changes.

The curved renderer requires WebGL and SVG `foreignObject` rasterization. If rendering is unavailable, navigation falls back to immediate native page changes. Reduced-motion preferences are respected. Chromium has been checked locally; this initial version has not yet been validated across every browser and device.

## Develop

```sh
npm install
npm test
npm run build
```

There are no production dependencies. The optional build script creates `standalone.html` from the editable magazine example. It does not bundle or minify the library itself.

Files to edit:

- `paper-curl.js` — rendering, interaction, and public API.
- `paper-curl.css` — book mechanics and default shadows.
- `minimal.html` — quickest place to try your own content.
- `index.html` — magazine pages.
- `demo.css` — magazine typography and layout.
- `demo.js` — example controls and initialization.

## License

[Apache License 2.0](LICENSE). Copyright 2026 Martial Geoffre-Rouland.

The coastal photograph was generated for the example. The distributed library contains no StPageFlip, html2canvas, or other third-party runtime code.
