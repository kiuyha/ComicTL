<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import {
    Zap,
    BookOpen,
    SettingsIcon,
    ShieldCheck,
    Cpu,
    Info,
    RefreshCw,
    Check,
    LoaderCircle,
    Sparkles,
    CircleAlert,
    ArrowRightLeft,
    ChevronDown,
    Search,
    EyeOff,
    Eye,
    Upload,
    X,
    TriangleAlert,
  } from "lucide-svelte";
  import { DefaultConfig } from "@/lib/configs";

  let isFirstRun = $state(true);
  let activeTab = $state("home");
  let autoScan = $state(false);
  let shareData = $state(true);
  let geminiKey = $state("");
  let showKey = $state(false);
  let geminiModel = $state(DefaultConfig.geminiModels[0].id);
  let detectionModel = $state(DefaultConfig.detectionModels[0].id);
  let ocrMinConfidence = $state(DefaultConfig.ocrMinConfidence);
  let sourceLang = $state(DefaultConfig.sourceLang);
  let targetLang = $state(DefaultConfig.targetLang);
  let activeDropdown = $state<"source" | "target" | null>(null);
  let searchQuery = $state("");

  let detectionAutoUpdate = $state(true);
  let detectionMinConfidence = $state(0.5);
  let currentMode = $state(DefaultConfig.currentMode);
  let activeDevice = $state(DefaultConfig.activeDevice);
  let loadingSettings = $state(true);
  let hasApiKey = $derived(geminiKey.trim().length > 0);
  let saveTimer: ReturnType<typeof setTimeout>;
  let textFont = $state(DefaultConfig.bundleFonts[0].id);
  let customFonts = $state<{ name: string; dataUrl: string }[]>([]);
  let fontUploading = $state(false);
  let isDraggingOver = $state(false);
  let latestVersion = $state<{
    currentVersion: string;
    version: string;
    url: string;
  }>({
    currentVersion: browser.runtime.getManifest().version,
    version: "",
    url: "",
  });

  const TABS = [
    { id: "home", label: "Home", icon: Zap },
    { id: "context", label: "Context", icon: BookOpen },
    { id: "settings", label: "Settings", icon: SettingsIcon },
  ];

  const MODES = [
    {
      id: "local",
      label: "Local",
      color: "amber",
      classes: "text-amber-700 dark:text-amber-400",
      activeClasses: "bg-amber-100 dark:bg-amber-900/30",
      disable: () => false,
    },
    {
      id: "cloud",
      label: "Cloud",
      color: "emerald",
      classes: "text-emerald-700 dark:text-emerald-400",
      activeClasses: "bg-emerald-100 dark:bg-emerald-900/30",
      disable: () => !hasApiKey,
    },
  ];

  async function completeOnboarding() {
    isFirstRun = false;
    await storage.setItem("local:is-first-run", false);
  }

  let tabIndex = $derived(TABS.findIndex((t) => t.id === activeTab));

  const visibleLanguages = $derived(
    DefaultConfig.availableLanguages.filter((l) => {
      const matchesSearch = l.toLowerCase().includes(searchQuery.toLowerCase());
      const isTargetAuto = activeDropdown === "target" && l === "Auto-Detect";
      const isLocalAuto =
        activeDropdown === "source" &&
        currentMode === "local" &&
        l === "Auto-Detect";
      return matchesSearch && !isTargetAuto && !isLocalAuto;
    }),
  );

  function setMode(modeId: string) {
    currentMode = modeId;
    if (modeId === "cloud") {
      sourceLang = "Auto-Detect";
    } else if (modeId === "local" && sourceLang === "Auto-Detect") {
      sourceLang = "English";
    }
  }

  function swapLanguages() {
    if (sourceLang === "Auto-Detect") {
      sourceLang = targetLang;
      targetLang = "English";
    } else {
      [sourceLang, targetLang] = [targetLang, sourceLang];
    }
  }

  function openDropdown(type: "source" | "target") {
    activeDropdown = activeDropdown === type ? null : type;
    searchQuery = "";
  }

  function selectLanguage(lang: string) {
    if (activeDropdown === "source") sourceLang = lang;
    if (activeDropdown === "target") targetLang = lang;
    activeDropdown = null;
  }

  async function loadSettings() {
    const items = await storage.getItems([
      "local:is-first-run",
      "sync:share-data",
      "sync:detection-auto-update",
      "sync:detection-min-confidence",
      "sync:ocr-min-confidence",
      "sync:gemini-key",
      "sync:gemini-model",
      "sync:detection-model",
      "sync:current-mode",
      "sync:source-lang",
      "sync:target-lang",
      "local:active-device",
      `sync:context-${seriesName}`,
      "sync:text-font",
      "local:custom-fonts",
    ]);

    const saved = Object.fromEntries(items.map((i) => [i.key, i.value]));

    isFirstRun = saved["local:is-first-run"] ?? isFirstRun;
    shareData = saved["sync:share-data"] ?? shareData;
    detectionAutoUpdate = saved["sync:detection-auto-update"] ?? detectionAutoUpdate;
    detectionMinConfidence =
      saved["sync:detection-min-confidence"] ?? detectionMinConfidence;
    geminiKey = saved["sync:gemini-key"] ?? geminiKey;
    geminiModel = saved["sync:gemini-model"] ?? geminiModel;
    detectionModel = saved["sync:detection-model"] ?? detectionModel;
    ocrMinConfidence = saved["sync:ocr-min-confidence"] ?? ocrMinConfidence;
    currentMode = saved["sync:current-mode"] ?? currentMode;
    sourceLang = saved["sync:source-lang"] ?? sourceLang;
    targetLang = saved["sync:target-lang"] ?? targetLang;
    activeDevice = saved["local:active-device"] ?? activeDevice;
    textFont = saved["sync:text-font"] ?? textFont;
    customFonts = Array.isArray(saved["local:custom-fonts"])
      ? saved["local:custom-fonts"]
      : [];
    const storedCtx = saved[`sync:context-${seriesName}`];
    if (storedCtx) {
      seriesContext = { ...seriesContext, ...storedCtx };
    }

    loadingSettings = false;
  }

  loadSettings();

  function debouncedSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      storage.setItems([
        { key: "local:is-first-run", value: isFirstRun },
        { key: "sync:share-data", value: shareData },
        { key: "sync:detection-auto-update", value: detectionAutoUpdate },
        { key: "sync:detection-min-confidence", value: detectionMinConfidence },
        { key: "sync:gemini-key", value: geminiKey },
        { key: "sync:gemini-model", value: geminiModel },
        { key: "sync:source-lang", value: sourceLang },
        { key: "sync:target-lang", value: targetLang },
        { key: "sync:detection-model", value: detectionModel },
        { key: "sync:current-mode", value: currentMode },
        {
          key: `sync:context-${seriesName}`,
          value: $state.snapshot(seriesContext),
        },
        { key: "sync:text-font", value: textFont },
        { key: "local:custom-fonts", value: $state.snapshot(customFonts) },
      ]);
    }, 150);
  }

  $effect(() => {
    if (!loadingSettings) {
      // touch all state to subscribe, then debounce the actual writes
      [
        isFirstRun,
        shareData,
        detectionAutoUpdate,
        detectionMinConfidence,
        geminiKey,
        geminiModel,
        sourceLang,
        targetLang,
        detectionModel,
        currentMode,
        seriesContext.seriesName,
        seriesContext.summary,
        seriesContext.dictionary,
        textFont,
        customFonts.length,
      ];

      debouncedSave();
    }
  });

  $effect(() => {
    const handleClick = () => (activeDropdown = null);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  });

  function processFontFile(file: File) {
    if (!file.name.match(/\.(ttf|otf|woff|woff2)$/i)) {
      alert("Please upload a .ttf, .otf, .woff, or .woff2 file");
      return;
    }

    fontUploading = true;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const name = file.name.replace(/\.[^.]+$/, "");
      customFonts = [...customFonts, { name, dataUrl }];
      textFont = name;
      fontUploading = false;
    };
    reader.readAsDataURL(file);
  }

  function handleFontUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) processFontFile(file);
    input.value = "";
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) processFontFile(file);
  }

  function deleteCustomFont(name: string) {
    customFonts = customFonts.filter((f) => f.name !== name);
    if (textFont === name) textFont = "system";
  }

  $effect(() => {
    customFonts.forEach(({ name, dataUrl }) => {
      if (!document.fonts.check(`12px "${name}"`)) {
        const face = new FontFace(name, `url(${dataUrl})`);
        face.load().then(() => document.fonts.add(face));
      }
    });
  });

  $effect(() => {
    (async () => {
      try {
        const res = await fetch(import.meta.env.WXT_LATEST_RELEASE_URL, {
          method: "HEAD",
        });

        // fetch follows redirects automatically
        const finalUrl = res.url;
        const tag = finalUrl.split("/").pop(); // "v0.2.3"

        if (!tag) return;

        // Strip the "v" so it matches Chrome's manifest format
        const fetchedVersion = tag.replace(/^v/, "");
        if (fetchedVersion !== latestVersion.currentVersion) {
          latestVersion = {
            currentVersion: latestVersion.currentVersion,
            version: fetchedVersion,
            url: finalUrl,
          };
        }
      } catch (error) {
        console.error("ComicTL: Failed to check for updates", error);
      }
    })();
  });
</script>

<main
  class="w-96 min-h-125 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-4 font-sans flex flex-col transition-colors duration-300"
>
  {#if loadingSettings}
    <div
      in:fade={{ duration: 300 }}
      class="flex flex-col h-full justify-center items-center space-y-6 mt-6"
    >
      <LoaderCircle size={48} class="animate-spin text-white" />
      <h1 class="text-3xl font-bold tracking-tight mb-2">
        Loading Settings Config...
      </h1>
    </div>
  {:else if isFirstRun}
    <div
      in:fade={{ duration: 300 }}
      class="flex flex-col h-full justify-center space-y-6 mt-6"
    >
      <div class="text-center">
        <div class="flex justify-center mb-4">
          <img src="/icon/128.png" alt="" />
        </div>

        <h1 class="text-3xl font-bold tracking-tight mb-2">ComicTL</h1>
        <p class="text-sm text-zinc-500 dark:text-zinc-400 px-8">
          Local-first manga translation powered by YOLO and Gemini.
        </p>
      </div>

      <div
        class="bg-zinc-100 dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800"
      >
        <div class="flex items-center gap-2 mb-3 text-blue-500">
          <ShieldCheck size={18} />
          <h2 class="font-bold">Privacy & Improvement</h2>
        </div>
        <p
          class="text-xs text-zinc-600 dark:text-zinc-400 mb-4 leading-relaxed"
        >
          ComicTL uses local YOLO for detection. Opt-in to share anonymous
          bounding box coordinates to help refine the future models.
        </p>
        <label class="flex items-center space-x-3 cursor-pointer group">
          <div class="relative flex items-center">
            <input
              type="checkbox"
              bind:checked={shareData}
              class="peer sr-only"
            />

            <div
              class="h-5 w-5 rounded border-2 border-zinc-300 dark:border-zinc-700 peer-checked:bg-blue-500 peer-checked:border-blue-500 transition-all"
            ></div>

            <Check
              size={15}
              class="absolute text-white scale-0 peer-checked:scale-100 transition-transform left-0.5"
            />
          </div>

          <span
            class="text-sm font-medium group-hover:text-blue-500 transition-colors text-zinc-700 dark:text-zinc-300"
            >Allow anonymous data sharing</span
          >
        </label>
      </div>

      <button
        onclick={completeOnboarding}
        class="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-xl transition-all active:scale-[0.98] cursor-pointer shadow-lg shadow-blue-600/20"
      >
        Get Started
      </button>
    </div>
  {:else}
    <div class="relative flex bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl mb-6">
      <div
        class="absolute top-1 bottom-1 left-1 bg-white dark:bg-zinc-800 rounded-lg shadow-sm transition-all duration-300 ease-out"
        style="width: calc(33.33% - 2px); transform: translateX({tabIndex *
          100}%);"
      ></div>

      {#each TABS as tab}
        <button
          onclick={() => (activeTab = tab.id)}
          class="relative flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold transition-colors duration-300 cursor-pointer z-10 {activeTab ===
          tab.id
            ? 'text-blue-500'
            : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}"
        >
          <tab.icon size={16} />
          {tab.label}
        </button>
      {/each}
    </div>

    {#if latestVersion?.version && latestVersion.version !== latestVersion.currentVersion}
      <div
        class="flex items-center gap-3 p-3.5 mb-6 text-sm bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-200 rounded-xl"
      >
        <TriangleAlert
          size={25}
          class="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400"
        />
        <p class="leading-relaxed">
          <strong class="font-semibold text-amber-900 dark:text-amber-100"
            >Update Available:</strong
          >
          Version {latestVersion.version} is out.
          <a
            href={latestVersion.url}
            target="_blank"
            rel="noopener noreferrer"
            class="font-medium underline decoration-amber-400/50 hover:decoration-amber-500 dark:hover:decoration-amber-300 transition-colors"
          >
            Download from GitHub
          </a>
        </p>
      </div>
    {/if}

    <div class="grow grid">
      {#if activeTab === "home"}
        <div
          in:fly={{ y: 10, duration: 300, delay: 150 }}
          out:fade={{ duration: 150 }}
          class="col-start-1 row-start-1 space-y-6 flex flex-col h-full"
        >
          {#if !hasApiKey}
            <div
              class="mb-3 flex gap-2 p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-700 dark:text-emerald-400"
            >
              <CircleAlert size={14} class="shrink-0 mt-0.5" />
              <div class="flex flex-col gap-0.5">
                <p class="text-[10px] font-bold uppercase tracking-tight">
                  Cloud Mode Locked
                </p>
                <p class="text-[10px] leading-snug">
                  Add a Gemini API key in Settings to enable high-quality cloud
                  translations.
                </p>
              </div>
            </div>
          {/if}
          <div
            class="bg-zinc-100 dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800"
          >
            <div class="flex justify-between items-center mb-3">
              <span
                class="text-sm font-bold uppercase tracking-wider text-zinc-500"
              >
                Processing Pipeline
              </span>

              <div class="flex items-center gap-1">
                {#each MODES as mode}
                  <button
                    disabled={mode.disable()}
                    onclick={() => setMode(mode.id)}
                    class="cursor-pointer px-2 py-0.5 rounded-full font-bold disabled:cursor-not-allowed disabled:text-gray-500 {mode.classes} {currentMode ===
                    mode.id
                      ? mode.activeClasses
                      : ''}"
                  >
                    {mode.label}
                  </button>
                {/each}
              </div>
            </div>

            {#if currentMode === "local"}
              <div class="flex gap-2 text-amber-600 dark:text-amber-500">
                <Info size={14} class="shrink-0 mt-0.5" />
                <p class="text-xs leading-relaxed">
                  Local mode active. Detection and translation will run on your {activeDevice.toUpperCase()}.
                </p>
              </div>
            {:else if currentMode === "cloud"}
              <div class="flex gap-2 text-emerald-600 dark:text-emerald-500">
                <Sparkles size={14} class="shrink-0 mt-0.5" />
                <p class="text-xs leading-relaxed">
                  Cloud mode active. Using Gemini API for improved translation.
                  Detection run on your {activeDevice.toUpperCase()}.
                </p>
              </div>
            {/if}
          </div>

          <div class="space-y-4">
            <div
              class="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-800"
            >
              <div class="flex flex-col">
                <span class="text-sm font-semibold">Auto-scan Domain</span>
                <span class="text-[10px] text-zinc-500 italic">
                  Scan pages automatically on this site
                </span>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  bind:checked={autoScan}
                  class="sr-only peer"
                />
                <div
                  class="w-10 h-5 bg-zinc-300 dark:bg-zinc-700 rounded-full peer peer-checked:bg-blue-500 transition-all after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"
                ></div>
              </label>
            </div>

            <div
              class="relative flex items-center justify-between p-2 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-800 w-full"
              onclick={(e) => e.stopPropagation()}
              role="presentation"
            >
              <button
                onclick={() => openDropdown("source")}
                class="flex-1 flex items-center justify-center gap-2 p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors text-sm font-semibold"
              >
                {sourceLang}
                <ChevronDown size={14} class="opacity-50" />
              </button>

              <button
                onclick={swapLanguages}
                class="p-2 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors mx-1"
                title="Swap languages"
              >
                <ArrowRightLeft size={16} />
              </button>

              <button
                onclick={() => openDropdown("target")}
                class="flex-1 flex items-center justify-center gap-2 p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors text-sm font-semibold text-blue-500"
              >
                {targetLang}
                <ChevronDown size={14} class="opacity-50" />
              </button>

              {#if activeDropdown}
                <div
                  class="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl z-50 overflow-hidden"
                  in:fade={{ duration: 150 }}
                  out:fade={{ duration: 150 }}
                >
                  <div
                    class="flex items-center gap-2 p-3 border-b border-zinc-100 dark:border-zinc-800"
                  >
                    <Search size={16} class="text-zinc-400" />
                    <input
                      type="text"
                      bind:value={searchQuery}
                      placeholder="Search language..."
                      class="w-full bg-transparent text-sm outline-none"
                    />
                  </div>

                  <div class="max-h-48 overflow-y-auto p-1">
                    {#each visibleLanguages as lang}
                      <button
                        onclick={() => selectLanguage(lang)}
                        class="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-colors
                      {(activeDropdown === 'source'
                          ? sourceLang
                          : targetLang) === lang
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 font-bold'
                          : ''}"
                      >
                        {lang}
                      </button>
                    {/each}

                    {#if visibleLanguages.length === 0}
                      <div class="px-3 py-4 text-center text-sm text-zinc-500">
                        No languages found
                      </div>
                    {/if}
                  </div>
                </div>
              {/if}
            </div>
          </div>

          <button
            class="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-4 rounded-xl mt-auto flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
          >
            <RefreshCw size={18} />
            Translate Now
          </button>
        </div>
      {/if}

      {#if activeTab === "context"}
        <div
          in:fly={{ y: 10, duration: 300, delay: 150 }}
          out:fade={{ duration: 150 }}
          class="col-start-1 row-start-1 space-y-4 flex flex-col h-full"
        >
          <div
            class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-900/30 flex gap-2"
          >
            <Cpu size={14} class="text-blue-500 shrink-0 mt-0.5" />
            <p
              class="text-[11px] text-blue-700 dark:text-blue-400 leading-snug"
            >
              {currentMode === "cloud"
                ? "Gemini uses these as system context for better nuance."
                : "Local models use these as prompt prefixes for consistent naming."}
            </p>
          </div>

          <div class="flex flex-col grow space-y-1.5">
            <label
              for="title"
              class="text-xs font-bold uppercase tracking-widest text-zinc-500 ml-1"
              >Series Title</label
            >
            <input
              type="text"
              id="title"
              bind:value={seriesContext.seriesName}
              placeholder="e.g. One Piece"
              class="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>

          <div class="flex flex-col grow space-y-1.5">
            <label
              for="summary"
              class="text-xs font-bold uppercase tracking-widest text-zinc-500 ml-1"
              >Series Summary</label
            >
            <textarea
              id="summary"
              bind:value={seriesContext.summary}
              placeholder="e.g. Set in the Edo period, a ronin seeks..."
              class="w-full h-24 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none transition-all placeholder:text-zinc-400"
            ></textarea>
          </div>

          <div class="flex flex-col grow space-y-1.5">
            <label
              for="dict"
              class="text-xs font-bold uppercase tracking-widest text-zinc-500 ml-1"
              >Custom Dictionary</label
            >
            <textarea
              id="dict"
              bind:value={seriesContext.dictionary}
              placeholder="Kuro -> 黒&#10;Oni -> Demon"
              class="w-full h-24 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none resize-none transition-all placeholder:text-zinc-400"
            ></textarea>
          </div>
        </div>
      {/if}

      {#if activeTab === "settings"}
        <div
          in:fly={{ y: 10, duration: 300, delay: 150 }}
          out:fade={{ duration: 150 }}
          class="col-start-1 row-start-1 space-y-5 flex flex-col h-full"
        >
          <div>
            <span
              class="text-sm font-bold uppercase tracking-widest text-zinc-500"
              >Detection</span
            >
            <div class="grid grid-cols-3 gap-3 pt-2">
              <div class="flex flex-col space-y-1.5">
                <label
                  for="detection-model"
                  class="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1"
                  >Model</label
                >
                <select
                  id="detection-model"
                  bind:value={detectionModel}
                  class="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 text-xs outline-none cursor-pointer"
                >
                  {#each DefaultConfig.detectionModels as model}
                    <option value={model.id}>{model.label}</option>
                  {/each}
                </select>
              </div>

              <div class="flex flex-col space-y-1.5">
                <label
                  for="detection-model"
                  class="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1"
                  >Min Confidence</label
                >
                <input
                  id="min-confidence"
                  type="number"
                  bind:value={detectionMinConfidence}
                  min="0"
                  max="1"
                  step="0.01"
                  class="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 text-xs outline-none cursor-pointer"
                />
              </div>

              <div class="flex flex-col space-y-1.5">
                <label
                  for="updates"
                  class="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1"
                  >Auto-Update</label
                >
                <div class="h-full flex items-center px-2">
                  <label
                    class="relative inline-flex items-center cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      bind:checked={detectionAutoUpdate}
                      class="sr-only peer"
                    />
                    <div
                      class="w-9 h-5 bg-zinc-300 dark:bg-zinc-700 rounded-full peer peer-checked:bg-blue-500 transition-all after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4"
                    ></div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div>
            <span
              class="text-sm font-bold uppercase tracking-widest text-zinc-500"
              >Gemini</span
            >
            <div class="grid grid-cols-2 gap-3 pt-2">
              <div class="space-y-1.5">
                <label
                  for="key"
                  class="text-xs font-bold uppercase tracking-widest text-zinc-500 ml-1"
                >
                  API Key
                </label>
                <div class="relative">
                  <input
                    id="key"
                    type={showKey ? "text" : "password"}
                    bind:value={geminiKey}
                    placeholder="AIzaSy..."
                    class="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 pr-11 text-sm focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                  />
                  <button
                    type="button"
                    onclick={() => (showKey = !showKey)}
                    class="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors focus:outline-none rounded-xl"
                    aria-label={showKey ? "Hide key" : "Show key"}
                  >
                    {#if showKey}
                      <EyeOff size={18} />
                    {:else}
                      <Eye size={18} />
                    {/if}
                  </button>
                </div>
              </div>

              <div class="space-y-1.5">
                <label
                  for="gemini-model"
                  class="text-xs font-bold uppercase tracking-widest text-zinc-500 ml-1"
                  >Model</label
                >
                <select
                  id="gemini-model"
                  bind:value={geminiModel}
                  class="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 outline-none cursor-pointer"
                >
                  {#each DefaultConfig.geminiModels as model}
                    <option value={model.id}>{model.label}</option>
                  {/each}
                </select>
              </div>
            </div>
          </div>

          <div>
            <span
              class="text-sm font-bold uppercase tracking-widest text-zinc-500"
            >
              Typography
            </span>

            <div class="pt-2 space-y-3">
              <!-- Bundled font picker -->
              <div class="flex flex-col space-y-1.5">
                <label
                  for="bundled-fonts"
                  class="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1"
                >
                  Bubble Font
                </label>
                <div class="grid grid-cols-2 gap-1.5">
                  {#each DefaultConfig.bundleFonts as font}
                    <button
                      onclick={() => (textFont = font.id)}
                      class="px-3 py-2 rounded-xl border text-sm transition-all cursor-pointer text-left
                      {textFont === font.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                        : 'border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400'}"
                      style="font-family: {font.stack}"
                    >
                      {font.label}
                    </button>
                  {/each}
                </div>
              </div>

              <!-- Custom fonts list -->
              {#if customFonts.length > 0}
                <div class="flex flex-col space-y-1">
                  <label
                    for="custom-fonts"
                    class="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1"
                  >
                    Custom Fonts
                  </label>
                  {#each customFonts as font}
                    <div
                      class="flex items-center justify-between px-3 py-1.5 rounded-lg border cursor-pointer transition-all
                      {textFont === font.name
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900'}"
                      role="presentation"
                      onclick={() => (textFont = font.name)}
                    >
                      <span
                        class="text-sm truncate max-w-40"
                        style="font-family: '{font.name}', sans-serif"
                      >
                        {font.name}
                      </span>
                      <button
                        onclick={(e) => {
                          e.stopPropagation();
                          deleteCustomFont(font.name);
                        }}
                        class="text-zinc-400 hover:text-red-500 transition-colors ml-2 cursor-pointer"
                        aria-label="Delete font"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  {/each}
                </div>
              {/if}

              <!-- Upload Drop Area -->
              <label
                ondragover={(e) => {
                  e.preventDefault();
                  isDraggingOver = true;
                }}
                ondragleave={() => (isDraggingOver = false)}
                ondrop={(e) => {
                  isDraggingOver = false;
                  handleDrop(e);
                }}
                class="flex flex-col items-center justify-center gap-1.5 w-full py-4 px-3 rounded-xl border-2 border-dashed
                transition-colors cursor-pointer
                {isDraggingOver
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-500'
                  : 'border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:border-blue-400 hover:text-blue-500'}"
              >
                {#if fontUploading}
                  <LoaderCircle size={18} class="animate-spin" />
                  <span class="text-sm font-medium">Uploading...</span>
                {:else}
                  <Upload size={18} />
                  <span class="text-sm font-medium">Drag & Drop Font Here</span>
                  <span class="text-[10px] opacity-60">(.ttf, .otf, .woff)</span
                  >
                {/if}

                <input
                  type="file"
                  accept=".ttf,.otf,.woff,.woff2"
                  class="sr-only"
                  onchange={handleFontUpload}
                />
              </label>
            </div>
          </div>

          <div
            class="border-t border-zinc-200 dark:border-zinc-800 pt-4 space-y-3"
          >
            <label
              class="flex items-center justify-between cursor-pointer group"
            >
              <span
                class="text-sm font-medium group-hover:text-blue-500 transition-colors"
                >Allow anonymous data sharing</span
              >
              <div class="relative flex items-center">
                <input
                  type="checkbox"
                  bind:checked={shareData}
                  class="peer sr-only"
                />
                <div
                  class="h-4 w-4 rounded border-2 border-zinc-300 dark:border-zinc-700 peer-checked:bg-blue-500 peer-checked:border-blue-500 transition-all"
                ></div>
                <Check
                  size={12}
                  class="absolute text-white scale-0 peer-checked:scale-100 transition-transform left-0.5"
                />
              </div>
            </label>
          </div>

          <div class="text-center">
            <span
              class="text-xs font-bold tracking-wide text-zinc-500 dark:text-zinc-400"
            >
              ComicTL v{latestVersion.currentVersion}
            </span>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</main>
