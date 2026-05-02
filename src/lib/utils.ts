import * as ort from "onnxruntime-web/all";

export async function fetchAsBase64(url: string) {
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

export function downloadArtifactHF(
  repoID: string,
  path: `${string}.onnx`,
  autoUpdate?: boolean,
  noReturn?: boolean,
): Promise<ort.InferenceSession>;

export function downloadArtifactHF(
  repoID: string,
  path: string,
  autoUpdate?: boolean,
  noReturn?: boolean,
): Promise<Response>;

export async function downloadArtifactHF(
  repoID: string,
  path: string,
  autoUpdate?: boolean,
  noReturn?: boolean,
): Promise<ort.InferenceSession | Response | undefined> {
  console.log(`Downloading ${repoID}/${path}`);
  const url = `https://huggingface.co/${repoID}/resolve/main/${path}`;
  const cache = await caches.open(repoID);

  let response = await cache.match(url);
  let needsUpdate = !response;

  if (autoUpdate && response) {
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
        "Offline: skipping update check and using cache. Error:",
        error,
      );
    }
  }

  if (!response || needsUpdate) {
    response = await fetch(url);
    await cache.put(url, response.clone());
  }

  if (noReturn) return;

  if (path.endsWith(".onnx")) {
    return ort.InferenceSession.create(await response.arrayBuffer(), {
      executionProviders: ["webnn", "webgpu", "wasm"],
    });
  } else {
    return response;
  }
}

export async function openSetupTab(modelId?: string) {
  let targetUrl = browser.runtime.getURL("/setup.html");
  if (modelId) {
    targetUrl += `?model=${modelId}`;
  }

  // Check if any tab is already open with the setup page
  const existingTabs = await browser.tabs.query({
    url: browser.runtime.getURL("/setup.html") + "*",
  });

  if (existingTabs.length > 0) {
    const tab = existingTabs[0];

    await browser.tabs.update(tab.id, {
      active: true,
      ...(modelId ? { url: targetUrl } : {}),
    });

    await browser.windows.update(tab.windowId, { focused: true });
  } else {
    await browser.tabs.create({ url: targetUrl });
  }
}
