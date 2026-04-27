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
  });

  // Send message when context menu is clicked
  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!tab?.id) return;

    if (info.menuItemId === "comictl-translate-image") {

      // Show popup if user not yet set up the extension
      if (await storage.getItem("sync:is-first-run", { fallback: true })) {
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

  // This only just forward messages to offscreen
  browser.runtime.onMessage.addListener((msg, _, sendResponse) => {
    if (msg.type === "DETECT_BBOX" || msg.type === "TRANSLATE_IMAGE") {
      ensureOffscreen().then(async () => {
        // Config being pass in background because it's not available in offscreen
        const config = {
          detectionModel:
            (await storage.getItem<string>("sync:detection-model")) ??
            "yolo26n",
          currentMode:
            (await storage.getItem<string>("sync:current-mode")) ?? "local",
          sourceLang: await storage.getItem<string>("sync:source-lang"),
          targetLang:
            (await storage.getItem<string>("sync:target-lang")) ?? "EN",
          geminiKey: (await storage.getItem<string>("sync:gemini-key")) ?? "",
          geminiModel: await storage.getItem<string>("sync:gemini-model"),
          autoUpdateModel:
            (await storage.getItem<boolean>("sync:auto-update-model")) ?? true,
          minConfidence:
            (await storage.getItem<number>("sync:min-confidence")) ?? 0.5,
        };

        const response = await browser.runtime.sendMessage({
          type: `OFFSCREEN_${msg.type}`,
          data: msg.data,
          config,
        });

        sendResponse(response);
      });

      return true;
    }
  });
});

async function ensureOffscreen() {
  if (await browser.offscreen.hasDocument()) return;

  await browser.offscreen.createDocument({
    url: "/offscreen.html",
    reasons: [browser.offscreen.Reason.BLOBS],
    justification: "Image Processing",
  });
}

async function detectHardware() {
  if ("ml" in navigator) {
    try {
      const mlContext = await (navigator.ml as any).createContext({
        deviceType: "npu",
      });
      if (mlContext) {
        return "npu";
      }
    } catch (error) {
      console.warn("WebNN NPU not available or context creation failed.");
    }
  }

  if ("gpu" in navigator) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) {
        return "gpu";
      }
    } catch (error) {
      console.warn("GPU adapter request failed.");
    }
  }

  return "cpu";
}
