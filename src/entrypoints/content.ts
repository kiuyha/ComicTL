import Overlay from "@/lib/components/Overlay.svelte";
import "@/assets/app.css";
import { mount, unmount } from "svelte";
import { ShadowRootContentScriptUi } from "#imports";
import { getAdapter } from "@/lib/adapters";
import { repaintWithTranslations } from "@/lib/utils";

export default defineContentScript({
  matches: ["<all_urls>"],
  cssInjectionMode: "ui",

  async main(ctx) {
    const translatedSrcMap = new Map<string, string>();
    const overlays = new Map<
      string,
      { ui: ShadowRootContentScriptUi<any>; wrapper: HTMLElement }
    >();

    browser.runtime.onMessage.addListener((msg) => {
      if (msg.type === "comictl-translate-image") {
        const adapter = getAdapter();
        const seriesName = adapter.seriesName();
        const translationKey = `page-cache-${seriesName}-${adapter.chapterId()}-${adapter.pageIndex()}`;
        const originalSrc = translatedSrcMap.get(msg.data) ?? msg.data;

        if (overlays.has(originalSrc)) {
          overlays
            .get(originalSrc)
            ?.wrapper.dispatchEvent(new CustomEvent("comictl:back-to-refine"));
          return;
        }

        const imgElement = document.querySelector(
          `img[src="${CSS.escape(originalSrc)}"]`,
        ) as HTMLImageElement;
        if (!imgElement) return;

        const rect = imgElement.getBoundingClientRect();
        const scaleX = rect.width / imgElement.naturalWidth;
        const scaleY = rect.height / imgElement.naturalHeight;

        // Wrap image inside new parent to ensure cross-web compatibility
        const wrapper = document.createElement("div");
        wrapper.style.position = "relative";
        wrapper.style.display = "inline-block";
        wrapper.style.width = rect.width + "px";
        wrapper.style.height = rect.height + "px";

        imgElement.insertAdjacentElement("beforebegin", wrapper);
        wrapper.appendChild(imgElement);

        createShadowRootUi(ctx, {
          name: "comictl-overlay",
          position: "inline",
          anchor: wrapper,
          append: "last",

          onMount: (uiContainer) =>
            mount(Overlay, {
              target: uiContainer,
              props: {
                wrapper,
                targetImageRect: rect,
                scaleX,
                scaleY,
                originalSrc,

                getTranslationCache: async () => {
                  const cache = await storage.getItem<PageCache>(
                    `local:${translationKey}`,
                  );
                  return cache
                    ? {
                        bboxes: cache.bboxes,
                        translatedSrc: await repaintWithTranslations(
                          originalSrc,
                          cache.bboxes,
                          cache.translations,
                        ),
                      }
                    : null;
                },

                // Sent img to detection model after init and return bounding boxes
                requestBubbleDetection: () =>
                  browser.runtime.sendMessage({
                    type: "DETECT_BBOX",
                    data: originalSrc,
                  }),

                // Sent bounding box to translation model and return translated image
                requestTextTranslation: async (bboxes: Bbox[]) => {
                  const resp = await browser.runtime.sendMessage({
                    type: "TRANSLATE_IMAGE",
                    data: {
                      src: originalSrc,
                      bboxes,
                      seriesContext: await storage.getItem<SeriesContext>(
                        `sync:context-${seriesName}`,
                      ),
                    },
                  });

                  if (resp?.error) return resp;

                  const { translations, context } = resp;

                  // save translation cache
                  await storage.setItem<PageCache>(`local:${translationKey}`, {
                    bboxes,
                    translations,
                  });

                  // save series context
                  const stored = (await storage.getItem<SeriesContext>(
                    `sync:context-${seriesName}`,
                  )) ?? {
                    summary: "",
                    dictionary: "",
                    translatedCount: 0,
                    recentHistory: [],
                  };
                  if (stored) {
                    if (context) {
                      stored.summary = context.summary ?? stored.summary;
                      stored.dictionary =
                        context.dictionary ?? stored.dictionary;
                    }
                    stored.translatedCount += 1;

                    // keeps last 5 after push
                    stored.recentHistory = [
                      ...stored.recentHistory.slice(-4),
                      translations,
                    ];
                    await storage.setItem(`sync:context-${seriesName}`, stored);
                  }

                  return await repaintWithTranslations(
                    originalSrc,
                    bboxes,
                    translations,
                  );
                },

                // Close overlay
                onClose: () => {
                  overlays.get(originalSrc)?.ui?.remove();
                },

                // store the translated image src
                onTranslated: (translatedSrc) =>
                  translatedSrcMap.set(translatedSrc, originalSrc),
              },
            }),

          onRemove: (app) => {
            if (app) {
              unmount(app);
            }
            overlays.delete(originalSrc);
            translatedSrcMap.delete(originalSrc);
            if (imgElement.parentElement === wrapper) {
              wrapper.replaceWith(imgElement);
            }
          },
        }).then((ui) => {
          overlays.set(originalSrc, { ui, wrapper });
          ui.mount();

          const observer = new MutationObserver(() => {
            wrapper.style.display = imgElement.style.display;
          });

          observer.observe(imgElement, {
            attributes: true,
            attributeFilter: ["style"],
          });
        });
      }
    });
  },
});
