import { detectTextBubble } from "@/lib/detections";
import { translateWithGemini } from "@/lib/gemini";
import { repaintWithTranslations } from "@/lib/utils";

browser.runtime.onMessage.addListener((msg, _, sendResponse) => {
  if (msg.type === "OFFSCREEN_DETECT_BBOX") {
    const { selectedModel, autoUpdateModel, minConfidence } = msg.config;

    detectTextBubble(msg.data, minConfidence, selectedModel, autoUpdateModel).then(
      sendResponse,
    ).catch((err) => sendResponse({ error : err.message }));

    return true;
  }

  if (msg.type === "OFFSCREEN_TRANSLATE_IMAGE") {
    const { currentMode, targetLang, sourceLang, geminiKey, geminiModel } =
      msg.config;
    const { src, bboxes } = msg.data;

    if (currentMode === "local") {
      throw new Error("Local mode not supported in offscreen");
    } else {
      translateWithGemini(
        src,
        bboxes,
        geminiKey,
        targetLang,
        sourceLang,
        geminiModel,
      )
        .then((translations) =>
          repaintWithTranslations(src, bboxes, translations).then(sendResponse),
        )
        .catch((err) => sendResponse({ error: err.message }));
    }

    return true;
  }
});
