/* Example controls. The library itself contains no magazine content or toolbar. */
const $ = (id) => document.getElementById(id);
const pageElements = [...document.querySelectorAll("#book > .page")];
const titles = [
  "The coast issue",
  "Somewhere slow",
  "The long way",
  "Field notes",
  "Until next time",
];
const labels = [
  "Front cover",
  "Pages 02 — 03",
  "Pages 04 — 05",
  "Pages 06 — 07",
  "Back cover",
];
let currentState,
  playing = false,
  playTimer;

// These are the main settings to edit.
const magazine = new PaperCurl("#book", {
  width: 450,
  height: 636,
  duration: 1150,
  curl: 1.72,
  shadows: true,
  showCover: true,
  onChange(state) {
    currentState = state;
    $("pageTitle").textContent = titles[state.spread];
    $("pageNumber").textContent = labels[state.spread];
    $("prev").disabled = state.spread === 0;
    $("next").disabled = state.spread === state.spreadCount - 1;
    document.querySelectorAll("[data-index]").forEach((button) => {
      if (+button.dataset.index === state.spread)
        button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    if ($("readingDialog").open) updateReading();
    if (playing) {
      clearTimeout(playTimer);
      if (state.spread === state.spreadCount - 1) stopPlay();
      else playTimer = setTimeout(() => magazine.next(), 2200);
    }
  },
  onError(error) {
    console.error("Page curl:", error);
  },
});

function stopPlay() {
  playing = false;
  clearTimeout(playTimer);
  $("play").setAttribute("aria-pressed", "false");
  $("play").innerHTML = 'Play through <span aria-hidden="true">▷</span>';
}

$("prev").onclick = () => {
  stopPlay();
  magazine.prev();
};
$("next").onclick = () => {
  stopPlay();
  magazine.next();
};
document.querySelectorAll("[data-index]").forEach((button) => {
  button.onclick = () => {
    stopPlay();
    magazine.goToSpread(+button.dataset.index);
  };
});
$("slow").onchange = (event) =>
  magazine.setOptions({ duration: event.target.checked ? 3300 : 1150 });
$("paper").onchange = (event) =>
  magazine.setOptions({ shadows: event.target.checked });
$("play").onclick = () => {
  if (playing) return stopPlay();
  playing = true;
  $("play").setAttribute("aria-pressed", "true");
  $("play").innerHTML = 'Pause <span aria-hidden="true">Ⅱ</span>';
  if (magazine.spread === magazine.spreadCount - 1) magazine.first();
  else magazine.next();
};

function updateReading() {
  $("readingTitle").textContent = titles[currentState.spread];
  $("readingText").replaceChildren();
  for (const index of currentState.pages) {
    for (const source of pageElements[index].querySelectorAll("h1,h2,h3,p")) {
      const paragraph = document.createElement(source.tagName.toLowerCase());
      paragraph.textContent = source.textContent;
      $("readingText").append(paragraph);
    }
  }
  $("readPrev").disabled = currentState.spread === 0;
  $("readNext").disabled = currentState.spread === currentState.spreadCount - 1;
}
$("readButton").onclick = () => {
  stopPlay();
  updateReading();
  $("readingDialog").showModal();
};
$("closeReading").onclick = () => $("readingDialog").close();
$("readPrev").onclick = () => magazine.prev();
$("readNext").onclick = () => magazine.next();
$("readingDialog").onclick = (event) => {
  if (event.target !== $("readingDialog")) return;
  const rect = event.target.getBoundingClientRect();
  if (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  )
    event.target.close();
};
$("fullscreenButton").onclick = async () => {
  if (document.fullscreenElement) await document.exitFullscreen();
  else await document.documentElement.requestFullscreen();
};
if (!document.fullscreenEnabled) $("fullscreenButton").hidden = true;
document.addEventListener("keydown", (event) => {
  if (
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.target.closest("input,textarea,select,.pc-host")
  )
    return;
  const actions = {
    ArrowLeft: () => magazine.prev(),
    ArrowRight: () => magazine.next(),
    Home: () => magazine.first(),
    End: () => magazine.last(),
  };
  if (actions[event.key]) {
    event.preventDefault();
    stopPlay();
    actions[event.key]();
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopPlay();
});
