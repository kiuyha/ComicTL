export default defineBackground(() => {
  // Make Context menu (Popup shows on right click)
  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
      id: "comictl-translate-image",
      title: "Translate Image",
      contexts: ["image"],
    });
  });

  // Send message when context menu is clicked
  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (!tab?.id) return;
    
    if (info.menuItemId === "comictl-translate-image") {
      browser.tabs.sendMessage(tab.id, { type: info.menuItemId, data: info.srcUrl });
    }
  });
  
  // This only just forward messages to offscreen
  browser.runtime.onMessage.addListener(async (msg, _, sendResponse) => {
    if (msg.type === "DETECT_BBOX" || msg.type === "TRANSLATE_IMAGE") {
      await ensureOffscreen();

      // Send message to offscreen
      const result = await browser.runtime.sendMessage({
        type: msg.type,
        data: msg.data,
      });
      // console.log(result);

      sendResponse(result); // sent back to content script
      return true;
    }
  });

});

async function ensureOffscreen() {
  if (await browser.offscreen.hasDocument()) return;

  await browser.offscreen.createDocument({
    url: '/offscreen.html',
    reasons: [browser.offscreen.Reason.BLOBS],
    justification: 'Image Processing',
  });
}
