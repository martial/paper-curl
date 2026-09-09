<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup>
import { ref } from "vue";
import PaperCurl from "paper-curl/vue";

const book = ref(null);
const page = ref(0);
const title = ref("A slower kind of story.");
const curl = ref(1.72);
const duration = ref(1400);
const likes = ref(0);
const visible = ref(true);
const error = ref("");
const photo =
  "https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=1000&auto=format&fit=crop&q=85";
let serial = 5;
const pages = ref([
  { id: 0, type: "cover" },
  { id: 1, type: "letter", title: "Room to breathe." },
  { id: 2, type: "photo", title: "Somewhere along the coast." },
  { id: 3, type: "note", title: "Made to be touched." },
  { id: 4, type: "back", title: "See you on the next page." },
  { id: 5, type: "back", title: "Keep turning." },
]);
function addPage() {
  pages.value.splice(pages.value.length - 1, 0, {
    id: ++serial,
    type: "note",
    title: "A new chapter.",
  });
}
function removePage() {
  if (pages.value.length > 2) pages.value.splice(pages.value.length - 2, 1);
}
</script>

<template>
  <main>
    <header>
      <a href="https://github.com/martial/paper-curl"
        >paper curl<span> / vue</span></a
      ><span class="edition">THE INTERACTIVE EDITION · 001</span>
    </header>
    <section class="intro">
      <div>
        <p class="eyebrow">ORDINARY VUE. A LITTLE PAPER MAGIC.</p>
        <h1>Ideas deserve<br /><em>a little movement.</em></h1>
      </div>
      <p>
        Real pages. Reactive content.<br />Click an edge, drag a corner,<br />or
        make the story your own.
      </p>
    </section>
    <div class="workspace">
      <section class="reader" aria-label="Magazine demo">
        <PaperCurl
          v-if="visible"
          ref="book"
          v-model="page"
          class="book"
          aria-label="Coastal journal"
          :width="420"
          :height="594"
          :curl="curl"
          :duration="duration"
          :preload="false"
          @error="error = $event.message"
        >
          <article
            v-for="(sheet, index) in pages"
            :key="sheet.id"
            class="page"
            :class="sheet.type"
          >
            <template v-if="sheet.type === 'cover'">
              <img
                class="cover-photo"
                :src="photo"
                alt="Colorful houses above the Mediterranean"
              />
              <div class="cover-ink">
                <p class="eyebrow">FIELD NOTES / VOL. 01</p>
                <h2>{{ title }}</h2>
                <p>A journal of places, people<br />and the time in between.</p>
                <span class="folio">SUMMER, SOMEWHERE.</span>
              </div>
            </template>
            <template v-else-if="sheet.type === 'letter'">
              <p class="eyebrow">A LETTER FROM THE EDITOR</p>
              <h2>{{ sheet.title }}</h2>
              <p class="lead">The best things rarely happen in a hurry.</p>
              <p>
                Take the long way home. Let the coffee go cold. Follow the
                street that looks like it leads nowhere.
              </p>
              <p>
                This little journal is an invitation to notice more: light on a
                wall, a conversation in a doorway, the sound of the sea before
                you can see it.
              </p>
              <p class="signature">Stay curious.</p>
              <span class="folio">{{ index + 1 }} / FIELD NOTES</span>
            </template>
            <template v-else-if="sheet.type === 'photo'">
              <img
                :src="photo"
                alt="A village on the Italian coast"
                loading="lazy"
              />
              <div class="caption">
                <p class="eyebrow">44°07′ N · 9°43′ E</p>
                <h2>{{ sheet.title }}</h2>
                <p>Salt in the air. Nothing on the agenda.</p>
              </div>
              <span class="folio">{{ index + 1 }} / A PLACE TO PAUSE</span>
            </template>
            <template v-else-if="sheet.type === 'note'">
              <p class="eyebrow">A LIVING PAGE</p>
              <h2>{{ sheet.title }}</h2>
              <p>
                These are real Vue elements. This button remembers every click,
                even after the page turns.
              </p>
              <button class="like" @click="likes++">
                ♡ &nbsp; {{ likes }} little moments
              </button>
              <p class="aside">
                Add a page. Change the title.<br />The journal grows with you.
              </p>
              <span class="folio">{{ index + 1 }} / KEEP COLLECTING</span>
            </template>
            <template v-else
              ><p class="eyebrow">THERE IS ALWAYS ANOTHER STORY.</p>
              <h2>{{ sheet.title }}</h2>
              <span class="folio">PAPER CURL / VUE EDITION</span></template
            >
          </article>
        </PaperCurl>
        <div v-else class="book empty">
          The book is unmounted.<br />Mount it again to start fresh.
        </div>
        <nav aria-label="Page navigation">
          <button @click="book?.first()" :disabled="!visible">First</button
          ><button @click="book?.prev()" :disabled="!visible || page === 0">
            ← Previous</button
          ><span aria-live="polite">{{ page + 1 }} / {{ pages.length }}</span
          ><button
            @click="book?.next()"
            :disabled="!visible || page >= pages.length - 1"
          >
            Next →</button
          ><button @click="book?.last()" :disabled="!visible">Last</button>
        </nav>
      </section>
      <aside class="editor">
        <p class="eyebrow">MAKE IT YOURS</p>
        <h2>A page is a canvas.</h2>
        <label>Cover title<input v-model="title" /></label
        ><label
          >Curl <span>{{ curl.toFixed(2) }}</span
          ><input
            v-model.number="curl"
            type="range"
            min="0.2"
            max="2.5"
            step="0.05" /></label
        ><label
          >Turn duration <span>{{ duration }} ms</span
          ><input
            v-model.number="duration"
            type="range"
            min="0"
            max="4000"
            step="100"
        /></label>
        <div class="actions">
          <button @click="addPage">+ Add page</button
          ><button @click="removePage" :disabled="pages.length <= 2">
            − Remove page
          </button>
        </div>
        <button
          class="toggle"
          @click="
            visible = !visible;
            error = '';
          "
        >
          {{ visible ? "Unmount book" : "Mount book" }}
        </button>
        <p class="hint">
          Edit <code>App.vue</code> to change any layout. Each keyed article is
          one page.
        </p>
        <p v-if="error" class="error" role="status">{{ error }}</p>
      </aside>
    </div>
    <footer>
      <span>SMALL LIBRARY. OPEN POSSIBILITIES.</span
      ><a href="https://github.com/martial/paper-curl"
        >Source & documentation ↗</a
      >
    </footer>
  </main>
</template>

<style>
:root {
  font-family: "DM Sans", sans-serif;
  color: #273d39;
  background: #eae9e1;
  font-synthesis: none;
}
* {
  box-sizing: border-box;
}
body {
  margin: 0;
}
button,
input {
  font: inherit;
}
button,
a {
  color: inherit;
}
button {
  cursor: pointer;
}
button:disabled {
  opacity: 0.35;
  cursor: default;
}
a {
  text-decoration: none;
}
main {
  max-width: 1440px;
  margin: auto;
  padding: 30px 48px;
}
header,
footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
header > a {
  font-weight: 600;
  font-size: 23px;
  letter-spacing: -1px;
}
header > a > span {
  font-weight: 400;
  color: #75807a;
}
.edition,
.eyebrow,
footer {
  font-size: 10px;
  letter-spacing: 1.7px;
}
.intro {
  display: flex;
  justify-content: space-between;
  align-items: end;
  margin: 45px 0 12px;
}
.intro h1 {
  font:
    400 clamp(34px, 4vw, 55px)/1.05 "Playfair Display",
    serif;
  letter-spacing: -1.6px;
  margin: 12px 0;
}
.intro h1 em {
  font-weight: 400;
}
.intro > p {
  font-size: 13px;
  line-height: 1.8;
  color: #6c7770;
}
.workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 235px;
  gap: 35px;
}
.reader {
  min-width: 0;
}
.book {
  height: 620px;
}
.empty {
  display: grid;
  place-content: center;
  text-align: center;
  line-height: 1.8;
  color: #728078;
}
nav {
  display: flex;
  gap: 20px;
  justify-content: center;
  align-items: center;
  margin: 5px 0 30px;
}
nav button {
  border: 0;
  background: transparent;
  font-size: 12px;
  padding: 8px 0;
}
nav span {
  font-size: 11px;
  min-width: 50px;
  text-align: center;
  color: #7b827b;
}
.editor {
  align-self: center;
  border-top: 1px solid #bfc6bb;
  padding-top: 18px;
}
.editor h2 {
  font:
    400 25px "Playfair Display",
    serif;
  margin: 14px 0 26px;
}
.editor label {
  display: block;
  font-size: 11px;
  margin: 20px 0;
}
.editor label span {
  float: right;
  color: #737e76;
}
.editor input:not([type="range"]) {
  width: 100%;
  margin-top: 10px;
  padding: 10px;
  border: 1px solid #bdc5b8;
  border-radius: 4px;
  background: #f5f4ed;
  font-size: 12px;
}
.editor input[type="range"] {
  width: 100%;
  margin: 14px 0 0;
  accent-color: #305247;
}
.actions {
  display: flex;
  gap: 7px;
}
.actions button,
.toggle {
  border: 1px solid #bcc5b8;
  padding: 9px;
  background: transparent;
  border-radius: 4px;
  font-size: 11px;
}
.toggle {
  width: 100%;
  margin-top: 10px;
}
.hint {
  font-size: 11px;
  line-height: 1.7;
  color: #778077;
  margin-top: 25px;
}
.error {
  font-size: 11px;
  color: #9d3b2e;
  overflow-wrap: anywhere;
}
footer {
  border-top: 1px solid #c3c9bf;
  padding: 20px 0;
  color: #728075;
}
.page {
  position: relative;
  padding: 40px 34px;
  background: #faf8ee;
  color: #283e38;
  font:
    15px/1.7 "DM Sans",
    sans-serif;
  overflow: hidden;
}
.page h2 {
  font:
    400 46px/1.07 "Playfair Display",
    serif;
  letter-spacing: -1.3px;
  margin: 33px 0 24px;
}
.page .eyebrow {
  font-size: 9px;
  letter-spacing: 1.5px;
}
.page .folio {
  position: absolute;
  bottom: 25px;
  left: 34px;
  font-size: 8px;
  letter-spacing: 1.5px;
}
.cover {
  padding: 0;
  background: #284b4e;
  color: white;
}
.cover-photo {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: brightness(0.7);
}
.cover-ink {
  position: relative;
  padding: 40px 34px;
  height: 100%;
  background: linear-gradient(180deg, #0a263b33, transparent 40%, #0a263ba8);
}
.cover h2 {
  font-size: 60px;
  margin-top: 210px;
}
.cover-ink > p:not(.eyebrow) {
  font-size: 12px;
  line-height: 1.7;
}
.letter .lead {
  font:
    22px/1.4 "Playfair Display",
    serif;
}
.signature {
  font:
    italic 27px "Playfair Display",
    serif;
  margin-top: 36px;
}
.photo {
  padding: 0;
  background: #e0e4d6;
}
.photo > img {
  width: 100%;
  height: 360px;
  object-fit: cover;
}
.caption {
  padding: 12px 34px;
}
.caption h2 {
  font-size: 30px;
  margin: 10px 0;
}
.caption > p:last-child {
  font-size: 11px;
}
.note {
  background: #f1edda;
}
.note h2 {
  margin-top: 80px;
}
.like {
  border: 1px solid #657b65;
  border-radius: 30px;
  background: none;
  padding: 12px 20px;
  margin: 20px 0;
  font-size: 14px;
}
.aside {
  font-size: 12px;
  color: #7c8477;
}
.back {
  background: #2d4d45;
  color: #f0ead9;
}
.back h2 {
  margin-top: 210px;
  font-size: 55px;
}
@media (max-width: 1000px) {
  main {
    padding: 24px;
  }
  .workspace {
    grid-template-columns: 1fr;
  }
  .editor {
    max-width: 420px;
    width: 100%;
    margin: 0 auto 40px;
  }
  .book {
    height: 560px;
  }
  .intro {
    margin-top: 30px;
  }
  .intro > p {
    display: none;
  }
}
@media (max-width: 600px) {
  main {
    padding: 20px 12px;
  }
  .edition {
    display: none;
  }
  .book {
    height: 410px;
  }
  .intro {
    padding: 0 10px;
  }
  nav {
    gap: 13px;
  }
  footer {
    font-size: 8px;
  }
}
@media (min-width: 1001px) and (max-height: 800px) {
  main {
    padding-top: 22px;
  }
  .intro {
    margin-top: 22px;
  }
  .intro h1 {
    font-size: 40px;
  }
  .book {
    height: 440px;
  }
  .editor h2 {
    margin-bottom: 16px;
  }
  .editor label {
    margin: 15px 0;
  }
}
</style>
