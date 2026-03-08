# WXT + Svelte

This template should help get you started developing with Svelte in WXT.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Svelte](https://marketplace.visualstudio.com/items?itemName=svelte.svelte-vscode).

```mermaid
graph TD
    Img[Full Manga Page] --> Manual[Source Check]
    Manual --> Auto[Detection Mode]
    Auto --> Yolo[YOLO-Nano ONNX]
    Yolo --> Boxes[Bounding Boxes]
    Boxes --> KeyCheck{API Key Present?}
    
    KeyCheck -- Yes --> Annotator[Draw IDs on Image]
    Annotator --> VisualPrompt[Visual Prompt]
    VisualPrompt --> Gem[Gemini 1.5 Flash API]
    Gem --> ResultGem[Cloud Translated Text]
    
    KeyCheck -- No --> Cropper[Extract Small Images]
    Cropper --> Crops[Image Crops]
    Crops --> OCR[PaddleOCR]
    OCR --> RawText[Raw Japanese Text]
    RawText --> LocalTrans[WebLLM Phi-3-mini]
    LocalTrans --> ResultLocal[Local Translated Text]
    
    ResultGem --> UI[DOM Overlay UI]
    ResultLocal --> UI
```
