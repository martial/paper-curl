// SPDX-License-Identifier: Apache-2.0
export async function cssRegressions({
  check,
  fixture,
  pixel,
  red,
  blue,
  inkWidth,
}) {
  const sheet = document.createElement("style");
  sheet.textContent = `
    .css-box { position:absolute; left:20px; top:20px; width:200px; height:160px; }
    .gradient-frame { border:20px solid transparent; border-image:linear-gradient(red, red) 1; }
    .image-frame { border:20px solid transparent; border-image:url(http://127.0.0.1:8771/blue.svg) 20 / 20px / 0 stretch; }
    .pseudo-frame::before { content:""; position:absolute; inset:0; border:12px solid red; border-radius:30px; box-sizing:border-box; }
    .pseudo-frame::after { content:""; position:absolute; right:20px; bottom:20px; width:30px; height:30px; background:blue; }
    .pseudo-type::before { content:attr(data-label); font:80px/120px Bungee; color:black; }
    .clip-box { background:red; clip-path:circle(40px at 50% 50%); translate:100px 0; }
    .hidden-box { visibility:hidden; background:red; }
    .pc-content > article .context-frame { border:12px solid red; background:blue; }
    .logical-frame { direction:rtl; border-inline-start:12px solid red; border-block-end:12px double blue; }
    .mask-frame { background:red; padding:12px; mask:linear-gradient(white,white) content-box, linear-gradient(white,white); mask-composite:exclude; }
    .legacy-mask { -webkit-mask-composite:xor; }
    @layer pc-css-base, pc-css-modern;
    @layer pc-css-base { .nested-modern > .tile { background:blue; } }
    @layer pc-css-modern {
      .nested-modern { --line:12px;
        &:has(> .tile) { & > .tile { width:160px; height:120px; background:red; border:var(--line) solid blue; } }
      }
    }
    .modern-color { border:12px solid rgb(from blue r g b); background:color-mix(in oklch, oklch(62.8% 0.2577 29.23) 100%, white); }
    .query-modern { container-type:inline-size; position:absolute; left:20px; top:20px; inline-size:200px; block-size:180px; }
    .query-modern > .tile { inline-size:50cqw; block-size:60px; }
    @container (min-width:180px) { .query-modern > .tile { border:8px solid red; background:blue; } }
    .writing-modern { writing-mode:vertical-rl; direction:ltr; position:absolute; left:20px; top:20px; inline-size:160px; block-size:100px; border-inline-start:12px solid red; border-block-start:12px solid blue; }
    @scope (.scoped-modern) { :scope > .tile { width:160px; height:120px; border:12px solid red; background:blue; } }
    .grid-modern { display:grid; grid-template-columns:60px 60px; grid-template-rows:50px 50px; gap:20px; position:absolute; left:20px; top:20px; width:140px; height:120px; }
    .grid-modern > .tile { grid-column:2; grid-row:2; background:red; }
    .columns-modern { position:absolute; left:20px; top:20px; width:160px; height:100px; column-count:2; column-gap:20px; column-fill:auto; }
    .columns-modern > .tile { height:100px; background:red; break-inside:avoid; }
    .columns-modern > .tile + .tile { background:blue; }
    .single-mask { background:red; mask-image:linear-gradient(to right, white 0 50%, transparent 50%); }
    .css-tab { white-space:pre; font:16px/24px monospace; tab-size:4; padding:20px; }
  `;
  document.head.append(sheet);
  try {
    for (const worker of [false, true]) {
      const verify = (name, html, run) =>
        check(`${name} (worker=${worker})`, async () => {
          const f = await fixture([html, html], { worker });
          try {
            for (const page of [0, 1]) {
              try {
                await run(await f.book._snapshot(page), f, page);
              } catch (error) {
                throw Error(`page ${page}: ${error.message}`);
              }
            }
          } finally {
            f.close();
          }
        });
      await verify(
        "grid placement and gaps survive ordered style serialization",
        '<div class="grid-modern"><div class="tile"></div></div>',
        (canvas) => {
          assert(
            red(pixel(canvas, 110, 100)),
            "grid item lost its row or column",
          );
          assert(!red(pixel(canvas, 85, 75)), "grid gap disappeared");
        },
      );
      await verify(
        "multiple columns preserve column count and gap",
        '<div class="columns-modern"><div class="tile"></div><div class="tile"></div></div>',
        (canvas) => {
          assert(red(pixel(canvas, 40, 60)), "first column disappeared");
          assert(blue(pixel(canvas, 140, 60)), "second column disappeared");
          assert(
            !red(pixel(canvas, 100, 60)) && !blue(pixel(canvas, 100, 60)),
            "column gap disappeared",
          );
        },
      );
      await verify(
        "a single mask layer preserves its transparent half",
        '<div class="css-box single-mask"></div>',
        (canvas) => {
          assert(red(pixel(canvas, 40, 80)), "visible mask half disappeared");
          assert(
            !red(pixel(canvas, 180, 80)),
            "transparent mask half became opaque",
          );
        },
      );
      await verify(
        "unitless tab-size preserves native tab alignment",
        '<div class="css-tab">A\t<span data-tab-marker style="color:red">B</span></div>',
        (canvas, f, page) => {
          const expected = f.book._withPageLayout(page, () => {
            const root = f.book.pages[page].getBoundingClientRect();
            const marker = f.book.pages[page]
              .querySelector("[data-tab-marker]")
              .getBoundingClientRect();
            return ((marker.left - root.left) * 400) / root.width;
          });
          const data = canvas
            .getContext("2d")
            .getImageData(0, 0, 400, 400).data;
          let left = 400;
          for (let y = 0; y < 400; y++)
            for (let x = 0; x < 400; x++)
              if (red(data.subarray((y * 400 + x) * 4, (y * 400 + x) * 4 + 4)))
                left = Math.min(left, x);
          assert(
            Math.abs(left - expected) < 3,
            `unitless tab alignment changed: expected ${expected}, captured ${left}; computed tab ${getComputedStyle(f.book.pages[page].querySelector(".css-tab")).tabSize}`,
          );
        },
      );
      await verify(
        "CSS nesting, cascade layers, has selectors and variables retain their result",
        '<div class="css-box nested-modern"><div class="tile"></div></div>',
        (canvas) => {
          assert(
            blue(pixel(canvas, 25, 80)),
            "nested variable border disappeared",
          );
          assert(
            red(pixel(canvas, 80, 80)),
            "cascade layer or has selector changed",
          );
        },
      );
      await verify(
        "oklch, color-mix and relative colors retain their painted colors",
        '<div class="css-box modern-color"></div>',
        (canvas) => {
          assert(
            blue(pixel(canvas, 25, 80)),
            "relative border color disappeared",
          );
          assert(
            red(pixel(canvas, 80, 80)),
            "modern mixed background color changed",
          );
        },
      );
      await verify(
        "container queries and query units retain sizing and borders",
        '<div class="query-modern"><div class="tile"></div></div>',
        (canvas) => {
          assert(
            red(pixel(canvas, 25, 40)),
            "container query border disappeared",
          );
          assert(blue(pixel(canvas, 60, 40)), "query background disappeared");
          assert(
            !blue(pixel(canvas, 140, 40)) && !red(pixel(canvas, 140, 40)),
            "container-relative width changed",
          );
        },
      );
      await verify(
        "vertical writing mode preserves logical dimensions and borders",
        '<div class="writing-modern"></div>',
        (canvas) => {
          assert(
            red(pixel(canvas, 60, 25)),
            "vertical inline-start border moved",
          );
          assert(
            blue(pixel(canvas, 115, 80)),
            "vertical block-start border moved",
          );
          assert(
            !blue(pixel(canvas, 175, 80)),
            "logical block size became physical height",
          );
        },
      );
      await verify(
        "scoped CSS preserves its scope-root selectors",
        '<div class="css-box scoped-modern"><div class="tile"></div></div>',
        (canvas) => {
          assert(red(pixel(canvas, 25, 80)), "scope border disappeared");
          assert(blue(pixel(canvas, 80, 80)), "scope background disappeared");
        },
      );
      await verify(
        "gradient border-image survives capture",
        '<div class="css-box gradient-frame"></div>',
        (canvas) => {
          assert(red(pixel(canvas, 25, 80)), "gradient border disappeared");
          assert(!red(pixel(canvas, 100, 80)), "border filled the box");
        },
      );
      await verify(
        "remote border-image embeds its asset",
        '<div class="css-box image-frame"></div>',
        (canvas) => {
          assert(blue(pixel(canvas, 25, 80)), "image border disappeared");
        },
      );
      await verify(
        "CSS composite masks preserve hollow frames",
        '<div class="css-box mask-frame"></div>',
        (canvas) => {
          assert(red(pixel(canvas, 25, 80)), "masked frame disappeared");
          assert(!red(pixel(canvas, 100, 80)), "mask filled the center");
        },
      );
      await verify(
        "legacy WebKit mask operators preserve hollow frames",
        '<div class="css-box mask-frame legacy-mask"></div>',
        (canvas) => {
          assert(red(pixel(canvas, 25, 80)), "legacy masked frame disappeared");
          assert(!red(pixel(canvas, 100, 80)), "legacy mask filled the center");
        },
      );
      await verify(
        "pseudo-element borders, rounded corners and decorations survive",
        '<div class="css-box pseudo-frame"></div>',
        (canvas) => {
          assert(red(pixel(canvas, 25, 80)), "before border disappeared");
          assert(!red(pixel(canvas, 21, 21)), "border radius disappeared");
          assert(blue(pixel(canvas, 185, 145)), "after decoration disappeared");
        },
      );
      await verify(
        "pseudo-element text keeps its Google Font and attr content",
        '<div class="pseudo-type" data-label="iiiiii"></div>',
        (canvas) => {
          const reference = document.createElement("canvas");
          reference.width = reference.height = 400;
          const ctx = reference.getContext("2d");
          ctx.font = "80px Bungee";
          ctx.fillText("iiiiii", 0, 100);
          assert(
            inkWidth(canvas) > 0 &&
              Math.abs(inkWidth(canvas) - inkWidth(reference)) < 4,
            "generated text or font disappeared",
          );
        },
      );
      await verify(
        "clip-path and individual transforms preserve shape and placement",
        '<div class="css-box clip-box"></div>',
        (canvas) => {
          assert(red(pixel(canvas, 220, 100)), "individual translate was lost");
          assert(!red(pixel(canvas, 121, 21)), "clip-path disappeared");
          assert(
            !red(pixel(canvas, 50, 100)),
            "shape stayed at its old location",
          );
        },
      );
      await verify(
        "visibility hidden content stays hidden",
        '<div class="css-box hidden-box"></div>',
        (canvas) => {
          assert(
            !red(pixel(canvas, 80, 80)),
            "hidden element leaked into the texture",
          );
        },
      );
      await verify(
        "ancestor-dependent CSS retains its native page context",
        '<div class="css-box context-frame"></div>',
        (canvas) => {
          assert(
            red(pixel(canvas, 25, 80)),
            "ancestor selector lost its border",
          );
          assert(
            blue(pixel(canvas, 80, 80)),
            "ancestor selector lost its background",
          );
        },
      );
      await verify(
        "logical and double borders preserve direction and gaps",
        '<div class="css-box logical-frame"></div>',
        (canvas) => {
          assert(red(pixel(canvas, 215, 80)), "RTL inline-start border moved");
          assert(
            !red(pixel(canvas, 25, 80)),
            "RTL border appeared on the wrong side",
          );
          assert(
            blue(pixel(canvas, 80, 169)) && blue(pixel(canvas, 80, 179)),
            "double border lines disappeared",
          );
          assert(
            !blue(pixel(canvas, 80, 174)),
            "double border gap disappeared",
          );
        },
      );
    }
  } finally {
    sheet.remove();
  }
}
function assert(value, message) {
  if (!value) throw Error(message);
}
