import * as ort from "onnxruntime-web/all";

export function getBase64Image(img: HTMLImageElement): string {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;

  const ctx = canvas.getContext("2d");
  ctx?.drawImage(img, 0, 0);

  // Compress slightly as a JPEG to keep the message payload lightweight
  return canvas.toDataURL("image/jpeg", 0.9);
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

export async function scalingImage(
  base64Img: string,
  modelSize: number = 1280,
) {
  const response = await fetch(base64Img);
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
  base64Img: string,
  bboxes: Bbox[],
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        return reject(new Error("Failed to get 2d canvas context"));
      }

      ctx.drawImage(img, 0, 0);

      bboxes.forEach((box, index) => {
        const width = box.x2 - box.x1;
        const height = box.y2 - box.y1;
        const boxNumber = (index + 1).toString();

        // Draw the highly visible red bounding box
        ctx.lineWidth = 4;
        ctx.strokeStyle = "#ef4444";
        ctx.strokeRect(box.x1, box.y1, width, height);

        // Calculate text size to draw a solid background block
        ctx.font = "bold 28px sans-serif";
        const textMetrics = ctx.measureText(boxNumber);
        const labelWidth = textMetrics.width + 12;
        const labelHeight = 36;

        // Position the label above the box
        let labelY = box.y1 - labelHeight;
        if (labelY < 0) {
          labelY = box.y1;
        }

        // Draw the solid red background for the number
        ctx.fillStyle = "#ef4444";
        ctx.fillRect(box.x1, labelY, labelWidth, labelHeight);

        // Draw the white number over the red block
        ctx.fillStyle = "#ffffff";
        ctx.textBaseline = "top";
        ctx.fillText(boxNumber, box.x1 + 6, labelY + 4);
      });

      resolve(canvas.toDataURL("image/jpeg", 1));
    };

    img.onerror = () =>
      reject(new Error("Failed to load image for canvas drawing"));
    img.src = base64Img;
  });
}
