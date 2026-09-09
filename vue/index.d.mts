// SPDX-License-Identifier: Apache-2.0
import type { DefineComponent, ComponentOptionsMixin } from "vue";
export interface PaperCurlState {
  page: number;
  spread: number;
  pages: number[];
  pageCount: number;
  spreadCount: number;
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
}
export interface PaperCurlExposed {
  next(): void;
  prev(): void;
  first(): void;
  last(): void;
  goTo(page: number): void;
  goToSpread(spread: number): void;
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
