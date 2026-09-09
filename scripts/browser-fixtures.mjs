// SPDX-License-Identifier: Apache-2.0
// A different origin makes CORS-allowed and CORS-blocked image tests repeatable.
import { createServer } from "node:http";
createServer((req, res) => {
  if (req.url !== "/blocked.svg")
    res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.url.startsWith("/slow-font")) {
    setTimeout(() => {
      res.writeHead(404);
      res.end();
    }, 8000);
    return;
  }
  res.setHeader("Content-Type", "image/svg+xml");
  res.end(
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="${req.url.includes("blue") ? "#0044ff" : "#ff2200"}"/></svg>`,
  );
}).listen(8771, "127.0.0.1", () =>
  console.log("Image fixtures: http://127.0.0.1:8771"),
);
