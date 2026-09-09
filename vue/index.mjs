// SPDX-License-Identifier: Apache-2.0 | Copyright 2026 Martial Geoffre-Rouland
import {
  Comment,
  Fragment,
  Text,
  Teleport,
  defineComponent,
  h,
  ref,
  onMounted,
  onUpdated,
  onBeforeUnmount,
} from "vue";
import Curl from "../paper-curl.mjs";

const layoutKeys = [
  "width",
  "height",
  "showCover",
  "padding",
  "maxScale",
  "textureScale",
  "keyboard",
  "preload",
  "fontCSS",
  "worker",
];
const optionKeys = [...layoutKeys, "duration", "curl", "shadows"];

// Preserve keyed pages across v-for fragments and ignore template whitespace.
function flatten(nodes, scope = "", result = []) {
  nodes.forEach((node, index) => {
    if (!node || node.type === Comment || node.type === Text) return;
    const key =
      scope + (node.key == null ? `i:${index}` : `k:${String(node.key)}`);
    if (node.type === Fragment) flatten(node.children || [], key + "/", result);
    else result.push({ key, node });
  });
  return result;
}

export const PaperCurl = defineComponent({
  name: "PaperCurl",
  inheritAttrs: false,
  props: {
    modelValue: Number,
    startPage: { type: Number, default: 0 },
    width: { type: Number, default: 450 },
    height: { type: Number, default: 636 },
    duration: { type: Number, default: 1150 },
    curl: { type: Number, default: 1.72 },
    showCover: { type: Boolean, default: true },
    shadows: { type: Boolean, default: true },
    padding: { type: Number, default: 52 },
    maxScale: { type: Number, default: 1 },
    textureScale: { type: Number, default: 2 },
    keyboard: { type: Boolean, default: true },
    preload: { type: Boolean, default: true },
    fontCSS: { type: String, default: "" },
    worker: { type: Boolean, default: false },
  },
  emits: ["update:modelValue", "change", "ready", "progress", "error"],
  setup(props, { slots, attrs, emit, expose }) {
    const host = ref(null),
      mounted = ref(false);
    let book = null,
      records = [],
      targets = new Map(),
      previousOptions = {};
    let lastModel = props.modelValue,
      emittedModel,
      lastState = "",
      disposed = false;
    let observer;
    const options = () =>
      Object.fromEntries(optionKeys.map((key) => [key, props[key]]));
    const changed = (state) => {
      const signature = JSON.stringify(state);
      if (signature !== lastState) {
        lastState = signature;
        emit("change", state);
        if (props.modelValue !== state.page) {
          emittedModel = state.page;
          emit("update:modelValue", state.page);
        }
      }
    };
    const stop = () => {
      observer?.disconnect();
      book?.destroy();
      book = null;
    };
    const sync = () => {
      if (!mounted.value || disposed) return;
      const nextOptions = options();
      const pages = records.map((record) => record.target);
      const modelChanged = props.modelValue !== lastModel;
      const requested = modelChanged && props.modelValue !== emittedModel;
      lastModel = props.modelValue;
      emittedModel = undefined;
      const rebuild =
        !book ||
        pages.length !== book.pageCount ||
        pages.some((page, i) => book.pages[i] !== page) ||
        layoutKeys.some((key) => previousOptions[key] !== nextOptions[key]);
      if (rebuild) {
        const currentNode = book?.pages[book.page];
        const preserved = pages.indexOf(currentNode);
        const page = requested
          ? props.modelValue
          : book
            ? preserved < 0
              ? book.page
              : preserved
            : (props.modelValue ?? props.startPage);
        stop();
        host.value.replaceChildren(...pages);
        if (pages.length) {
          book = new Curl(host.value, {
            ...nextOptions,
            startPage: page,
            onChange: changed,
            onProgress: (progress) => emit("progress", progress),
            onError: (error) => emit("error", error),
          });
          // Observe page content only, never the renderer's animated DOM or clones.
          observer = new MutationObserver((mutations) => {
            if (disposed || !book) return;
            const dirty = new Set();
            for (const mutation of mutations) {
              const element =
                mutation.target.nodeType === 1
                  ? mutation.target
                  : mutation.target.parentElement;
              const index = book.pages.indexOf(
                element?.closest(".pc-vue-page"),
              );
              if (index >= 0) dirty.add(index);
            }
            if (dirty.size) book.refresh([...dirty]);
          });
          pages.forEach((page) =>
            observer.observe(page, {
              subtree: true,
              childList: true,
              characterData: true,
              attributes: true,
            }),
          );
          emit("ready", api);
        } else
          changed({
            page: 0,
            spread: 0,
            pages: [],
            pageCount: 0,
            spreadCount: 0,
          });
      } else {
        book.setOptions(nextOptions);
        if (requested && props.modelValue != null) book.goTo(props.modelValue);
      }
      previousOptions = nextOptions;
    };
    const api = {
      next: () => book?.next(),
      prev: () => book?.prev(),
      first: () => book?.first(),
      last: () => book?.last(),
      goTo: (page) => book?.goTo(page),
      goToSpread: (spread) => book?.goToSpread(spread),
      prepare: (pages, options) =>
        book?.prepare(pages, options) ?? Promise.resolve(false),
      refresh: (pages) => book?.refresh(pages),
      get page() {
        return book?.page ?? 0;
      },
      get spread() {
        return book?.spread ?? 0;
      },
      get pageCount() {
        return book?.pageCount ?? 0;
      },
      get spreadCount() {
        return book?.spreadCount ?? 0;
      },
      get isAnimating() {
        return book?.isAnimating ?? false;
      },
      get state() {
        return (
          book?.state ?? {
            page: 0,
            spread: 0,
            pages: [],
            pageCount: 0,
            spreadCount: 0,
          }
        );
      },
    };
    expose(api);
    onMounted(() => {
      mounted.value = true;
    });
    onUpdated(sync);
    onBeforeUnmount(() => {
      disposed = true;
      stop();
      targets.clear();
    });
    return () => {
      const children = [];
      if (mounted.value) {
        const nextTargets = new Map();
        records = flatten(slots.default?.() || []).map(({ key, node }) => {
          let target = targets.get(key);
          if (!target) {
            target = host.value.ownerDocument.createElement("div");
            target.className = "pc-vue-page";
            // This host is exclusively owned by the imperative renderer. The target
            // exists before Teleport mounts; Vue owns everything INSIDE the target.
            host.value.append(target);
          }
          nextTargets.set(key, target);
          children.push(h(Teleport, { key, to: target }, [node]));
          return { key, target };
        });
        targets = nextTargets;
      }
      // SSR renders this same empty shell. All DOM/WebGL work begins after mount.
      return h(Fragment, null, [
        h("div", { ...attrs, class: ["pc-host", attrs.class], ref: host }),
        ...children,
      ]);
    };
  },
});
export default PaperCurl;
