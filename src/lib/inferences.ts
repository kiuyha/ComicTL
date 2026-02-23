import * as ort from "onnxruntime-web/all";
import { getModel, letterboxImage, restoreBoundingBox } from "./utils";

const DETECTION_MODEL_REPO = import.meta.env.WXT_DETECTION_MODEL_REPO;
const DETECTION_MODEL_PATH = import.meta.env.WXT_DETECTION_MODEL_PATH;

ort.env.wasm.wasmPaths = browser.runtime.getURL("/");

let session: ort.InferenceSession | null = null;
let isDetecting = false;

export async function detectTextBubble(
  base64Img: string,
  minConfidence: number = 0.5,
) {
  const {imageData, origWidth, origHeight} = await letterboxImage(base64Img);

  if (!session)
    session = await getModel(DETECTION_MODEL_REPO, DETECTION_MODEL_PATH);

  if (isDetecting) {
    throw new Error("Model is currently busy processing another image.");
  }
  isDetecting = true;

  const targetSize = imageData.width;
  const channelSize = targetSize * targetSize;
  const imageBuffer = new Float32Array(3 * channelSize);

  // Separate the RGB channels and normalize them to 0.0 - 1.0
  for (let i = 0; i < channelSize; i++) {
    const rgbaIndex = i * 4;
    imageBuffer[i] = imageData.data[rgbaIndex] / 255.0;
    imageBuffer[i + channelSize] = imageData.data[rgbaIndex + 1] / 255.0;
    imageBuffer[i + channelSize * 2] = imageData.data[rgbaIndex + 2] / 255.0;
  }

  // Create the tensor and execute the YOLO model
  const tensor = new ort.Tensor("float32", imageBuffer, [
    1,
    3,
    targetSize,
    targetSize,
  ]);
  const feeds: Record<string, ort.Tensor> = {};
  feeds[session.inputNames[0]] = tensor;

  try {
    const results = await session.run(feeds);
    const outputName = session.outputNames[0];
    const detections = (await results[outputName].getData()) as Float32Array;

    // Format the detections
    const formattedDetections = [];

    for (let i = 0; i < detections.length; i += 6) {
      const x1 = detections[i];
      const y1 = detections[i + 1];
      const x2 = detections[i + 2];
      const y2 = detections[i + 3];
      const confidence = detections[i + 4];
      const classId = detections[i + 5];

      if (Number.isNaN(confidence) || confidence < minConfidence) {
        continue;
      }
      formattedDetections.push(
        restoreBoundingBox({
          x1, y1, x2, y2, confidence, classId
        }, origWidth, origHeight, targetSize),
      );
    }

    return formattedDetections;
  } finally {
    isDetecting = false;
  }
}
