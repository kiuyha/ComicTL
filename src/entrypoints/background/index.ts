import { downloadArtifactHF, openSetupTab } from "@/lib/utils";
import { detectHardware, ensureOffscreen } from "./utils";
import { DefaultConfig } from "@/lib/configs";

export default defineBackground(() => {
  // Make Context menu (Popup shows on right click)
  browser.runtime.onInstalled.addListener(async (details) => {
    browser.contextMenus.removeAll();
    browser.contextMenus.create({
      id: "comictl-translate-image",
      title: "Translate Image",
      contexts: ["image"],
    });

    await storage.setItem("local:active-device", await detectHardware());
    if (details.reason === "install") {
      openSetupTab();
    }
  });

  // Send message when context menu is clicked
  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!tab?.id) return;

    if (info.menuItemId === "comictl-translate-image") {
      // Show popup if user not yet set up the extension
      if (await storage.getItem("local:is-first-run", { fallback: true })) {
        browser.action
          .openPopup({ windowId: tab?.windowId })
          .catch(console.error);
        return;
      }

      browser.tabs.sendMessage(tab.id, {
        type: info.menuItemId,
        data: info.srcUrl,
      });
    }
  });

  browser.runtime.onMessage.addListener((msg, _, sendResponse) => {
    // Forwarding Messages to Offscreen
    if (msg.type === "DETECT_BBOX" || msg.type === "TRANSLATE_IMAGE") {
      ensureOffscreen().then(() => {
        browser.runtime
          .sendMessage({
            ...msg,
            type: `OFFSCREEN_${msg.type}`,
          })
          .then(sendResponse)
          .catch((err) => sendResponse({ error: err.message }));
      });

      return true;
    }

    // Caching model when user changes specific settings
    if (msg.type === "PREFETCH_MODEL") {
      const { type, data } = msg.data;

      if (type === "detection")
        downloadArtifactHF(
          DefaultConfig.detectionModelRepo,
          DefaultConfig.detectionModelPath(data),
          false,
          true,
        ).then(() => sendResponse({ success: true }));
      if (type === "ocr")
        downloadArtifactHF(
          DefaultConfig.ocrRepo,
          DefaultConfig.ocrModelPath(data),
          false,
          true,
        ).then(() => {
          downloadArtifactHF(
            DefaultConfig.ocrRepo,
            DefaultConfig.ocrDictPath(data),
            false,
            true,
          ).then(() => sendResponse({ success: true }));
        });

      return true;
    }
  });
});
