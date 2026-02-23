import Overlay from "@/lib/components/Overlay.svelte";
import "@/assets/app.css";
import { mount, unmount } from "svelte";
import { ShadowRootContentScriptUi } from "#imports";
import { getBase64Image } from "@/lib/utils";

export default defineContentScript({
  matches: ["<all_urls>"],
  cssInjectionMode: "ui",

  async main(ctx) {
    let currentUi: ShadowRootContentScriptUi<any> | null = null;
    let currentApp: ReturnType<typeof mount> | null = null;

    browser.runtime.onMessage.addListener((msg) => {
      if (msg.type === "comictl-translate-image") {
        if (currentUi) {
          currentUi.remove();
          currentUi = null;
          currentApp = null;
        }

        const imgElement = document.querySelector(
          `img[src="${CSS.escape(msg.data)}"]`,
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

        const base64Img = getBase64Image(imgElement);

        createShadowRootUi(ctx, {
          name: "comictl-overlay",
          position: "inline",
          anchor: wrapper,
          append: "last",

          onMount: (uiContainer) => {
            currentApp = mount(Overlay, {
              target: uiContainer,
              props: {
                targetImageRect: rect,
                scaleX,
                scaleY,

                // Sent img to detection model after init and return bounding boxes
                requestBubbleDetection: () =>
                  browser.runtime.sendMessage({
                    type: "DETECT_BBOX",
                    data: base64Img,
                  }),

                // Sent bounding box to translation model and return translated image
                requestTextTranslation: (bboxes: Bbox[]) =>
                  browser.runtime.sendMessage({
                    type: "TRANSLATE_IMAGE",
                    data: {
                      src: base64Img,
                      bboxes,
                    },
                  }),

                // Close overlay
                onClose: () => {
                  currentUi?.remove();
                },
              },
            });

            return currentApp;
          },

          onRemove: (app) => {
            if (app) {
              unmount(app);
            }
            if (imgElement.parentElement === wrapper) {
              wrapper.replaceWith(imgElement);
            }
          },
        }).then((ui) => {
          currentUi = ui;
          currentUi.mount();
        });
      }
    });
  },
});