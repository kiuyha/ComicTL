import { detectTextBubble } from "@/lib/detections";
import { translateWithGemini } from "@/lib/gemini";

browser.runtime.onMessage.addListener((msg, _, sendResponse) => {
  if (msg.type === "OFFSCREEN_DETECT_BBOX") {
    const { selectedModel, autoUpdateModel } = msg.config;
    detectTextBubble(msg.data, 0.5, selectedModel, autoUpdateModel).then(
      (result) => sendResponse(result),
    );

    return true;
  }

  if (msg.type === "OFFSCREEN_TRANSLATE_IMAGE") {
    const { currentMode, targetLang, sourceLang } = msg.config;
    const { base64Img, bboxes } = msg.data;

    if (currentMode === "local") {
      throw new Error("Local mode not supported in offscreen");
    } else {
      translateWithGemini(base64Img, bboxes, targetLang, sourceLang).then(
        (result) => sendResponse(result),
      );
    }

    return true;
  }
});
