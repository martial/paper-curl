# CSS support and benchmark

[Run or search the benchmark](https://paper-curl-vue.martialou543257.chatgpt.site/css.html) · [Every property and its recorded result](CSS_PROPERTIES.md) · [JSON evidence](css-report.json) · [CSV](css-report.csv)

PaperCurl uses the browser's resolved CSS values. It does not implement a separate CSS parser or maintain a list of allowed visual properties. Native nesting, cascade layers, scoped rules, container queries, modern colors, and variables are resolved before a page is serialized. The original elements supply the styles, preserving ancestor selectors and Vue scoped attributes. Hidden pages are made measurable only during synchronous reads so container queries resolve before preparation.

## Recorded property sweep

<!-- BEGIN GENERATED CSS RESULTS -->
Recorded on 2026-09-09T17:59:12.064Z, using **PaperCurl 0.4.2** and **Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36** at DPR 1. The full inventory contains **719 properties** and ran in 7.3 seconds.

- **504 value preserved**.
- **1 value mismatch**.
- **120 browser unsupported**.
- **73 native / frozen**.
- **21 needs a dedicated fixture**.
- **0 capture error**.

Median capture time: **9.7 ms**; p95: **31.2 ms**, per tested declaration across **two snapshots** (visible and hidden page). These are diagnostic local timings, not a cold-network or device guarantee. The property sweep uses system fonts and main-thread encoding.
<!-- END GENERATED CSS RESULTS -->

The source implementation is identified by SHA-256 in the JSON report. The inventory combines the [MDN CSS property catalog](https://github.com/mdn/data/blob/635d63e0c4b4a0a4216aa9ee1cbdaed0c5111065/css/properties.json) (CC0) with additional property names exposed by the running browser. It includes standard, experimental, vendor-prefixed, and obsolete names. It cannot enumerate infinite custom-property names or every combination of values, states, and layouts.

## What the results mean

- **Value preserved:** the benchmark found a valid non-default declaration, rasterized it through PaperCurl, reconstructed the serialized markup in an isolated DOM, and compared the computed value on both a visible and a hidden page. This is a value round-trip check, not a full screenshot equivalence test.
- **Value mismatch:** the fixture's computed value changed after serialization. The report includes the declaration and before/after values. A mismatch can depend on browser behavior or fixture context; it is not hidden inside the passing count.
- **Browser unsupported:** `CSS.supports(property, "initial")` is false. PaperCurl cannot add syntax or rendering support that the browser lacks.
- **Native / frozen:** interaction, scrolling, and timeline behaviors operate on native HTML at rest. The turning page is a still texture; it cannot scroll, animate, or accept input independently.
- **Needs a dedicated fixture:** automatic candidate selection found no useful non-default test. This is unverified, not supported or failed.
- **Capture error:** snapshot or reconstruction failed. The report preserves the error message.

The sweep measures one selected declaration per property, on a basic HTML fixture. Some properties need a table, SVG shape, replaced element, pagination, or a particular layout to have a visible effect. A value pass does not establish those contexts. Shorthands and aliases are included separately. Custom properties are checked through visual examples that consume them; their resolved values are captured, not the entire inherited variable payload.

## Visually checked examples

The separate browser regression suite checks actual snapshot pixels and selected WebGL frames. On September 9, 2026, **61 checks passed with 0 failures** in the recorded Chromium environment. This is separate from the property sweep's value comparisons. It covers:

- Different border sides, logical and double borders, rounded corners, CSS outlines, gradient and remote-image borders.
- Single-layer, composite, and legacy WebKit masks, clipping, individual transforms, grid placement/gaps, and multi-column layout.
- `::before`/`::after` borders, decorations, string/`attr()` labels, and Google Font glyphs.
- CSS text strokes, transparent text fills, paint order, SVG strokes, line caps/joins, and dash patterns.
- Native nesting, cascade layers, `:has()`, `@scope`, variables, `oklch()`, `color-mix()`, relative colors, container queries/units, and vertical writing modes.
- Unitless `tab-size: 4` and monospace font sizing.
- Remote and responsive images, CSS backgrounds, several font families, variable weights, italics, extended characters, prepared turns, worker fallback, repeated navigation, and cleanup.

The CSS fixtures run with workers both enabled and disabled, and on visible and hidden pages. These tests sample meaningful pixel regions and glyph widths; they do not assert every pixel of every CSS combination. See [the CSS cases](../tests/browser/css-regressions.js) and [the broader rendering suite](../tests/browser/regressions.js).

## Known limits

- The print-only [`page` property](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/page) loses its named-page value in the recorded fixture. PaperCurl does not reproduce print pagination or `@page` rules inside its turning texture. This does not refer to PaperCurl's own page navigation.
- Only `::before` and `::after` are reconstructed. Other custom pseudo-element styling is not comprehensively captured.
- Counters, anchors, SVG definitions, or visual effects that depend on content outside the page can differ in the isolated image.
- Live video/canvas state and content inside custom-element shadow roots are not comprehensively captured.
- CSS animations and transitions are frozen when a texture is prepared. Cached textures do not track later hover states, animation frames, or external stylesheet edits; call `refresh()` when those changes should become part of the next capture.
- Remote image, mask, border-image, and font bytes must be accessible to JavaScript under CORS. Stylesheets themselves can still affect computed styles even when CSSOM rule access is restricted; embedding fonts may require readable font rules or `fontCSS`.
- The published measurements are from one Chromium environment. Safari, Firefox, other Chrome versions, browser flags, and device settings may differ. Run the benchmark in the environments you support.

## Repeat the benchmark

```sh
npm install
npm run dev:vue -- --host 127.0.0.1 --port 8770
```

Open `/css.html`, run the property benchmark, and download its JSON. To isolate a property, use `/css.html?property=border-image` (or a comma-separated list). A selected-property run is identified in its JSON and cannot replace the published full report.

Generate the checked-in documentation from a completed full run:

```sh
node scripts/document-css-report.mjs /absolute/path/to/paper-curl-css-report.json
```

For visual checks, also run `npm run test:fixtures` in a second terminal, open `/tests.html`, and click **Run browser checks**. The fixture server supplies intentional CORS successes/failures; font cases require internet access. Run `/fonts.html` separately for the multi-font preparation benchmark. Avoid running heavy browser suites concurrently when comparing timings.

The benchmark and property catalog are development/documentation files. They are not part of the JS/CSS runtime or an added dependency of the library.
