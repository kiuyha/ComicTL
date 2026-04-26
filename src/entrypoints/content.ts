import Overlay from "@/lib/components/Overlay.svelte";
import { mount, unmount } from "svelte";
import { ShadowRootContentScriptUi } from "#imports";
import { getAdapter } from "@/lib/adapters";
import { repaintWithTranslations, sendBboxData } from "@/lib/utils";
import "@/assets/app.css";

const translatedSrcKey = (src: string) => src.slice(0, 100);

export default defineContentScript({
  matches: ["<all_urls>"],
  cssInjectionMode: "ui",

  async main(ctx) {
    const translatedSrcMap = new Map<string, string>();
    let lastRightClickedSrc: string | undefined = undefined;
    const overlays = new Map<
      string,
      { ui: ShadowRootContentScriptUi<any>; wrapper: HTMLElement }
    >();

    document.addEventListener("contextmenu", (e) => {
      const path = e.composedPath();
      const img = path.find((el) => el instanceof HTMLImageElement) as
        | HTMLImageElement
        | undefined;
      lastRightClickedSrc = img && translatedSrcKey(img.src);
    });

    browser.runtime.onMessage.addListener((msg) => {
      if ((msg.type = "comictl-translate-image")) {
        const adapter = getAdapter();
        const seriesName = adapter.seriesName() ?? "Unknown Series";
        const chapterId = adapter.chapterId();
        const pageIndex = adapter.pageIndex();
        const translationKey = `page-cache-${seriesName}-${chapterId}-${pageIndex}`;
        const clickedSrc = msg.data ?? lastRightClickedSrc;
        const originalSrc = translatedSrcMap.get(clickedSrc) ?? clickedSrc;

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
                  if (cache) {
                    const translatedSrc = await repaintWithTranslations(
                      originalSrc,
                      cache.bboxes,
                      cache.translations,
                    );
                    translatedSrcMap.set(
                      translatedSrcKey(translatedSrc),
                      originalSrc,
                    );
                    return { bboxes: cache.bboxes, translatedSrc };
                  }
                  return;
                },

                // Sent img to detection model after init and return bounding boxes
                requestBubbleDetection: () =>
                  browser.runtime.sendMessage({
                    type: "DETECT_BBOX",
                    data: originalSrc,
                  }),

                // Sent bounding box to translation model and return translated image
                requestTextTranslation: async (
                  bboxes: Bbox[],
                  isManuallySorted: boolean,
                ) => {
                  // Share the bboxes information for future detection model
                  const shareData =
                    await storage.getItem<boolean>("sync:share-data");
                  if (shareData && isManuallySorted)
                    sendBboxData(
                      seriesName,
                      chapterId,
                      pageIndex,
                      bboxes,
                      originalSrc,
                    );

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

                  const translatedSrc = await repaintWithTranslations(
                    originalSrc,
                    bboxes,
                    translations,
                  );
                  translatedSrcMap.set(
                    translatedSrcKey(translatedSrc),
                    originalSrc,
                  );

                  return translatedSrc;
                },

                // Close overlay
                onClose: () => {
                  overlays.get(originalSrc)?.ui?.remove();
                },
              },
            }),

          onRemove: (app) => {
            if (app) {
              unmount(app);
            }
            overlays.delete(originalSrc);
            for (const [key, value] of translatedSrcMap) {
              if (value === originalSrc) {
                translatedSrcMap.delete(key);
              }
            }
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
