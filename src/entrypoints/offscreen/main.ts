import { detectTextBubble } from "@/lib/detections";
import { translateWithGemini } from "@/lib/gemini";

browser.runtime.onMessage.addListener((msg, _, sendResponse) => {
  if (msg.type === "OFFSCREEN_DETECT_BBOX") {
    const { detectionModel, autoUpdateModel, minConfidence } = msg.config;

    detectTextBubble(msg.data, minConfidence, detectionModel, autoUpdateModel).then(
      sendResponse,
    ).catch((err) => sendResponse({ error : err.message }));

    return true;
  }

  if (msg.type === "OFFSCREEN_TRANSLATE_IMAGE") {
    const { currentMode, targetLang, sourceLang, geminiKey, geminiModel } =
      msg.config;
    const { src, bboxes, seriesContext } = msg.data;

    if (currentMode === "local") {
      throw new Error("Local mode not supported in offscreen");
    } else {
      translateWithGemini(
        src,
        bboxes,
        geminiKey,
        targetLang,
        sourceLang,
        seriesContext,
        geminiModel
      )
        .then(sendResponse)
        .catch((err) => sendResponse({ error: err.message }));
    }

    return true;
  }
});
