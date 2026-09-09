// SPDX-License-Identifier: Apache-2.0
import type { DefineComponent, ComponentOptionsMixin } from "vue";
export interface PaperCurlState {
  page: number;
  spread: number;
  pages: number[];
  pageCount: number;
  spreadCount: number;
}
export interface PaperCurlProgress {
  id: number;
  source: "manual" | "preload" | "turn";
  status: "preparing" | "ready" | "cancelled" | "error";
  phase:
    | "queued"
    | "assets"
    | "layout"
    | "encoding"
    | "rasterizing"
    | "ready"
    | "error";
  page: number | null;
  pages: number[];
  completed: number;
  total: number;
  progress: number;
}
export interface PaperCurlPrepareOptions {
  onProgress?: (progress: PaperCurlProgress) => void;
}
export interface PaperCurlProps {
  modelValue?: number;
  startPage?: number;
  width?: number;
  height?: number;
  duration?: number;
  curl?: number;
  showCover?: boolean;
  shadows?: boolean;
  padding?: number;
  maxScale?: number;
  textureScale?: number;
  keyboard?: boolean;
  preload?: boolean;
  fontCSS?: string;
  worker?: boolean;
}
export interface PaperCurlExposed {
  next(): void;
  prev(): void;
  first(): void;
  last(): void;
  goTo(page: number): void;
  goToSpread(spread: number): void;
  prepare(
    pages?: number | number[],
    options?: PaperCurlPrepareOptions,
  ): Promise<boolean>;
  refresh(pages?: number | number[]): void;
  readonly page: number;
  readonly spread: number;
  readonly pageCount: number;
  readonly spreadCount: number;
  readonly isAnimating: boolean;
  readonly state: PaperCurlState;
}
type Events = {
  "update:modelValue": (page: number) => void;
  change: (state: PaperCurlState) => void;
  ready: (book: PaperCurlExposed) => void;
  progress: (progress: PaperCurlProgress) => void;
  error: (error: Error) => void;
};
export declare const PaperCurl: DefineComponent<
  PaperCurlProps,
  PaperCurlExposed,
  {},
  {},
  {},
  ComponentOptionsMixin,
  ComponentOptionsMixin,
  Events
>;
export default PaperCurl;
