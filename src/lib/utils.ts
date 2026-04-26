import * as ort from "onnxruntime-web/all";

const BUNDLED_FONT_STACKS: Record<string, string> = {
  system: "'Segoe UI', sans-serif",
  noto: "'Noto Sans', sans-serif",
  bangers: "'Bangers', cursive",
  comic: "'Comic Neue', cursive",
};

async function fetchAsBase64(url: string) {
  const res = await fetch(url);
  const blob = await res.blob();
  const mimeType = blob.type || "image/jpeg";
  const arrayBuffer = await blob.arrayBuffer();
  const uint8 = new Uint8Array(arrayBuffer);
  const chunkSize = 8192;
  let binary = "";
  for (let i = 0; i < uint8.length; i += chunkSize) {
    binary += String.fromCharCode(...uint8.subarray(i, i + chunkSize));
  }
  const base64 = btoa(binary);
  return `data:${mimeType};base64,${base64}`;
}

export async function getModel(
  repoID: string,
  modelPath: string,
  autoUpdateModel: boolean,
) {
  const url = `https://huggingface.co/${repoID}/resolve/main/${modelPath}`;
  const cache = await caches.open(repoID);

  let response = await cache.match(url);
  let needsUpdate = !response;

  if (autoUpdateModel && response) {
    try {
      const headResponse = await fetch(url, { method: "HEAD" });
      const currentHash =
        headResponse.headers.get("x-repo-commit") ||
        headResponse.headers.get("etag");
      const localHash =
        response.headers.get("x-repo-commit") || response.headers.get("etag");

      if (currentHash !== localHash) needsUpdate = true;
    } catch (error) {
      console.warn(
        "Offline: skipping model update check and using cache. Error:",
        error,
      );
    }
  }

  if (!response || needsUpdate) {
    response = await fetch(url);
    await cache.put(url, response.clone());
  }

  return ort.InferenceSession.create(await response.arrayBuffer(), {
    executionProviders: ["webnn", "webgpu", "wasm"],
  });
}

export async function scalingImage(imageSrc: string, modelSize: number = 1280) {
  const response = await fetch(imageSrc);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);

  const canvas = new OffscreenCanvas(modelSize, modelSize);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Failed to get canvas context");

  // Fill the background with YOLO's standard padding color (gray)
  ctx.fillStyle = "rgb(114, 114, 114)";
  ctx.fillRect(0, 0, modelSize, modelSize);

  // Calculate the scaling factor using the bitmap dimensions
  const scale = Math.min(modelSize / bitmap.width, modelSize / bitmap.height);

  const newWidth = bitmap.width * scale;
  const newHeight = bitmap.height * scale;

  // Calculate the coordinates needed to center the image
  const offsetX = (modelSize - newWidth) / 2;
  const offsetY = (modelSize - newHeight) / 2;

  // Draw the scaled image and extract the raw pixels
  ctx.drawImage(bitmap, offsetX, offsetY, newWidth, newHeight);

  return {
    imageData: ctx.getImageData(0, 0, modelSize, modelSize),
    origWidth: bitmap.width,
    origHeight: bitmap.height,
  };
}

export function restoreBoundingBox(
  bbox: Bbox,
  origWidth: number,
  origHeight: number,
  modelSize: number = 1280,
) {
  const gain = Math.min(modelSize / origWidth, modelSize / origHeight);
  const padX = (modelSize - origWidth * gain) / 2;
  const padY = (modelSize - origHeight * gain) / 2;

  return {
    ...bbox,
    x1: (bbox.x1 - padX) / gain,
    y1: (bbox.y1 - padY) / gain,
    x2: (bbox.x2 - padX) / gain,
    y2: (bbox.y2 - padY) / gain,
  };
}

export async function drawNumberedBboxes(
  imageSrc: string,
  bboxes: Bbox[],
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      // Set a reasonable max width for AI ingestion
      const MAX_WIDTH = 1024;
      let scale = 1;

      if (img.width > MAX_WIDTH) {
        scale = MAX_WIDTH / img.width;
      }

      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        return reject(new Error("Failed to get 2d canvas context"));
      }

      // Draw the image scaled down
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      bboxes.forEach((box, index) => {
        // Scale the incoming coordinates to match the new canvas size
        const x1 = box.x1 * scale;
        const y1 = box.y1 * scale;
        const width = (box.x2 - box.x1) * scale;
        const height = (box.y2 - box.y1) * scale;
        const boxNumber = (index + 1).toString();

        ctx.lineWidth = Math.max(2, 4 * scale);
        ctx.strokeStyle = "#ef4444";
        ctx.strokeRect(x1, y1, width, height);

        const fontSize = Math.max(14, Math.floor(28 * scale));
        ctx.font = `bold ${fontSize}px sans-serif`;
        const textMetrics = ctx.measureText(boxNumber);

        const labelWidth = textMetrics.width + 12 * scale;
        const labelHeight = Math.max(18, 36 * scale);

        let labelY = y1 - labelHeight;
        if (labelY < 0) {
          labelY = y1;
        }

        ctx.fillStyle = "#ef4444";
        ctx.fillRect(x1, labelY, labelWidth, labelHeight);

        ctx.fillStyle = "#ffffff";
        ctx.textBaseline = "top";
        ctx.fillText(boxNumber, x1 + 6 * scale, labelY + 4 * scale);
      });

      // Export at 75% quality
      resolve(canvas.toDataURL("image/jpeg", 0.75));
    };

    img.onerror = () =>
      reject(new Error("Failed to load image for canvas drawing"));
    fetchAsBase64(imageSrc).then((base64) => (img.src = base64));
  });
}

/**
 * Samples the average color of a rectangular region from ImageData.
 */
function sampleRegionAvg(
  data: Uint8ClampedArray,
  w: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
) {
  let r = 0,
    g = 0,
    b = 0,
    n = 0;
  for (let y = ry; y < ry + rh; y++) {
    for (let x = rx; x < rx + rw; x++) {
      const i = (y * w + x) * 4;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      n++;
    }
  }
  return n ? [r / n, g / n, b / n] : [255, 255, 255];
}

/**
 * Fills a bbox by interpolating from its 4 surrounding edges — handles gradients
 * and textured backgrounds better than a flat fill. Works pixel-by-pixel on the
 * raw ImageData buffer so there's only one getImageData/putImageData round trip.
 */
function inpaintBbox(imgData: ImageData, bbox: Bbox, margin = 4) {
  const { data, width, height } = imgData;
  const x1 = Math.max(0, Math.round(bbox.x1));
  const y1 = Math.max(0, Math.round(bbox.y1));
  const x2 = Math.min(width - 1, Math.round(bbox.x2));
  const y2 = Math.min(height - 1, Math.round(bbox.y2));

  const clamp = (v: number, lo: number, hi: number) =>
    Math.max(lo, Math.min(hi, v));

  // Pre-sample edge strips rather than hitting individual pixels per loop
  const edgeL = (py: number) => {
    const sx = clamp(x1 - margin, 0, width - 1);
    return sampleRegionAvg(data, width, sx, py, clamp(margin, 1, x1), 1);
  };
  const edgeR = (py: number) => {
    const sx = clamp(x2 + 1, 0, width - 1);
    return sampleRegionAvg(
      data,
      width,
      sx,
      py,
      clamp(margin, 1, width - sx),
      1,
    );
  };
  const edgeT = (px: number) => {
    const sy = clamp(y1 - margin, 0, height - 1);
    return sampleRegionAvg(data, width, px, sy, 1, clamp(margin, 1, y1));
  };
  const edgeB = (px: number) => {
    const sy = clamp(y2 + 1, 0, height - 1);
    return sampleRegionAvg(
      data,
      width,
      px,
      sy,
      1,
      clamp(margin, 1, height - sy),
    );
  };

  const bw = x2 - x1 || 1;
  const bh = y2 - y1 || 1;

  for (let py = y1; py <= y2; py++) {
    const ty = (py - y1) / bh;

    for (let px = x1; px <= x2; px++) {
      const tx = (px - x1) / bw;

      const l = edgeL(py),
        r = edgeR(py);
      const t = edgeT(px),
        b = edgeB(px);

      // Blend horizontal + vertical gradients, weighted toward edges
      const idx = (py * width + px) * 4;
      for (let c = 0; c < 3; c++) {
        const h = l[c] * (1 - tx) + r[c] * tx;
        const v = t[c] * (1 - ty) + b[c] * ty;
        // Edge-distance weighting: pixels near borders trust their closer edge more
        const wx = Math.min(tx, 1 - tx) * 2; // 0 near L/R edges, 1 at center
        const wy = Math.min(ty, 1 - ty) * 2;
        data[idx + c] =
          h * (1 - wy * 0.5) * 0.5 + v * (1 - wx * 0.5) * 0.5 + (h + v) * 0.25;
      }
      data[idx + 3] = 255;
    }
  }
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
): string[] {
  const lines: string[] = [];

  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(" ");
    let line = "";

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;

      if (ctx.measureText(candidate).width <= maxW) {
        line = candidate;
      } else {
        // Word doesn't fit — try hyphenating it
        if (ctx.measureText(word).width > maxW) {
          // Push whatever line we had first
          if (line) {
            lines.push(line);
            line = "";
          }

          // Split the long word with hyphens
          let chunk = "";
          for (const char of word) {
            const trial = chunk + char + "-";
            if (ctx.measureText(trial).width > maxW && chunk) {
              lines.push(chunk + "-");
              chunk = char;
            } else {
              chunk += char;
            }
          }
          // chunk remainder becomes the start of the next line
          line = chunk;
        } else {
          if (line) lines.push(line);
          line = word;
        }
      }
    }

    if (line) lines.push(line);
  }

  return lines;
}

/**
 * Shrinks font until the wrapped text fits inside the bbox, then draws it centered.
 */

function drawFittedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  bbox: Bbox,
  fontStack = "'Segoe UI', sans-serif",
  maxFontSize = 40,
) {
  const pad = 8;
  const maxW = bbox.x2 - bbox.x1 - pad * 2;
  const maxH = bbox.y2 - bbox.y1 - pad * 2;
  if (maxW <= 0 || maxH <= 0) return;

  let fontSize = Math.min(maxFontSize, maxH);
  let lines: string[] = [];

  while (fontSize >= 4) {
    ctx.font = `600 ${fontSize}px ${fontStack}`;
    lines = wrapText(ctx, text, maxW);
    const lineH = fontSize <= 6 ? fontSize * 1.1 : fontSize * 1.25;
    if (lines.length * lineH <= maxH) break;
    fontSize--;
  }

  const lineH = fontSize * 1.25;
  const blockH = lines.length * lineH;
  const startY = bbox.y1 + pad + Math.max(0, (maxH - blockH) / 2);
  const centerX = (bbox.x1 + bbox.x2) / 2;

  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  // Thin white stroke for legibility on any background
  ctx.lineWidth = fontSize * 0.25;
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.fillStyle = "#1a1a1a";

  lines.forEach((line, i) => {
    const y = startY + i * lineH;
    ctx.strokeText(line, centerX, y);
    ctx.fillText(line, centerX, y);
  });
}

/**
 * Inpaints bboxes on a manga image then renders translated text into each one.
 * Returns an object URL (more efficient than base64 for display).
 */
export async function repaintWithTranslations(
  imageSrc: string,
  bboxes: Bbox[],
  translations: Translation[],
): Promise<string> {
  const selectedFont =
    (await storage.getItem<string>("sync:text-font")) ?? "Segoe UI";
  const customFonts =
    (await storage.getItem<{ name: string; dataUrl: string }[]>(
      "local:custom-fonts",
    )) ?? [];

  let fontStack = BUNDLED_FONT_STACKS[selectedFont];

  if (!fontStack) {
    const custom = customFonts.find((f) => f.name === selectedFont);
    if (custom) {
      const face = new FontFace(custom.name, `url(${custom.dataUrl})`);
      await face.load();
      document.fonts.add(face);
      fontStack = `'${custom.name}', sans-serif`;
    } else {
      fontStack = "'Segoe UI', sans-serif";
    }
  }

  const response = await fetch(imageSrc);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);

  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;

  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  // Single getImageData → inpaint all bboxes in-buffer → single putImageData
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (const bbox of bboxes) inpaintBbox(imgData, bbox);
  ctx.putImageData(imgData, 0, 0);

  // Map "1"-indexed box numbers to text
  const byBox = new Map(translations.map((t) => [t.box, t.text]));

  bboxes.forEach((bbox, i) => {
    const text = byBox.get(String(i + 1));
    if (text) drawFittedText(ctx, text, bbox, fontStack);
  });

  return canvas.toDataURL("image/png");
}

export function sendBboxData(
  seriesName: string,
  chapterId: string,
  pageIndex: number,
  bboxes: Bbox[],
  originalSrc: string,
) {
  fetchAsBase64(originalSrc).then(
    (imageBase64) =>
      fetch(import.meta.env.WXT_SUPABASE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.WXT_SUPABASE_PUBLIC_KEY}`,
        },
        body: JSON.stringify({
          seriesName,
          chapterId,
          pageIndex,
          bboxes,
          imageBase64,
        }),
      }).catch(() => {}), // silently ignore failures
  );
}
