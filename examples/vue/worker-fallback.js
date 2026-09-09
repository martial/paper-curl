// SPDX-License-Identifier: Apache-2.0
import Core from "paper-curl";
import "paper-curl/paper-curl.css";
const result = document.querySelector("#result"),
  updates = [];
const book = new Core("#book", {
  worker: true,
  preload: false,
  textureScale: 1,
  onProgress: (p) => updates.push(p),
});
try {
  if (!(await book.prepare())) throw Error("Preparation failed");
  if (!book.workerFailed || book.assetWorker)
    throw Error("CSP did not trigger fallback");
  const canvas = await book._snapshot(0);
  const pixel = canvas.getContext("2d").getImageData(100, 100, 1, 1).data;
  if (pixel[0] !== 255 || pixel[1] !== 0 || pixel[2] !== 0)
    throw Error("Fallback pixels incorrect");
  if (updates.at(-1).status !== "ready") throw Error("No completion progress");
  result.textContent = "PASS: CSP fallback prepared both pages";
  result.dataset.status = "pass";
} catch (e) {
  result.textContent = e.message;
  result.dataset.status = "fail";
} finally {
  book.destroy();
}
