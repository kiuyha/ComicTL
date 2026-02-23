import { detectTextBubble } from "@/lib/inferences";

browser.runtime.onMessage.addListener((msg, _, sendResponse) => {
  if (msg.type === "DETECT_BBOX") {
    detectTextBubble(msg.data, 0.5).then((result) => sendResponse(result));

    return true; 
  }
});
