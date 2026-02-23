<script lang="ts">
  import {
    LoaderCircle,
    Check,
    X,
    Trash2,
    Box,
    CirclePlus,
  } from "lucide-svelte";

  interface Props {
    targetImageRect: DOMRect;
    requestBubbleDetection: () => Promise<Bbox[]>;
    requestTextTranslation: (bboxes: Bbox[]) => Promise<string>;
    onClose: () => void;
  }

  let {
    targetImageRect,
    requestBubbleDetection,
    requestTextTranslation,
    onClose,
  }: Props = $props();
  let mode = $state<"loading" | "refining" | "results">("loading");

  let bboxes = $state<Bbox[]>([]);
  let imageUrl = $state("");
  let activeIndex = $state<number | null>(null);
  let dragInfo = $state<{ index: number; handle: string } | null>(null);

  async function handleConfirm() {
    if (mode !== "refining") return;

    imageUrl = (await requestTextTranslation(bboxes)).trim();
    mode = "results";
  }

  function deleteActiveBox() {
    if (activeIndex !== null) {
      bboxes = bboxes.filter((_, i) => i !== activeIndex);
      activeIndex = null;
    }
  }

  function addBox() {
    bboxes = [
      ...bboxes,
      {
        x1: targetImageRect.left,
        y1: targetImageRect.top,
        x2: Math.random() * targetImageRect.width + targetImageRect.left,
        y2: Math.random() * targetImageRect.height + targetImageRect.top,
      },
    ];
    activeIndex = bboxes.length - 1;
  }

  function handleDragStart(index: number, handle: string) {
    return (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      dragInfo = { index, handle };
    };
  }

  onMount(async () => {
    bboxes = await requestBubbleDetection();
    console.log(bboxes)
    mode = "refining";
  });

  $effect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // Okay if they click on the overlay
      if (target.closest("#comic-tl-overlay")) {
        return;
      }

      // If they click outside the active box and not a box handle
      if (activeIndex !== null && !target.closest(".handle")) {
        activeIndex = null;
      }

      // If they click the manga page or background, block the event
      event.stopPropagation();
      event.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // If user hits Escape, deselect the active box
      if (e.key === "Escape") {
        activeIndex = null;
      }
      // Delete active box if user hits Delete or Backspace
      if ((e.key === "Delete" || e.key === "Backspace") && activeIndex !== null) {
        deleteActiveBox();
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragInfo) return;

      const { index, handle } = dragInfo;
      const box = bboxes[index];

      // Update coordinates based on which handle is active
      if (handle.includes("t")) box.y1 = e.clientY;
      if (handle.includes("b")) box.y2 = e.clientY;
      if (handle.includes("l")) box.x1 = e.clientX;
      if (handle.includes("r")) box.x2 = e.clientX;

      if (box.x1 > box.x2) [box.x1, box.x2] = [box.x2, box.x1];
      if (box.y1 > box.y2) [box.y1, box.y2] = [box.y2, box.y1];
    };

    const handleMouseUp = () => {
      if (dragInfo) {
        const box = bboxes[dragInfo.index];

        // Normalize coordinates so x1/y1 is always the top-left
        if (box.x1 > box.x2) [box.x1, box.x2] = [box.x2, box.x1];
        if (box.y1 > box.y2) [box.y1, box.y2] = [box.y2, box.y1];
      }
      dragInfo = null;
    };

    if (dragInfo) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    window.addEventListener("click", handleClick, { capture: true });
    window.addEventListener("keydown",handleKeyDown);
    return () => {
      window.removeEventListener("click", handleClick, { capture: true });
      window.removeEventListener("keydown",handleKeyDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  });
</script>

<div
  class="absolute top-0 left-0 overflow-hidden pointer-events-auto group z-50 w-full h-full"
>
  {#if mode === "loading"}
    <div
      class="absolute inset-0 flex items-center justify-center z-70 backdrop-blur-[1px]"
    >
      <LoaderCircle size={48} class="animate-spin text-white" />
    </div>
  {/if}

  {#if mode === "refining"}
    <div
      class="absolute inset-0 {!bboxes.length
        ? 'bg-black/50'
        : ''}"
    ></div>

    <div
      class="toolbar absolute top-4 left-1/2 -translate-x-1/2 bg-white shadow-lg rounded-lg p-2 flex gap-2 z-60 border border-gray-200 {dragInfo
        ? 'opacity-30 pointer-events-none'
        : ''}"
      onmousedown={(e) => e.stopPropagation()}
      role="presentation"
    >
      <button
        onclick={onClose}
        class="absolute -top-2 -right-2 cursor-pointer bg-gray-200 rounded-full p-1 hover:bg-gray-300 transition-colors"
      >
        <X size={18} />
      </button>

      <button
        onclick={addBox}
        class="cursor-pointer flex flex-col items-center justify-center px-3 py-1 rounded text-sm font-medium transition-colors hover:bg-gray-100 text-gray-700 border border-gray-200"
      >
        <!-- <div class=""> -->
        <Box size={18} />
        <!-- <CirclePlus size={5} /> -->
        <!-- </div> -->
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
        onclick={handleConfirm}
        class="cursor-pointer flex flex-col items-center px-3 py-1 rounded text-sm font-medium transition-colorshover:bg-green-100 text-green-700 border border-green-200"
      >
        <Check size={18} />
        <span>Confirm</span>
      </button>
    </div>

    {#each bboxes as box, i}
      {@const isActive = activeIndex === i}

      <div
        role="presentation"
        class="absolute border-2 transition-all p-0 m-0 bg-transparent {isActive
          ? 'border-blue-500 z-50 ring-2 ring-blue-300'
          : 'border-red-500 z-40'}"
        style:left="{box.x1}px"
        style:top="{box.y1}px"
        style:width="{box.x2 - box.x1}px"
        style:height="{box.y2 - box.y1}px"
        onmousedown={(e) => {
          e.stopPropagation();
          activeIndex = i;
        }}
      >
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
      src={imageUrl}
      alt="Translated Img"
      class="w-full h-full object-contain"
    />
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
</style>
