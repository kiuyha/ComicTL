import { detectHardware, ensureOffscreen } from "./utils";

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
  });
});
