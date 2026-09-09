// SPDX-License-Identifier: Apache-2.0
import PaperCurl, {
  type PaperCurlExposed,
  type PaperCurlProps,
} from "paper-curl/vue";
import { ref } from "vue";
const book = ref<InstanceType<typeof PaperCurl> | null>(null);
book.value?.goTo(3);
const page: number | undefined = book.value?.page;
const props: PaperCurlProps = { width: 400, fontCSS: "", showCover: false };
const ready = (api: PaperCurlExposed) => api.first();
void [page, props, ready];
