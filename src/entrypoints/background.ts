export default defineBackground(() => {
  // Make Context menu (Popup shows on right click)
  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.removeAll();

    browser.contextMenus.create({
      id: "comictl-translate-image",
      title: "Translate Image",
      contexts: ["image"],
    });

    detectHardware();
  });

  // Send message when context menu is clicked
  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (!tab?.id) return;

    if (info.menuItemId === "comictl-translate-image") {
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
          sourceLang:
            (await storage.getItem<string>("sync:source-lang")),
          targetLang:
            (await storage.getItem<string>("sync:target-lang")) ?? "EN",
          geminiKey: (await storage.getItem<string>("sync:gemini-key")) ?? "",
          geminiModel:
            (await storage.getItem<string>("sync:gemini-model")),
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
  let activeDevice = "cpu";

  if ("ml" in navigator) {
    try {
      const mlContext = await (navigator.ml as any).createContext({
        deviceType: "npu",
      });
      if (mlContext) {
        activeDevice = "npu";
      }
    } catch (error) {
      console.warn("WebNN NPU not available or context creation failed.");
    }
  }

  if (activeDevice === "cpu" && "gpu" in navigator) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) {
        activeDevice = "gpu";
      }
    } catch (error) {
      console.warn("GPU adapter request failed.");
    }
  }

  await storage.setItem("local:active-device", activeDevice);
}
