// Optional: produce a single offline HTML file from the editable example.
import { readFile, writeFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (name) => readFile(path.join(root, name), "utf8");
let html = await read("index.html");
const photo = (await readFile(path.join(root, "coast.jpg"))).toString("base64");
for (const name of ["paper-curl.css", "demo.css"]) {
  let css = await read(name);
  css = css.replace(
    /url\((['"]?)coast\.jpg\1\)/g,
    `url('data:image/jpeg;base64,${photo}')`,
  );
  html = html.replace(
    new RegExp(`<link\\s+rel="stylesheet"\\s+href="${name.replaceAll('.', '\\.')}"\\s*/?>`),
    `<style>\n${css}\n</style>`,
  );
}
for (const name of ["paper-curl.js", "demo.js"]) {
  html = html.replace(
    `<script src="${name}"></script>`,
    `<script>\n${await read(name)}\n</script>`,
  );
}
html = html.replace(
  "</head>",
  "<!-- PaperCurl and this example: Apache-2.0.\n" +
    (await read("LICENSE")) +
    "\n" +
    (await read("NOTICE")) +
    "\n-->\n</head>",
);
await writeFile(path.join(root, "standalone.html"), html);
console.log(
  `standalone.html: ${(await stat(path.join(root, "standalone.html"))).size.toLocaleString()} bytes`,
);
