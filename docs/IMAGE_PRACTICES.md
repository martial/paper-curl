# Reliable images on the first turn

[README](../README.md) · [Preparation and progress](../README.md#preparation-workers-and-loading-progress) · [Measured browser support](CSS_SUPPORT.md)

An image that disappears during the first curl but appears on a later turn can indicate a loading, decoding, or capture-invalidation race. The native HTML image and the isolated SVG texture use different rendering paths. A warm browser or PaperCurl cache can hide a cold-start problem. This symptom alone does not identify its cause; it can also reveal a library or browser defect.

Use v0.4.3 or later. That release includes additional decoding of fetched CSS images and responsive-image assets before capture. The browser reports test selected remote images, backgrounds, borders, and responsive images; they do not certify every asset, CSS combination, or network condition.

## Prepare real content before offering a turn

Keep `preload: true`, the default. For a predictable first interaction, await `prepare()` and check its boolean result. It prepares nearby turning sheets; use page indices only when you deliberately need a larger range. Handle rejected promises as well as `false` (cancelled, invalidated, or unavailable preparation).

```js
const book = new PaperCurl("#book", {
  preload: true,
  onError(error) {
    console.error("PaperCurl capture:", error);
  },
});
const next = document.querySelector("#next");
const status = document.querySelector("#status"); // e.g. <p id="status" role="status">

async function prepareThenTurn() {
  next.disabled = true;
  status.textContent = "Preparing pages…";
  try {
    if (await book.prepare()) {
      status.textContent = "";
      book.next();
    } else {
      status.textContent =
        "Pages changed or capture is unavailable. Please retry.";
    }
  } catch (error) {
    status.textContent = error.message;
  } finally {
    next.disabled = false;
  }
}
next.addEventListener("click", prepareThenTurn);
```

Call `prepare()` earlier, once your app has inserted the actual content, to move the wait away from the click. Calling it again reuses cached and pending captures. The example guards a custom button; built-in page gestures still use the library's own preparation and native-page fallback. A successful `prepare()` is a readiness signal, not proof that every pixel of unsupported content was captured correctly.

In Vue, `@ready` means the component instance exists, not that images or textures are ready. For the `book` component ref from the README example, wait for DOM updates before requesting preparation:

```js
import { nextTick } from "vue";

async function nextPage() {
  if (busy.value || !book.value) return;
  busy.value = true;
  error.value = "";
  try {
    await nextTick();
    if (await book.value.prepare()) book.value.next();
    else
      error.value = "Preparation was cancelled or unavailable. Please retry.";
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
```

Here `busy` and `error` are Vue refs. Bind `:disabled="busy"` on the Next button, render the error, and handle the component's `@error` event for background preparation failures too. If image URLs come from an API, await that API request and apply its results before `nextTick()`; `nextTick()` does not wait for network requests. Do not repeatedly change props or refresh pages while preparation is running.

## Give the capture a stable image source and layout

- Set a real `src`, or a usable `srcset`/`<picture>` source, before preparing. Custom lazy loaders that only populate `data-src` after intersection cannot supply an image for an off-screen page yet. Populate those URLs explicitly for nearby pages.
- For the cover and immediately adjacent pages, prefer `loading="eager"`. Keep lazy loading for distant content when your app assigns the real source before preparation. The library handles native lazy images, but cannot trigger every third-party lazy-loading component.
- Provide intrinsic `width` and `height`, or a stable CSS `aspect-ratio`, with appropriate `object-fit`. Let conditional content and CSS classes settle before capture. An ancestor using `display: none`, a zero-sized layout, or an entering transition can produce a different snapshot.
- Keep responsive `sizes` accurate. If a viewport or media-query change selects a new `currentSrc` after a texture was prepared, invalidate that page and prepare it again. Source selection can change without a DOM attribute mutation.
- For CSS backgrounds, masks, and border images, use accessible asset URLs and wait for asynchronously injected stylesheets to load. Image decoding has no effect on a CSS declaration that has not been applied yet. Check modern CSS limitations in the browser report.
- Keep Blob URLs alive until the library no longer needs them, including after a refresh. Do not revoke an object URL immediately after assigning it. Prefer appropriately sized images over full-resolution camera originals; very large textures increase memory and preparation costs.

`decoding="async"` is a browser scheduling hint, not a readiness promise. `img.complete` alone is also insufficient because it can be true for a broken image. For app-controlled image replacement, `await img.decode()` verifies decoding of that selected source; it does not replace PaperCurl's separate embedding and rasterization work.

## Make remote bytes readable

The server must permit JavaScript to fetch the actual image bytes under CORS, including the final destination after redirects. Seeing an image in an ordinary HTML page is not sufficient. Adding `crossorigin="anonymous"` cannot grant permission that the server does not provide.

Use same-origin files or a CDN configured for your app's origin. Avoid URLs that require cross-origin login cookies, expire during reading, or return an HTML error page instead of an image. Check the response status and `Content-Type`. Do not use `mode: "no-cors"`; its opaque response cannot supply usable bytes for capture. CSP must also permit the asset fetch and the embedded image used for rendering. A worker moves encoding work; it does not solve CORS, missing URLs, decoding races, or stale textures.

## Refresh after changes, not on every click

In plain JavaScript, call `book.refresh([pageIndex])` after updating that page's source, HTML, or styles, then await `book.prepare([pageIndex])`. Indices are zero-based. Page-specific refresh retains downloaded shared assets and avoids reloading everything.

The Vue component observes page DOM changes, including `src`, class, and inline-style updates. External stylesheet changes, responsive source selection, and bytes changing behind the same URL do not necessarily create an observed mutation. Refresh explicitly for those changes. Prefer versioned asset URLs when the image bytes change; a full `book.refresh()` clears PaperCurl's asset/font caches too, but does not clear the browser's HTTP cache. Avoid full refresh on every navigation.

## Diagnose a first-turn disappearance in Chrome

1. Open DevTools, enable **Disable cache** in Network, reload with DevTools open, and reproduce the first forward turn, then back and forward again. Record whether the image is missing only while curling or also on the native page at rest.
2. Inspect the missing element. Check `<img>` `src`, `currentSrc`, `complete`, and `naturalWidth`; a positive `naturalWidth` helps distinguish a loaded image from a broken one. For a CSS image, inspect the computed `background-image`, `mask-image`, or `border-image-source` and the element's dimensions.
3. Check Network and Console for CORS/CSP errors, failed or expired URLs, redirects, and unexpectedly large images. Enable `onError`/`@error` and preparation progress. In a healthy cold run, preparation may wait; it should not silently lose a supported image.
4. Retest after explicitly awaiting `prepare()`. If that fixes the symptom, inspect when the actual URLs, styles, and content become available. If it still disappears after successful preparation, reduce the page to the same image and essential CSS rather than adding arbitrary delays or repeated turns.
5. For a reproducible bug, include the browser/version, PaperCurl version, minimal page HTML and CSS, whether it is an HTML or CSS image, asset response headers, and any preparation errors. Use a non-sensitive reproduction URL and redact signed tokens. A screenshot of the curl plus the native page helps identify which capture path fails.

The library normally reports fetch/decode failures and falls back to native navigation. A missing image without an error remains worth investigating; these practices are not a guarantee or a substitute for fixing a reproducible capture bug.
