import { detectTextBubble } from "@/lib/inferences";
import { letterboxImage } from "@/lib/utils";

browser.runtime.onMessage.addListener(async (msg, _, sendResponse) => {
    if (msg.type === "DETECT_BBOX") {
        // Resize the image to 1280x1280
        const imageData = await letterboxImage(msg.data, 1280);

        // sent imageData to detection model
        const result = await detectTextBubble(imageData);

        sendResponse(result);
        return true;
    }
})