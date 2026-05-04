import { detectTextBubble } from "@/lib/detections/main";
import { makeSiteRuleWithGemini, translateWithGemini } from "@/lib/gemini/main";
import "@/assets/app.css";
import { textRecognise } from "@/lib/ocr/main";
import { makeSiteRuleLocal, translateLocal } from "@/lib/webllm";

browser.runtime.onMessage.addListener((msg, _, sendResponse) => {
  if (msg.type === "OFFSCREEN_DETECT_BBOX") {
    const { detectionModel, autoUpdateModel, detectionMinConfidence } =
      msg.config;

    detectTextBubble(
      msg.data,
      detectionMinConfidence,
      detectionModel,
      autoUpdateModel,
    )
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));

    return true;
  }

  if (msg.type === "OFFSCREEN_TRANSLATE_IMAGE") {
    const {
      currentMode,
      targetLang,
      sourceLang,
      geminiKey,
      geminiModel,
      ocrMinConfidence,
      llmModel,
      llmTemperature,
    } = msg.config;
    const { src, bboxes, seriesContext } = msg.data;

    if (currentMode === "local") {
      textRecognise(src, bboxes, sourceLang, ocrMinConfidence)
        .then((ocrResults) => {
          translateLocal(
            ocrResults.map((r) => r.text),
            targetLang,
            sourceLang,
            seriesContext,
            llmModel,
            llmTemperature,
          )
            .then(sendResponse)
            .catch((err) => sendResponse({ error: err.message }));
        })
        .catch((err) => sendResponse({ error: err.message }));
    } else {
      translateWithGemini(
        src,
        bboxes,
        geminiKey,
        targetLang,
        sourceLang,
        seriesContext,
        geminiModel,
        llmTemperature,
      )
        .then(sendResponse)
        .catch((err) => sendResponse({ error: err.message }));
    }

    return true;
  }

  if (msg.type === "OFFSCREEN_MAKE_SITE_RULE_AI") {
    const { currentMode, geminiKey, geminiModel, llmModel, llmTemperature } =
      msg.config;
    const { title, path } = msg.data;

    if (currentMode === "local") {
      makeSiteRuleLocal(title, path, llmModel, llmTemperature)
        .then(sendResponse)
        .catch((err) => sendResponse({ error: err.message }));
    } else {
      makeSiteRuleWithGemini(title, path, geminiKey, geminiModel, llmTemperature)
        .then(sendResponse)
        .catch((err) => sendResponse({ error: err.message }));
    }

    return true;
  }
});
