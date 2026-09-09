# Page preparation benchmark

Run `npm run dev:vue`, then open `/performance.html`. Click **Measure turns**. The page uses the same remote photograph and Google Fonts as the Vue demo. It records time from a navigation request to the first call that draws the curved page, plus the CPU time spent in the JavaScript WebGL draw call (GPU execution is asynchronous and is not included).

For the optimized behavior use `/performance.html?preload=true&targeted=true`. This gives preparation 1.5 seconds after the native image/font load, pauses 600 ms between forward turns to model reading, and invalidates only the cover when its title changes. The plain URL measures on-demand capture and a full cache refresh instead. Measure either mode several times on the devices and networks you support; these are diagnostic timings, not CI thresholds.

On the development Chromium browser, September 9, 2026:

- v0.2.0 with the original demo configuration (`preload: false`): first next 161 ms; second next 53 ms; cached previous below 1 ms; next after editing the cover and full refresh 46 ms. Maximum embedded font CSS was 537,413 characters; the page recorded 20 font resource requests.
- Optimized configuration: first next 11 ms; second next below 1 ms; cached previous 1 ms; next after a targeted cover edit below 1 ms. Maximum embedded font CSS was 281,708 characters; 4 font resource requests. JavaScript draw time at the 95th percentile was 1.3 ms.

These single-run values include normal browser caching and the deliberate preparation interval; they are not a guarantee for cold networks or other hardware. Preloading moves work before the click rather than eliminating it. Use the rendering regressions at `/tests.html` to check image/font fidelity alongside performance.
