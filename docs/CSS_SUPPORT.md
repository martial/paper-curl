# CSS support and benchmark

[Run or search the benchmark](https://paper-curl-vue.martialou543257.chatgpt.site/css.html) · [Per-browser property lists, JSON, and CSV](CSS_PROPERTIES.md)

[First-turn image issues and good practices](IMAGE_PRACTICES.md) covers asset readiness, JavaScript/Vue preparation, responsive images, remote access, and refresh behavior.

PaperCurl uses the browser's resolved CSS values. It does not implement a separate CSS parser or maintain a list of allowed visual properties. Native nesting, cascade layers, scoped rules, container queries, modern colors, and variables are resolved before a page is serialized. The original elements supply the styles, preserving ancestor selectors and Vue scoped attributes. Hidden pages are made measurable only during synchronous reads so container queries resolve before preparation.

## Recorded property sweep

<!-- BEGIN GENERATED CSS RESULTS -->

### Chromium

**Chromium 152.0.0.0**, PaperCurl **0.4.3**, recorded 2026-09-09T18:31:50.429Z; DPR 2.

719 properties: **503 preserved values**, **2 mismatches**, **120 browser-unsupported**, **73 native/frozen**, **21 unverified**, **0 capture errors**.

Visual/browser suite: **61 passed, 0 failed**.

Capture median **17.6 ms**, p95 **27.6 ms**, for two snapshots per tested declaration. Full sweep: 10.2 seconds.

[Full property list](css-reports/chromium.md) · [JSON evidence](css-reports/chromium.json) · [CSV](css-reports/chromium.csv)

### Firefox

**Firefox 155.0.1**, PaperCurl **0.4.3**, recorded 2026-09-09T18:23:57.480Z; DPR 2.

681 properties: **414 preserved values**, **1 mismatches**, **198 browser-unsupported**, **57 native/frozen**, **11 unverified**, **0 capture errors**.

Visual/browser suite: **61 passed, 0 failed**.

Capture median **2 ms**, p95 **10 ms**, for two snapshots per tested declaration. Full sweep: 1.6 seconds.

[Full property list](css-reports/firefox.md) · [JSON evidence](css-reports/firefox.json) · [CSV](css-reports/firefox.csv)

### Opera

**Opera 135.0.0.0**, PaperCurl **0.4.3**, recorded 2026-09-09T18:27:31.984Z; DPR 2.

718 properties: **503 preserved values**, **2 mismatches**, **120 browser-unsupported**, **73 native/frozen**, **20 unverified**, **0 capture errors**.

Visual/browser suite: **61 passed, 0 failed**.

Capture median **30.1 ms**, p95 **203.6 ms**, for two snapshots per tested declaration. Full sweep: 45.1 seconds.

[Full property list](css-reports/opera.md) · [JSON evidence](css-reports/opera.json) · [CSV](css-reports/opera.csv)

### Safari

**Safari 26.6.2**, PaperCurl **0.4.3**, recorded 2026-09-09T20:17:07.067Z; DPR 2.

705 properties: **446 preserved values**, **0 mismatches**, **171 browser-unsupported**, **63 native/frozen**, **25 unverified**, **0 capture errors**.

Visual/browser suite: **61 passed, 0 failed**.

Capture median **10 ms**, p95 **16 ms**, for two snapshots per tested declaration. Full sweep: 5.6 seconds.

[Full property list](css-reports/safari.md) · [JSON evidence](css-reports/safari.json) · [CSV](css-reports/safari.csv)

Timings are local diagnostics, not a controlled browser speed ranking. Runs use different browser engines and may differ in viewport, DPR, font caches, and scheduling. Each JSON records its environment, exact core checksum, and failures.
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

The separate browser regression suite checks actual snapshot pixels and selected WebGL frames. Each browser's measured pass/fail count appears above and in its JSON report. This is separate from the property sweep's value comparisons. The 61 checks cover:

- Different border sides, logical and double borders, rounded corners, CSS outlines, gradient and remote-image borders.
- Single-layer, composite, and legacy WebKit masks, clipping, individual transforms, grid placement/gaps, and multi-column layout.
- `::before`/`::after` borders, decorations, string/`attr()` labels, and Google Font glyphs.
- CSS text strokes, transparent text fills, paint order, SVG strokes, line caps/joins, and dash patterns.
- Native nesting, cascade layers, `:has()`, `@scope`, variables, `oklch()`, `color-mix()`, relative colors, container queries/units, and vertical writing modes.
- Unitless `tab-size: 4` and monospace font sizing.
- Remote and responsive images, CSS backgrounds, several font families, variable weights, italics, extended characters, prepared turns, worker fallback, repeated navigation, and cleanup.

The CSS fixtures run with workers both enabled and disabled, and on visible and hidden pages. These tests sample meaningful pixel regions and glyph widths; they do not assert every pixel of every CSS combination. See [the CSS cases](../tests/browser/css-regressions.js) and [the broader rendering suite](../tests/browser/regressions.js).

## Known limits

- One Safari attempt reported `navigation did not settle` during repeated turns, then exceeded the suite timeout. The final complete run passed all 61 checks. The cause of the earlier stall was not established; the passing rerun does not prove that intermittent behavior was fixed. The [Safari run notes](css-reports/safari.md#run-observations) preserve that observation.
- Firefox's recorded `-webkit-line-clamp: 2` becomes `none` after serialization. Text clamping needs a dedicated layout workaround; the current visual suite does not certify it.
- Chromium and Opera's recorded DPR-2 runs change length-based `tab-size: 24px` from a computed `48px` to `96px`. Unitless `tab-size: 4` passes the visual fixture. Recheck length values at the browser zoom and pixel density you support.
- The print-only [`page` property](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/page) loses its named-page value in the recorded fixture. PaperCurl does not reproduce print pagination or `@page` rules inside its turning texture. This does not refer to PaperCurl's own page navigation.
- Only `::before` and `::after` are reconstructed. Other custom pseudo-element styling is not comprehensively captured.
- Counters, anchors, SVG definitions, or visual effects that depend on content outside the page can differ in the isolated image.
- Live video/canvas state and content inside custom-element shadow roots are not comprehensively captured.
- CSS animations and transitions are frozen when a texture is prepared. Cached textures do not track later hover states, animation frames, or external stylesheet edits; call `refresh()` when those changes should become part of the next capture.
- Remote image, mask, border-image, and font bytes must be accessible to JavaScript under CORS. Stylesheets themselves can still affect computed styles even when CSSOM rule access is restricted; embedding fonts may require readable font rules or `fontCSS`.
- Results apply to the recorded desktop browser versions and environments. They do not certify mobile browsers or other versions. The Chromium baseline uses the Codex in-app browser; Firefox, Opera, and Safari use actual desktop applications through their WebDriver services.

## Fixes found by cross-browser testing

Firefox initially failed 11 of the 61 visual checks on v0.4.2. In v0.4.3, font-display overrides are serialized as text because Firefox rejected the CSSOM descriptor write. Remote CSS images are decoded before the SVG is painted, and responsive image clones use a standalone decode probe to avoid cancellation when picture sources detach. The rerun passes all 61 checks in Firefox, while retaining the separate line-clamp value mismatch above.

Safari's initial font fixture used a case-sensitive lookup for `U+0-FF`, while Safari serializes the equivalent range as `U+0-ff`. The fixture now normalizes case without weakening its image/font assertions. No additional Safari-specific runtime change was made for the final report.

## Repeat the benchmark

```sh
npm install
npm run dev:vue -- --host 127.0.0.1 --port 8770
```

Open `/css.html` in the browser you want to test, run the property benchmark, and download its JSON. **Recorded browser** selects saved evidence; **Run property benchmark** always measures the browser currently viewing the page. To isolate a property, use `/css.html?property=border-image` (or a comma-separated list). A selected-property run is identified in its JSON and cannot replace the published full report.

Generate the checked-in documentation from a completed full run:

```sh
node scripts/document-css-report.mjs /absolute/path/to/paper-curl-firefox-css-report.json firefox
```

For visual checks, also run `npm run test:fixtures` in a second terminal, open `/tests.html`, and click **Run browser checks**. The fixture server supplies intentional CORS successes/failures; font cases require internet access. Run `/fonts.html` separately for the multi-font preparation benchmark. Avoid running heavy browser suites concurrently when comparing timings.

### Automate a real browser

The repository includes a small [W3C WebDriver](https://www.w3.org/TR/webdriver2/) runner with no npm dependencies. Start the browser's local driver, then run the matching command below. It creates an isolated automation session, verifies the user agent, captures both suites, rejects stale or interrupted reports, and closes the session. The core and visual fixtures must remain unchanged during the run; new runs record both checksums. Keep the browser's test window visible during animation checks and avoid interacting with it while the suite runs.

```sh
# With geckodriver listening on 127.0.0.1:4445:
node scripts/benchmark-webdriver.mjs firefox http://127.0.0.1:4445 /Applications/Firefox.app/Contents/MacOS/firefox /tmp/firefox.json

# With OperaDriver listening on 127.0.0.1:4446:
node scripts/benchmark-webdriver.mjs opera http://127.0.0.1:4446 /Applications/Opera.app/Contents/MacOS/Opera /tmp/opera.json

# With safaridriver listening on 127.0.0.1:4447:
node scripts/benchmark-webdriver.mjs safari http://127.0.0.1:4447 - /tmp/safari.json
```

Use the official [Firefox driver](https://firefox-source-docs.mozilla.org/testing/geckodriver/Usage.html), [Opera driver](https://github.com/operasoftware/operachromiumdriver), or Apple's built-in `safaridriver`. Safari requires [remote automation to be enabled](https://developer.apple.com/documentation/safari-developer-tools/macos-enabling-webdriver); an authorization failure is not a compatibility result. Import each completed JSON using the documentation command above and its browser key. Full visual failure messages remain in the JSON and browser-specific property document.

The benchmark and property catalog are development/documentation files. They are not part of the JS/CSS runtime or an added dependency of the library.
