# Page preparation benchmark

Run `npm run dev:vue`, then open `/performance.html`. Click **Measure turns**. The page uses the same remote photograph and Google Fonts as the Vue demo. It records time from a navigation request to the first call that draws the curved page, plus the CPU time spent in the JavaScript WebGL draw call (GPU execution is asynchronous and is not included).

For the optimized behavior use `/performance.html?preload=true&targeted=true`. This gives preparation 1.5 seconds after the native image/font load, pauses 600 ms between forward turns to model reading, and invalidates only the cover when its title changes. The plain URL measures on-demand capture and a full cache refresh instead. Measure either mode several times on the devices and networks you support; these are diagnostic timings, not CI thresholds.

On the development Chromium browser, September 9, 2026:

- v0.2.0 with the original demo configuration (`preload: false`): first next 161 ms; second next 53 ms; cached previous below 1 ms; next after editing the cover and full refresh 46 ms. Maximum embedded font CSS was 537,413 characters; the page recorded 20 font resource requests.
- Optimized configuration: first next 11 ms; second next below 1 ms; cached previous 1 ms; next after a targeted cover edit below 1 ms. Maximum embedded font CSS was 281,708 characters; 4 font resource requests. JavaScript draw time at the 95th percentile was 1.3 ms.

These single-run values include normal browser caching and the deliberate preparation interval; they are not a guarantee for cold networks or other hardware. Preloading moves work before the click rather than eliminating it. Use the rendering regressions at `/tests.html` to check image/font fidelity alongside performance.


## Multiple font families (v0.3.0)

Open `/fonts.html` and click **Measure fonts and turns**. This captures ten HTML pages using DM Sans, Playfair Display, Cormorant Garamond, Space Mono, and Bungee, with different weights, italics and extended Latin characters. It measures actual preparation with no fixed prewarming delay, edits a page, then measures eight turns using the prepared textures. The benchmark deliberately prepares all ten pages; the library's default remains nearby pages only.

To compare against the prior implementation, create the temporary baseline module with `git show v0.2.1:paper-curl.mjs > examples/vue/baseline.mjs`, then open `/fonts.html?baseline`. Remove that temporary file after comparison; it is not part of the package.

Three consecutive local Chromium runs per version on September 9, 2026, with normal warm HTTP/browser caches and no concurrent browser test suite:

- v0.2.1: ten-page preparation 232 / 173 / 172 ms (median 173 ms); 4,479 KiB of embedded font CSS across all eleven captures (including the edit); 152 font embedding operations, including 10 after the edit; 31 font resource entries. Prepared turns started in 0–2.5 ms.
- v0.3.0: preparation 162 / 108 / 106 ms (median 108 ms); 1,835 KiB of embedded font CSS; 9 embedding operations, including zero after the edit; 9 font resource entries. Prepared turns started in 0–3.8 ms.

That is about 38% lower median preparation time, 59% less font CSS carried through rasterization, and 94% fewer embedding operations for this fixture. Font CSS size is the sum of in-memory embedded strings, not network transfer size. Resource counts include cached fetches, not necessarily network downloads. The first run in each group retains some first-use overhead. These are diagnostic observations on one machine, not cold-network or cross-device guarantees. Prepared-turn timings end at the first JavaScript renderer draw call and do not include compositor presentation.

The browser regressions also hold an unrelated font request open for eight seconds and verify that a Bungee page captures while it is still loading. This guards against reintroducing a document-wide `document.fonts.ready` wait. Pixel comparisons cover mixed styles, variable fonts, synthesized weights and extended Latin characters.


## Optional encoding worker (v0.4.0)

Run the same multi-font fixture at `/fonts.html?worker=true` to opt into the worker. The plain `/fonts.html` uses the main-thread encoding path. Compare preparation separately from already prepared turns; worker startup and message copies can increase total time even while encoding moves off the UI thread. The v0.3.0 numbers above are historical measurements, not worker speedup claims.

The worker handles image/font Blob-to-data-URL conversion and SVG URI encoding. It does not move DOM layout, font matching, SVG rasterization, or WebGL upload. The browser suite verifies real worker image/font pixel fidelity, reported preparation stages, worker termination with an in-flight job, and fallback in an actual `worker-src 'none'` iframe.
