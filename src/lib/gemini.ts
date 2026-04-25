import { drawNumberedBboxes } from "./utils";

export async function translateWithGemini(
  imageSrc: string,
  bboxes: Bbox[],
  apiKey: string,
  targetLang: string,
  sourceLang?: string,
  modelType = "gemini-3.1-flash-lite-preview",
  mimeType = "image/jpeg",
): Promise<Translation[]> {
  const cleanBase64 = (await drawNumberedBboxes(imageSrc, bboxes)).replace(
    /^data:image\/(png|jpeg|webp);base64,/,
    "",
  );

  const prompt = `You are a professional manga translator. Translate the text in the numbered red boxes ${sourceLang ? `from ${sourceLang}` : ""} into ${targetLang}. 
  Maintain the tone and context of the scene. 
  Output your translation strictly as a JSON array of objects, like this: [{"box": "1", "text": "translation"}, ...]`;

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
                mimeType: mimeType,
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
