import { drawNumberedBboxes } from "./utils";

interface TranslateResult {
  translations: Translations;
  context?: { summary: string; dictionary: string };
}

export async function translateWithGemini(
  imageSrc: string,
  bboxes: Bbox[],
  apiKey: string,
  targetLang: string,
  sourceLang?: string,
  seriesContext?: SeriesContext,
  modelType = "gemini-3.1-flash-lite-preview",
): Promise<TranslateResult> {
  const cleanBase64 = (await drawNumberedBboxes(imageSrc, bboxes)).replace(
    /^data:image\/(png|jpeg|webp);base64,/,
    "",
  );
  const needsContext =
    !seriesContext?.summary ||
    !seriesContext?.dictionary ||
    (seriesContext?.translatedCount ?? 0) % 5 === 0;

  const prompt = `You are a professional manga translator${seriesContext?.title ? ` working on "${seriesContext.title}"` : ""}.
Translate the text in the numbered red boxes${sourceLang !== "AUTO" ? ` from ${sourceLang}` : ""} into ${targetLang}.
Maintain the tone and context of the scene.
${seriesContext?.summary ? `\nSeries context: ${seriesContext.summary}` : ""}
${seriesContext?.dictionary ? `\nTerm dictionary (always use these): ${seriesContext.dictionary}` : ""}
${seriesContext?.recentHistory?.length ? `\nPrevious pages for continuity:\n${seriesContext.recentHistory.map((h, i) => `Page -${seriesContext.recentHistory.length - i}: ${h.join(" | ")}`).join("\n")}` : ""}
${
  needsContext
    ? `\nAlso infer from this page:
  - A 1-2 sentence summary of the series tone, setting, and genre
  - Any character names or terms visible, as "Name -> Reading"`
    : ""
}
Output strictly as valid JSON matching this structure:
{
  "translations": ["translation 1", "translation 2"]${
    needsContext
      ? `,\n  "context": {\n    "summary": "...",\n    "dictionary": "..."\n  }`
      : ""
  }
}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelType}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: cleanBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      `Gemini API Error: ${errorData.error?.message || response.statusText}`,
    );
  }

  const data = await response.json();
  const resultText = data.candidates[0].content.parts[0].text;

  return JSON.parse(resultText);
}
