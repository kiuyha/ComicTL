# Privacy Policy

**Effective Date:** May 1, 2026
**Last Updated:** May 1, 2026

This Privacy Policy describes how ComicTL ("the Extension," "we," "us," or "our") handles information when you install and use the ComicTL browser extension. Please read it carefully before using the Extension.

---

## 1. Overview

ComicTL is an open-source browser extension that translates manga pages in-place using artificial intelligence. Its architecture is built around one principle: your manga stays on your device.

In its default operating mode (Local Mode), the Extension performs all image processing, text detection, text extraction, and translation directly within your browser using your own hardware. No manga images and no translated text are ever transmitted to our servers (unless you opt into telemetry) or to any third-party server in this mode, because we do not operate any inference servers.

This policy covers the following operating modes and data practices:

- **Local Mode:** fully on-device processing with no external data transmission.
- **Cloud Mode:** optional, user-initiated mode using the user's own Gemini API key.
- **Anonymous Telemetry:** an opt-in data sharing program that includes bounding box coordinates, page images, and series metadata.

> **Default state:** ComicTL collects no personal data and transmits no content data by default. You must affirmatively opt into Cloud Mode and/or telemetry for any outbound data to occur.

---

## 2. Local Mode: Your Device, Your Data

When you use ComicTL in Local Mode (the default), this guarantee holds:

> **Local Mode Guarantee:** No manga images, no raw page content, no extracted text, and no translation output are transmitted to any server operated by ComicTL or any third party while Local Mode is active except you opt into telemetry.

### What runs on your device

All of the following processing occurs exclusively within your browser's sandboxed extension environment, on your local hardware:

- **Bubble detection:** A YOLO-Nano or YOLO-Small ONNX model runs inside a dedicated offscreen document via ONNX Runtime Web. No image data leaves this sandboxed context.
- **Text extraction:** PaddleOCR ONNX model processes the content of each detected bounding box on-device.
- **Translation:** WebLLM loads a local language model into memory and performs inference using your device's GPU via WebGPU. No text is transmitted to any external endpoint.
- **Result rendering:** Translated text is painted onto the page using a canvas overlay that exists only in your browser tab.

### Model weights

The model weights are downloaded from [Hugging Face](https://huggingface.co) when the Extension is first installed or when a model update is available. This download involves only the model weight files and does not include any of your manga images or personal data. Hugging Face's own privacy policy governs that download request.

---

## 3. Cloud Mode: Optional Gemini API Integration

ComicTL offers an optional Cloud Mode that uses Google's Gemini API for translation. Cloud Mode is **disabled by default** and must be explicitly enabled through the Extension's Settings tab.

> **Cloud Mode is opt-in.** It is inactive until you explicitly enable it and enter your own Gemini API key. Once enabled, some data is transmitted to Google's servers as described below.

### What is transmitted in Cloud Mode

When Cloud Mode is active and you confirm a translation, the following data is sent directly from your browser to the Google Gemini API endpoint using your personal API key:

- **The annotated image:** A version of the manga page with numbered bounding boxes drawn over the detected speech bubbles. This processed rendering is sent to Gemini, which performs both OCR and translation in a single step.
- **Series context:** Any title, summary, or custom dictionary entries you have set for the active series in the Context tab.

### What is not transmitted in Cloud Mode

Your Gemini API key is stored locally in the Extension's storage and is sent only to Google's API endpoint. It is never transmitted to ComicTL's servers or any other third party, because no ComicTL-operated server exists.

ComicTL does not act as a proxy for your Gemini API requests. The request goes directly from your browser to Google.

### Google's data practices

When you use Cloud Mode, your use of the Gemini API is governed by Google's Terms of Service and Google's Privacy Policy. The data you transmit to the Gemini API, including the annotated manga image and any series context, is subject to Google's data handling practices. ComicTL has no control over and accepts no liability for how Google processes, stores, or uses data transmitted to the Gemini API.

You are solely responsible for obtaining and managing your Gemini API key and for reviewing Google's applicable terms before enabling Cloud Mode.

---

## 4. Anonymous Telemetry: Opt-In Data Sharing

ComicTL provides an option for users to voluntarily share data to help improve the accuracy of the YOLO detection model. This program is **strictly opt-in** and is presented during the Extension's onboarding flow. You may withdraw at any time through the Settings tab.

> **Default state: ON.** Telemetry is enabled by default during onboarding. If you did not opt in, no telemetry data is ever collected or transmitted.

### What telemetry data contains

If you opt in, the Extension submits the following data to our Supabase-hosted database when you manually adjust, add, or delete bounding boxes:

- **Bounding box coordinates:** The pixel coordinates (x, y, width, height) of each detected and user-adjusted speech bubble, stored as structured JSON.
- **Page image:** The manga page image is uploaded to a storage location and its path is recorded. This image is necessary for model training, as bounding box coordinates alone are not sufficient to train a detection model.
- **Series metadata:** The series name, chapter identifier, and page index are recorded to organize submissions by source and to avoid counting duplicate pages multiple times.

### What telemetry data does not contain

The telemetry submission is not capable of transmitting personal information. It contains no IP addresses (the database does not log client IPs), no browser fingerprints, no device identifiers, no account credentials, and no translated or extracted text.

The submission schema is limited to: a random UUID, a timestamp, series name, chapter ID, page index, image path, a Google Drive URL for the uploaded image, and the bounding box array. Nothing in that schema can be traced back to a specific person.

### How telemetry data is used

Telemetry data is used solely to build training datasets for future versions of the ComicTL YOLO bubble detection model. The bounding box coordinates and associated page images allow us to understand how users correct automated detections, which improves model recall and precision over time. The data is not sold, shared with third parties for commercial purposes, or used for any purpose other than model improvement.

### Telemetry data storage

Telemetry data is stored in a Supabase database. Supabase's own privacy policy and data processing terms apply to the storage of this data. Page images are stored in a Google Drive folder associated with the project. We retain telemetry submissions indefinitely for model training purposes.

---

## 5. Local Storage and Browser Data

The Extension stores certain data locally in your browser using the `chrome.storage` API (or its Firefox equivalent). This data never leaves your device unless you explicitly use Cloud Mode as described in Section 3. Locally stored data includes:

- **Extension settings:** Your selected operating mode (Local or Cloud), model size preference, minimum confidence threshold, font selection, and auto-update preference.
- **Your Gemini API key (Cloud Mode only):** Stored in local extension storage. Never transmitted to ComicTL's servers.
- **Series context:** Any title, summary, and custom dictionary data you create in the Context tab. Stored locally and, in Cloud Mode, transmitted to Google's Gemini API as part of the translation prompt.
- **Translation history:** The last five translation results per series, stored locally to provide context for subsequent page translations. This data remains on your device.
- **Onboarding state:** A flag indicating whether you have completed the onboarding flow and your telemetry opt-in decision.

You may clear all locally stored Extension data at any time by uninstalling the Extension or by clearing browser extension storage through your browser's developer tools.

---

## 6. Third-Party Services

ComicTL interacts with the following third-party services under the conditions specified.

### Hugging Face (huggingface.co)

Model weight files are downloaded from Hugging Face's model hosting infrastructure on first install and when model updates are available (if Auto-Update is enabled in Settings). The download request contains no user content. Hugging Face may log standard server request metadata, such as IP address, per its own privacy policy.

### Google Gemini API (Cloud Mode only)

If you enable Cloud Mode and provide a Gemini API key, annotated manga images and series context data are transmitted directly from your browser to the Google Gemini API. ComicTL does not intermediate or proxy this request. Google's Privacy Policy and Terms of Service govern this transmission.

### Supabase and Google Drive (Telemetry opt-in only)

If you opt into the anonymous telemetry program, bounding box coordinate data and associated page images are transmitted to a Supabase-hosted database and a Google Drive folder. Supabase's Data Processing Agreement and Privacy Policy govern the storage of database records. Google's Privacy Policy governs the storage of images in Google Drive.

---

## 7. Children's Privacy

ComicTL is not directed to children under the age of 13, and we do not knowingly collect personal information from children under 13. Because the Extension does not collect personal information by default, this risk is minimal. If you are a parent or guardian and believe your child has submitted data through the Extension's optional telemetry program, please contact us using the information in Section 10 and we will take steps to delete that data.

---

## 8. Your Rights and Choices

Depending on your jurisdiction, you may have the following rights with respect to your data.

- **Right to access:** You may request a copy of any data we hold. Because ComicTL collects no personal data by default, this right is primarily relevant if you have participated in the opt-in telemetry program.
- **Right to deletion:** You may request deletion of any telemetry data linked to your submissions. Note that telemetry submissions contain no unique user identifiers, which may limit our ability to isolate submissions from a specific individual. Contact us at the address in Section 10 and we will make reasonable efforts to comply.
- **Right to opt out of telemetry:** You may disable telemetry participation at any time by navigating to the Settings tab in the Extension popup and toggling off the data sharing option.
- **Right to uninstall:** Uninstalling the Extension removes all locally stored Extension data from your browser.

Residents of the European Economic Area (EEA) and the United Kingdom may have additional rights under the General Data Protection Regulation (GDPR) and the UK GDPR, including the right to lodge a complaint with a supervisory authority. Because ComicTL processes no personal data in its default operation, the legal basis for any telemetry processing is your explicit consent, which you may withdraw at any time.

Residents of California may have rights under the California Consumer Privacy Act (CCPA). ComicTL does not sell personal information.

---

## 9. Changes to This Policy

We may update this Privacy Policy from time to time to reflect changes in the Extension's functionality, applicable law, or our data practices. When we make material changes, we will update the "Last Updated" date at the top of this page and, where feasible, provide notice through the Extension or its GitHub repository.

Continued use of the Extension after a policy update constitutes your acceptance of the revised policy. If you do not agree with any update, you should discontinue use of the Extension and uninstall it from your browser.

All prior versions of this Privacy Policy are available in the commit history of the Extension's GitHub repository.

---

## 10. Contact

ComicTL is an open-source project. If you have questions, concerns, or requests regarding this Privacy Policy or data handling practices, please contact us through one of the following channels:

- **GitHub Issues:** Open an issue at `github.com/kiuyha/ComicTL` labeled "Privacy".
- **Email:** Send an email to author in [kiuyha.my.id](https://kiuyha.my.id).

We will make reasonable efforts to respond to privacy-related inquiries within 30 days of receipt.
