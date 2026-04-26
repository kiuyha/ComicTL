import Overlay from "@/lib/components/Overlay.svelte";
import { mount, unmount } from "svelte";
import { ShadowRootContentScriptUi } from "#imports";
import { getAdapter } from "@/lib/adapters";
import { repaintWithTranslations, sendBboxData } from "@/lib/utils";
import "@/assets/app.css";

const srcKey = (src: string) => src.slice(0, 100);

export default defineContentScript({
  matches: ["<all_urls>"],
  cssInjectionMode: "ui",

  async main(ctx) {
    const translatedSrcMap = new Map<string, string>();
    const overlays = new Map<
      string,
      { ui: ShadowRootContentScriptUi<any>; wrapper: HTMLElement }
    >();
    let lastRightClickedSrc: string | undefined = undefined;

    document.addEventListener("contextmenu", (e) => {
      const img = e
        .composedPath()
        .find((el) => el instanceof HTMLImageElement) as
        | HTMLImageElement
        | undefined;
      lastRightClickedSrc = img && srcKey(img.src);
    });

    browser.runtime.onMessage.addListener((msg) => {
      if (msg.type !== "comictl-translate-image") return;

      const clicked = msg.data ?? lastRightClickedSrc;
      const originalSrc = translatedSrcMap.get(clicked) ?? clicked;
      if (!originalSrc) return;

      // If overlay already exists, bring it back to refine mode
      if (overlays.has(originalSrc)) {
        const existing = overlays.get(originalSrc)!;

        if (!document.body.contains(existing.wrapper)) {
          existing.ui.remove();
          overlays.delete(originalSrc);
        } else {
          // It is still alive on the page, just bring it back to refine mode
          existing.wrapper.dispatchEvent(
            new CustomEvent("comictl:back-to-refine"),
          );
          return;
        }
      }

      const imgElement = document.querySelector<HTMLImageElement>(
        `img[src="${originalSrc.replace(/"/g, '\\"')}"]`,
      );
      if (!imgElement) return;

      const adapter = getAdapter();
      const seriesName = adapter.seriesName() ?? "Unknown Series";
      const chapterId = adapter.chapterId();
      const pageIndex = adapter.pageIndex();
      const translationKey = `page-cache-${seriesName}-${chapterId}-${pageIndex}`;

      const rect = imgElement.getBoundingClientRect();
      const scaleX = rect.width / imgElement.naturalWidth;
      const scaleY = rect.height / imgElement.naturalHeight;

      const wrapper = document.createElement("div");
      wrapper.style.cssText = `position:relative;display:inline-block;width:${rect.width}px;height:${rect.height}px;`;
      imgElement.insertAdjacentElement("beforebegin", wrapper);
      wrapper.appendChild(imgElement);

      const { styleObserver, domObserver } = createImageObservers(
        originalSrc,
        wrapper,
      );

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
                if (!cache) return;
                const translatedSrc = await repaintWithTranslations(
                  originalSrc,
                  cache.bboxes,
                  cache.translations,
                );
                translatedSrcMap.set(srcKey(translatedSrc), originalSrc);
                return { bboxes: cache.bboxes, translatedSrc };
              },

              requestBubbleDetection: () =>
                browser.runtime.sendMessage({
                  type: "DETECT_BBOX",
                  data: originalSrc,
                }),

              requestTextTranslation: async (
                bboxes: Bbox[],
                isManuallySorted: boolean,
              ) => {
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

                await storage.setItem<PageCache>(`local:${translationKey}`, {
                  bboxes,
                  translations,
                });
                await updateSeriesContext(seriesName, translations, context);

                const translatedSrc = await repaintWithTranslations(
                  originalSrc,
                  bboxes,
                  translations,
                );
                translatedSrcMap.set(srcKey(translatedSrc), originalSrc);

                return translatedSrc;
              },

              onClose: () => overlays.get(originalSrc)?.ui?.remove(),
            },
          }),

        onRemove: (app) => {
          if (app) unmount(app);

          overlays.delete(originalSrc);
          for (const [key, value] of translatedSrcMap) {
            if (value === originalSrc) translatedSrcMap.delete(key);
          }

          styleObserver.disconnect();
          domObserver.disconnect();

          const currentImg = wrapper.querySelector("img");
          if (currentImg) wrapper.replaceWith(currentImg);
          else wrapper.remove();
        },
      }).then((ui) => {
        overlays.set(originalSrc, { ui, wrapper });
        ui.mount();

        styleObserver.observe(imgElement, {
          attributes: true,
          attributeFilter: ["style"],
        });
        domObserver.observe(wrapper.parentElement ?? document.body, {
          childList: true,
          subtree: true,
        });
      });
    });
  },
});

async function updateSeriesContext(
  seriesName: string,
  translations: Translation[],
  context?: { summary?: string; dictionary?: string },
) {
  const stored = (await storage.getItem<SeriesContext>(
    `sync:context-${seriesName}`,
  )) ?? {
    summary: "",
    dictionary: "",
    translatedCount: 0,
    recentHistory: [],
  };

  if (context) {
    stored.summary = context.summary ?? stored.summary;
    stored.dictionary = context.dictionary ?? stored.dictionary;
  }
  stored.translatedCount += 1;
  stored.recentHistory = [...stored.recentHistory.slice(-4), translations];

  await storage.setItem(`sync:context-${seriesName}`, stored);
}

function createImageObservers(originalSrc: string, wrapper: HTMLElement) {
  // Syncs wrapper visibility to whatever img is currently inside it
  const styleObserver = new MutationObserver(() => {
    const img = wrapper.querySelector("img");
    if (img) wrapper.style.display = img.style.display;
  });

  // Re-attaches wrapper when MangaDex remounts a fresh img element
  const domObserver = new MutationObserver(() => {
    // Debounce so we only react after MangaDex finishes all its mutations
    const allImgs = Array.from(
      document.querySelectorAll<HTMLImageElement>(
        `img[src="${originalSrc.replace(/"/g, '\\"')}"]`,
      ),
    );
    if (!allImgs.length) return;

    const freshImg = allImgs.find((img) => img.parentElement !== wrapper);
    if (!freshImg) return;

    domObserver.disconnect();

    wrapper.querySelectorAll("img").forEach((img) => img.remove());

    freshImg.insertAdjacentElement("beforebegin", wrapper);
    wrapper.appendChild(freshImg);

    wrapper.style.display =
      freshImg.style.display || getComputedStyle(freshImg).display;

    styleObserver.disconnect();
    styleObserver.observe(freshImg, {
      attributes: true,
      attributeFilter: ["style"],
    });

    domObserver.observe(document.body, { childList: true, subtree: true });
  });

  return { styleObserver, domObserver };
}
