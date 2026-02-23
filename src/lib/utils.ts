export function getBase64Image(img: HTMLImageElement): string {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  
  const ctx = canvas.getContext("2d");
  ctx?.drawImage(img, 0, 0);
  
  // Compress slightly as a JPEG to keep the message payload lightweight
  return canvas.toDataURL("image/jpeg", 0.9); 
}

export async function letterboxImage(base64Img: string, targetSize: number = 1280): Promise<ImageData> {
  const response = await fetch(base64Img);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);

  const canvas = new OffscreenCanvas(targetSize, targetSize);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Failed to get canvas context");
  
  // Fill the background with YOLO's standard padding color (gray)
  ctx.fillStyle = "rgb(114, 114, 114)";
  ctx.fillRect(0, 0, targetSize, targetSize);

  // Calculate the scaling factor using the bitmap dimensions
  const scale = Math.min(
    targetSize / bitmap.width, 
    targetSize / bitmap.height
  );
  
  const newWidth = bitmap.width * scale;
  const newHeight = bitmap.height * scale;

  // Calculate the coordinates needed to center the image
  const offsetX = (targetSize - newWidth) / 2;
  const offsetY = (targetSize - newHeight) / 2;

  // Draw the scaled image and extract the raw pixels
  ctx.drawImage(bitmap, offsetX, offsetY, newWidth, newHeight);
  
  return ctx.getImageData(0, 0, targetSize, targetSize); 
}