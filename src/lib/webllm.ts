import { MLCEngine } from "@mlc-ai/web-llm";
import { DefaultConfig } from "./configs";

let globalEngine: MLCEngine | null = null;
let currentlyLoadedModel: string | null = null;

export async function translateLocal(
  ocrResults: string[],
  targetLang: string,
  sourceLang: string,
  seriesContext?: SeriesContext,
  model = DefaultConfig.llmModels[0].id,
  temperature = DefaultConfig.llmTemperature,
): Promise<TranslateResult> {
  if (!ocrResults || ocrResults.length === 0) {
    return { translations: [] };
  }

  const needsContext =
    !seriesContext?.summary ||
    !seriesContext?.dictionary ||
    (seriesContext?.translatedCount ?? 0) % DefaultConfig.minTranslations === 0;

  const systemPrompt = `You are a professional manga translator${seriesContext?.seriesName ? ` working on "${seriesContext.seriesName}"` : ""}.
Your task is to translate extracted manga dialogue${sourceLang !== "Auto-Detect" ? ` FROM ${sourceLang.toUpperCase()}` : ""} INTO ${targetLang.toUpperCase()}.
Maintain the tone, emotion, and context of the scene.
${seriesContext?.summary ? `\nSeries context: ${seriesContext.summary}` : ""}
${seriesContext?.dictionary ? `\nTerm dictionary (always use these): ${seriesContext.dictionary}` : ""}
${seriesContext?.recentHistory?.length ? `\nPrevious pages for continuity:\n${seriesContext.recentHistory.map((h, i) => `Page -${seriesContext.recentHistory.length - i}: ${h.text}`).join("\n")}` : ""}

CRITICAL INSTRUCTIONS:
1. The dialogue inside the "translations" array MUST be strictly in ${targetLang.toUpperCase()}. DO NOT transcribe the original text. You must output the translated meaning.
${needsContext ? `2. The "summary" and "dictionary" fields MUST remain strictly in ENGLISH to act as a system memory pivot.` : ""}

Output strictly as valid JSON matching this structure exactly:
{
  "translations": ["translation for box 1", "translation for box 2"]${
    needsContext
      ? `,\n  "context": {\n    "summary": "1-2 sentence series summary in English",\n    "dictionary": "Original Term -> English Translation"\n  }`
      : ""
  }
}`;

  const userPrompt = `--- CURRENT PAGE DIALOGUE ---
Please translate the following extracted text boxes:

${ocrResults.map((text, index) => `Box ${index + 1}: ${text}`).join("\n")}

${
  needsContext
    ? `\nAlso infer from this text:
1. A 1-2 sentence summary of the tone/genre IN ENGLISH.
2. Any character names or unique terms, formatted as "Original Term -> English Translation". If none, output "None".`
    : ""
}`;

  if (!globalEngine) {
    globalEngine = new MLCEngine();
  }

  if (currentlyLoadedModel !== model) {
    await globalEngine.reload(model);
    currentlyLoadedModel = model;
  }

  const reply = await globalEngine.chat.completions.create({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature,
    response_format: { type: "json_object" },
  });

  const resultText = reply.choices[0].message.content as string;

  try {
    const cleanJsonString = resultText
      .replace(/^```(?:json)?/im, "")
      .replace(/```$/im, "")
      .trim();

    return JSON.parse(cleanJsonString);
  } catch (error) {
    console.error("Failed to parse LLM output:", resultText);
    throw new Error("Local LLM generated invalid JSON");
  }
}
