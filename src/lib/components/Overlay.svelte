<script lang="ts">
  import {
    LoaderCircle,
    Check,
    X,
    Trash2,
    Box,
    Undo,
    Redo,
    ArrowUpNarrowWide,
    ArrowDownUp,
    TriangleAlert,
  } from "lucide-svelte";

  interface Props {
    targetImageRect: DOMRect;
    scaleX: number;
    scaleY: number;
    originalSrc: string;
    wrapper: HTMLElement;
    getTranslationCache: () => Promise<{
      bboxes: Bbox[];
      translatedSrc: string;
    } | null>;
    requestBubbleDetection: () => Promise<Bbox[] | { error: string }>;
    requestTextTranslation: (
      bboxes: Bbox[],
      isManuallySorted: boolean
    ) => Promise<string | { error: string }>;
    onClose: () => void;
  }

  const PADDING_PX = 10;

  let {
    targetImageRect,
    scaleX,
    scaleY,
    originalSrc,
    wrapper,
    getTranslationCache,
    requestBubbleDetection,
    requestTextTranslation,
    onClose,
  }: Props = $props();

  let toolbarPosition = $state<"top" | "bottom">("top");
  let mode = $state<"loading" | "refining" | "results">("loading");
  let bboxes = $state<Bbox[]>([]);
  let isManuallySorted = $state(false);
  let translatedUrl = $state("");
  let showOriginal = $state(false);
  let previousImageUrl = $state("");
  let activeIndex = $state<number | null>(null);
  let dragInfo = $state<{
    index: number;
    handle: string;
    startX: number;
    startY: number;
    initialBox: Bbox;
  } | null>(null);
  let history = $state<Bbox[][]>([]);
  let historyIndex = $state(-1);
  let loadingMsg = $state("Please wait while we find the text...");
  let errorMsg = $state("");
  let errorTimer: ReturnType<typeof setTimeout>;

  function showError(msg: string) {
    clearTimeout(errorTimer);
    errorMsg = msg;
    errorTimer = setTimeout(() => (errorMsg = ""), 5000);
  }

  function applyBboxesSort() {
    let totalHeight = 0;

    bboxes.forEach((box) => {
      totalHeight += box.y2 - box.y1;
    });

    const avgHeight = bboxes.length > 0 ? totalHeight / bboxes.length : 100;
    // 75% of an average bubble is a very safe threshold for the same panel row
    const yTolerance = avgHeight * 0.75;

    const originalBboxes = bboxes.slice();
    bboxes.sort((a, b) => {
      // Compare the center points instead of the top edges
      const aCenterY = (a.y1 + a.y2) / 2;
      const bCenterY = (b.y1 + b.y2) / 2;
      const yDiff = aCenterY - bCenterY;

      // If they are on roughly the same horizontal line
      if (Math.abs(yDiff) < yTolerance) {
        // Sort Right-to-Left using center X
        const aCenterX = (a.x1 + a.x2) / 2;
        const bCenterX = (b.x1 + b.x2) / 2;
        return bCenterX - aCenterX;
      }

      // Otherwise, sort Top-to-Bottom
      return yDiff;
    });

    if (!originalBboxes.every((box, i) => box.x1 === bboxes[i].x1))
      saveHistory();
    activeIndex = null;
  }

  function saveHistory() {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push($state.snapshot(bboxes));
    history = newHistory;
    historyIndex = history.length - 1;
  }

  function undo() {
    if (historyIndex > 0) {
      historyIndex--;
      bboxes = $state.snapshot(history[historyIndex]);
      activeIndex = null;
    }
  }

  function redo() {
    if (historyIndex < history.length - 1) {
      historyIndex++;
      bboxes = $state.snapshot(history[historyIndex]);
      activeIndex = null;
    }
  }

  async function handleConfirm() {
    if (mode !== "refining") return;

    mode = "loading";
    loadingMsg = "Please wait while we translate the text...";
    applyBboxesSort();

    const translations = await requestTextTranslation($state.snapshot(bboxes), isManuallySorted);
    if (typeof translations === "object" && translations?.error) {
      mode = "refining";
      showError(translations.error);
      return;
    } else if (typeof translations === "string") {
      translatedUrl = translations.trim();
      mode = "results";
    }
  }

  function deleteActiveBox() {
    if (activeIndex !== null) {
      bboxes = bboxes.filter((_, i) => i !== activeIndex);
      saveHistory();
      activeIndex = null;
    }
  }

  function addBox() {
    bboxes = [
      ...bboxes,
      {
        x1: targetImageRect.left,
        y1: targetImageRect.top,
        x2: 0.5 * targetImageRect.width + targetImageRect.left,
        y2: 0.5 * targetImageRect.height + targetImageRect.top,
      },
    ];
    if (!isManuallySorted) {
      applyBboxesSort();
    } else {
      saveHistory();
    }
    activeIndex = bboxes.length - 1;
  }

  function handleDragStart(index: number, handle: string) {
    return (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      dragInfo = {
        index,
        handle,
        startX: e.clientX,
        startY: e.clientY,
        initialBox: { ...bboxes[index] },
      };
    };
  }

  onMount(async () => {
    const initialCache = await getTranslationCache();

    const rawBboxes = initialCache
      ? initialCache.bboxes
      : await requestBubbleDetection();

    if (!Array.isArray(rawBboxes)) {
      showError(rawBboxes?.error);
      setTimeout(() => onClose(), 5000); // closes after error fades
      return;
    }

    if (rawBboxes.length === 0) {
      showError("No text bubbles detected — add boxes manually");
    }

    bboxes = rawBboxes.map((box) => ({
      x1: Math.max(0, box.x1 - PADDING_PX),
      y1: Math.max(0, box.y1 - PADDING_PX),
      x2: box.x2 + PADDING_PX,
      y2: box.y2 + PADDING_PX,
    }));

    applyBboxesSort();
    mode = initialCache ? "results" : "refining";
    translatedUrl = initialCache?.translatedSrc ?? "";
  });

  $effect(() => {
    const handleClick = (event: MouseEvent) => {
      const path = event.composedPath() as HTMLElement[];

      if (
        path.some(
          (el) =>
            el.classList?.contains("comictl-box") ||
            el.classList?.contains("handle") ||
            el.id === "comictl-overlay",
        )
      )
        return;

      activeIndex = null;
      event.stopPropagation();
      event.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();

      // If user hits Escape, deselect the active box
      if (e.key === "Escape") {
        activeIndex = null;
      }
      // Delete active box if user hits Delete or Backspace
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        activeIndex !== null
      ) {
        deleteActiveBox();
      }

      // Undo if user click ctrl + z
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        // redo if the shift key being push
        if (e.shiftKey) redo();
        else undo();
      }

      // Undo if user click ctrl + y
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") redo();
    };

    const handleMouseMove = (e: MouseEvent) => {
      requestAnimationFrame(() => {
        if (!dragInfo) return;
        const { index, handle, startX, startY, initialBox } = dragInfo;

        // Calculate how much the mouse has moved in "natural" pixels
        const dx = (e.clientX - startX) / scaleX;
        const dy = (e.clientY - startY) / scaleY;

        // Handle Moving the whole box
        if (handle === "move") {
          const w = initialBox.x2 - initialBox.x1;
          const h = initialBox.y2 - initialBox.y1;
          bboxes[index].x1 = initialBox.x1 + dx;
          bboxes[index].y1 = initialBox.y1 + dy;
          bboxes[index].x2 = bboxes[index].x1 + w;
          bboxes[index].y2 = bboxes[index].y1 + h;
        } else {
          // Handle Resizing
          if (handle.includes("t")) bboxes[index].y1 = initialBox.y1 + dy;
          if (handle.includes("b")) bboxes[index].y2 = initialBox.y2 + dy;
          if (handle.includes("l")) bboxes[index].x1 = initialBox.x1 + dx;
          if (handle.includes("r")) bboxes[index].x2 = initialBox.x2 + dx;
        }
      });
    };

    const handleMouseUp = () => {
      if (dragInfo) {
        const box = bboxes[dragInfo.index];
        const initialBox = dragInfo.initialBox;

        // Normalize coordinates so x1/y1 is always the top-left
        if (box.x1 > box.x2) [box.x1, box.x2] = [box.x2, box.x1];
        if (box.y1 > box.y2) [box.y1, box.y2] = [box.y2, box.y1];

        // Calculate how far the box actually changed to ignore accidental micro-drags
        const dx1 = Math.abs(box.x1 - initialBox.x1);
        const dy1 = Math.abs(box.y1 - initialBox.y1);
        const dx2 = Math.abs(box.x2 - initialBox.x2);
        const dy2 = Math.abs(box.y2 - initialBox.y2);
        const moveThreshold = 2;

        if (
          dx1 > moveThreshold ||
          dy1 > moveThreshold ||
          dx2 > moveThreshold ||
          dy2 > moveThreshold
        ) {
          isManuallySorted = true;
          saveHistory();
        }
      }
      dragInfo = null;
    };

    const handleBackToRefine = () => {
      if (mode === "results") {
        previousImageUrl = translatedUrl;
        mode = "refining";
      }
    };

    if (dragInfo) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    if (mode === "refining")
      window.addEventListener("click", handleClick, { capture: true });
    window.addEventListener("keydown", handleKeyDown);
    wrapper.addEventListener("comictl:back-to-refine", handleBackToRefine);

    return () => {
      if (mode === "refining")
        window.removeEventListener("click", handleClick, { capture: true });
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("comictl:back-to-refine", handleBackToRefine);
    };
  });

  const maskPath = $derived.by(() => {
    if (!bboxes.length || !targetImageRect) return "none";

    const width = targetImageRect.width;
    const height = targetImageRect.height;

    // Start with a path that covers the entire image (clockwise)
    let pathString = `M 0 0 h ${width} v ${height} h -${width} z `;

    // Add each box as a sub-path (counter-clockwise or same direction with evenodd)
    const boxPaths = bboxes
      .map((box) => {
        const x = box.x1 * scaleX;
        const y = box.y1 * scaleY;
        const w = (box.x2 - box.x1) * scaleX;
        const h = (box.y2 - box.y1) * scaleY;
        return `M ${x} ${y} h ${w} v ${h} h -${w} z`;
      })
      .join(" ");

    return `path(evenodd, "${pathString} ${boxPaths}")`;
  });
</script>

<div
  id="comictl-overlay"
  role="presentation"
  class="absolute top-0 left-0 overflow-hidden pointer-events-auto group z-50 w-full h-full"
  onclick={(e) => {
    if (mode !== "results") e.stopPropagation();
  }}
>
  {#if mode === "loading"}
    <div
      class="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center z-70"
    >
      <div class="flex flex-col items-center gap-3">
        <LoaderCircle size={40} class="animate-spin text-white" />
        <p class="text-white text-sm font-medium tracking-wide animate-pulse">
          {loadingMsg}
        </p>
      </div>
    </div>
  {/if}

  {#if mode === "refining"}
    <div
      class="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 z-60 transition-all duration-300
    {toolbarPosition === 'top'
        ? 'top-4 flex-col'
        : 'bottom-4 flex-col-reverse'} 
    {dragInfo ? 'opacity-30 pointer-events-none' : ''}"
      onmousedown={(e) => e.stopPropagation()}
      role="presentation"
    >
      <div
        class="relative bg-white shadow-lg rounded-lg p-2 flex gap-2 border border-gray-200"
      >
        <button
          onclick={() => {
            if (previousImageUrl) {
              translatedUrl = previousImageUrl;
              previousImageUrl = "";
              mode = "results";
            } else onClose();
          }}
          class="absolute -top-2 -right-2 cursor-pointer bg-gray-200 rounded-full p-1 hover:bg-gray-300 transition-colors"
        >
          <X size={18} />
        </button>

        <button
          onclick={() =>
            (toolbarPosition = toolbarPosition === "top" ? "bottom" : "top")}
          class="absolute -top-2 -left-2 cursor-pointer bg-gray-200 rounded-full p-1 hover:bg-gray-300 transition-colors"
        >
          <ArrowDownUp size={18} />
        </button>

        <button
          onclick={addBox}
          class="cursor-pointer flex flex-col items-center justify-center px-3 py-1 rounded text-sm font-medium transition-colors hover:bg-gray-100 text-gray-700 border border-gray-200"
        >
          <Box size={18} />
          <span>Add Box</span>
        </button>

        <button
          onclick={deleteActiveBox}
          class="cursor-pointer flex flex-col items-center justify-center px-3 py-1 rounded text-sm font-medium transition-colors
      {activeIndex === null
            ? 'hover:bg-gray-100 text-gray-700 border border-gray-200'
            : 'border border-blue-200 bg-blue-100 text-blue-700'}"
        >
          <Trash2 size={18} />
          <span>Delete Box</span>
        </button>

        <button
          onclick={() => {
            applyBboxesSort();
          }}
          class="cursor-pointer flex flex-col items-center px-3 py-1 rounded text-sm font-medium transition-colors hover:bg-purple-100 text-purple-700 border border-purple-200"
        >
          <ArrowUpNarrowWide size={18} />
          <span>Auto Sort</span>
        </button>

        <button
          onclick={handleConfirm}
          class="cursor-pointer flex flex-col items-center px-3 py-1 rounded text-sm font-medium transition-colors hover:bg-green-100 text-green-700 border border-green-200"
        >
          <Check size={18} />
          <span>Confirm</span>
        </button>
      </div>

      <div class="flex gap-2">
        <button
          onclick={undo}
          disabled={historyIndex <= 0}
          title="Undo"
          class="cursor-pointer p-1.5 bg-white shadow-sm rounded-md border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
        >
          <Undo size={16} />
        </button>

        <button
          onclick={redo}
          disabled={historyIndex >= history.length - 1}
          title="Redo"
          class="cursor-pointer p-1.5 bg-white shadow-sm rounded-md border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
        >
          <Redo size={16} />
        </button>
      </div>
    </div>

    {#if bboxes.length > 0}
      <div
        class="absolute inset-0 bg-black/50 pointer-events-none"
        style="
          clip-path: {maskPath};
          transition: none;
          will-change: clip-path;
        "
      ></div>
    {/if}

    {#each bboxes as box, i}
      {@const isActive = activeIndex === i}

      <div
        role="presentation"
        class="comictl-box absolute border-2 p-0 m-0 bg-transparent {isActive
          ? 'border-blue-500 z-50 ring-2 ring-blue-300'
          : 'border-red-500 z-40'}"
        style:left="{box.x1 * scaleX}px"
        style:top="{box.y1 * scaleY}px"
        style:width="{(box.x2 - box.x1) * scaleX}px"
        style:height="{(box.y2 - box.y1) * scaleY}px"
        onmousedown={(e) => {
          e.stopPropagation();
          activeIndex = i;
          handleDragStart(i, "move")(e);
        }}
      >
        <div
          class="absolute -top-5.5 -left-0.5 bg-red-500 text-white font-bold text-sm px-1.5 py-0.5 min-w-6 text-center rounded-t-sm pointer-events-none"
        >
          {i + 1}
        </div>

        {#if isActive}
          <button
            type="button"
            class="handle top-left"
            onmousedown={handleDragStart(i, "tl")}
            aria-label="Resize top left"
          ></button>
          <button
            type="button"
            class="handle top-right"
            onmousedown={handleDragStart(i, "tr")}
            aria-label="Resize top right"
          ></button>
          <button
            type="button"
            class="handle bottom-left"
            onmousedown={handleDragStart(i, "bl")}
            aria-label="Resize bottom left"
          ></button>
          <button
            type="button"
            class="handle bottom-right"
            onmousedown={handleDragStart(i, "br")}
            aria-label="Resize bottom right"
          ></button>
        {/if}
      </div>
    {/each}
  {/if}

  {#if mode === "results"}
    <img
      src={showOriginal ? originalSrc : translatedUrl}
      alt={showOriginal ? "Original Img" : "Translated Img"}
      class="w-full h-full object-contain"
    />
    <button
      onclick={(e) => {
        e.stopPropagation();
        showOriginal = !showOriginal;
      }}
      class="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white text-xs font-medium px-2 py-1 rounded-md transition-colors backdrop-blur-sm z-50"
    >
      {showOriginal ? "Translated" : "Original"}
    </button>
  {/if}

  {#if errorMsg}
    <div
      class="absolute inset-0 flex items-center justify-center z-70 bg-black/40 backdrop-blur-[1px]"
    >
      <div
        class="flex flex-col items-center gap-3 bg-white rounded-xl shadow-xl px-6 py-5 max-w-[80%] text-center
                animate-[fadeSlideUp_0.3s_ease_forwards]"
      >
        <TriangleAlert size={32} class="text-red-500 shrink-0" />
        <p class="text-sm font-medium text-red-600">{errorMsg}</p>
      </div>
    </div>
  {/if}
</div>

<style>
  @reference "@/assets/app.css";

  .handle {
    @apply absolute w-3 h-3 bg-white border-2 border-blue-500 rounded-full z-50;
    transform: translate(-50%, -50%);
  }
  .top-left {
    top: 0;
    left: 0;
    cursor: nwse-resize;
  }
  .top-right {
    top: 0;
    left: 100%;
    cursor: nesw-resize;
  }
  .bottom-left {
    top: 100%;
    left: 0;
    cursor: nesw-resize;
  }
  .bottom-right {
    top: 100%;
    left: 100%;
    cursor: nwse-resize;
  }
  button {
    appearance: none;
    outline: none;
  }
  @keyframes fadeSlideUp {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
