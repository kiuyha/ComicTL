<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import {
    Zap,
    BookOpen,
    Settings as SettingsIcon,
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
  } from "lucide-svelte";

  let isFirstRun = $state(true);
  let activeTab = $state("home");
  let autoScan = $state(false);
  let shareData = $state(true);
  let geminiKey = $state("");
  let geminiModel = $state("gemini-3.1-flash-lite-preview");
  let detectionModel = $state("yolo26n");
  let sourceLang = $state("EN");
  let targetLang = $state("EN");
  let activeDropdown = $state<"source" | "target" | null>(null);
  let searchQuery = $state("");

  let autoUpdateModel = $state(true);
  let performanceOverlay = $state(false);
  let seriesSummary = $state("");
  let dictionaryStr = $state("");
  let currentMode = $state("local");
  let activeDevice = $state("cpu");
  let loadingSettings = $state(true);
  let hasApiKey = $derived(geminiKey.trim().length > 0);

  const tabs = [
    { id: "home", label: "Home", icon: Zap },
    { id: "context", label: "Context", icon: BookOpen },
    { id: "settings", label: "Settings", icon: SettingsIcon },
  ];

  const modes = [
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
    await storage.setItem("sync:is-first-run", false);
  }

  let tabIndex = $derived(tabs.findIndex((t) => t.id === activeTab));
  const languages: { code: string; name: string }[] = JSON.parse(
    import.meta.env.WXT_LANGUAGES ??
      `[{"code": "EN", "name": "English"}, {"code": "ID", "name": "Indonesian"}, {"code": "JA", "name": "Japanese"}, {"code": "KO", "name": "Korean"}, {"code": "ZH", "name": "Chinese"}, {"code": "ES", "name": "Spanish"}]`,
  );
  const geminiModels = JSON.parse(
    import.meta.env.WXT_GEMINI_MODELS ||
      '[{"id": "gemini-3.1-flash-lite-preview", "label": "Gemini 3.1 Flash Lite"}]',
  );
  const detectionModels = JSON.parse(
    import.meta.env.WXT_DETECTION_MODELS ||
      '[{"id": "yolo26n", "label": "YOLO26-Nano"}, {"id": "yolo26s", "label": "YOLO26-Small"}]',
  );

  const filteredLanguages = $derived(
    languages.filter((l) =>
      l.name.toLowerCase().includes(searchQuery.toLowerCase()),
    ),
  );

  function swapLanguages() {
    const temp = sourceLang;
    sourceLang = targetLang;
    targetLang = temp;
  }

  function openDropdown(type: "source" | "target") {
    activeDropdown = activeDropdown === type ? null : type;
    searchQuery = "";
  }

  function selectLanguage(code: string) {
    if (activeDropdown === "source") sourceLang = code;
    if (activeDropdown === "target") targetLang = code;
    activeDropdown = null;
  }

  async function loadSettings() {
    isFirstRun = (await storage.getItem("sync:is-first-run")) ?? isFirstRun;
    shareData = (await storage.getItem("sync:share-data")) ?? shareData;
    autoUpdateModel =
      (await storage.getItem("sync:auto-update-model")) ?? autoUpdateModel;
    performanceOverlay =
      (await storage.getItem("sync:performance-overlay")) ?? performanceOverlay;
    geminiKey = (await storage.getItem("sync:gemini-key")) ?? geminiKey;
    geminiModel = (await storage.getItem("sync:gemini-model")) ?? geminiModel;
    detectionModel =
      (await storage.getItem("sync:detection-model")) ?? detectionModel;
    currentMode = (await storage.getItem("sync:current-mode")) ?? currentMode;

    activeDevice =
      (await storage.getItem("local:active-device")) ?? activeDevice;
    loadingSettings = false;
  }

  loadSettings();

  $effect(() => {
    if (!loadingSettings) {
      storage.setItem("sync:is-first-run", isFirstRun);
      storage.setItem("sync:share-data", shareData);
      storage.setItem("sync:auto-update-model", autoUpdateModel);
      storage.setItem("sync:performance-overlay", performanceOverlay);
      storage.setItem("sync:gemini-key", geminiKey);
      storage.setItem("sync:gemini-model", geminiModel);
      // storage.setItem("sync:auto-scan", autoScan);
      storage.setItem("sync:source-lang", sourceLang);
      storage.setItem("sync:target-lang", targetLang);
      storage.setItem("sync:detection-model", detectionModel);
      storage.setItem("sync:current-mode", currentMode);

      storage.setItem("sync:series-summary", seriesSummary);
      storage.setItem("sync:dictionary-str", dictionaryStr);
    }

    const handleClick = () => {
      activeDropdown = null;
    };

    window.addEventListener("click", handleClick);

    return () => {
      window.removeEventListener("click", handleClick);
    };
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

      {#each tabs as tab}
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
                {#each modes as mode}
                  <button
                    disabled={mode.disable()}
                    onclick={() => (currentMode = mode.id)}
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
                  Local mode active. OCR and translation will run on your {activeDevice.toUpperCase()}.
                </p>
              </div>
            {:else if currentMode === "cloud"}
              <div class="flex gap-2 text-emerald-600 dark:text-emerald-500">
                <Sparkles size={14} class="shrink-0 mt-0.5" />
                <p class="text-xs leading-relaxed">
                  Cloud mode active. Using Gemini API for improved accuracy.
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
                {languages.find((l) => l.code === sourceLang)?.name}
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
                {languages.find((l) => l.code === targetLang)?.name}
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
                    {#each filteredLanguages as lang}
                      <button
                        onclick={() => selectLanguage(lang.code)}
                        class="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-colors
              {(activeDropdown === 'source' ? sourceLang : targetLang) ===
                        lang.code
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 font-bold'
                          : ''}"
                      >
                        {lang.name}
                      </button>
                    {/each}

                    {#if filteredLanguages.length === 0}
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
              for="summary"
              class="text-xs font-bold uppercase tracking-widest text-zinc-500 ml-1"
              >Series Summary</label
            >
            <textarea
              id="summary"
              bind:value={seriesSummary}
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
              bind:value={dictionaryStr}
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
          <div class="space-y-1.5">
            <label
              for="key"
              class="text-xs font-bold uppercase tracking-widest text-zinc-500 ml-1"
              >Gemini API Key</label
            >
            <input
              id="key"
              type="password"
              bind:value={geminiKey}
              placeholder="AIzaSy..."
              class="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-sm focus:ring-1 focus:ring-blue-500 outline-none transition-all"
            />
          </div>

          {#if currentMode === "cloud"}
            <div class="space-y-1.5">
              <label
                for="gemini-model"
                class="text-xs font-bold uppercase tracking-widest text-zinc-500 ml-1"
                >Gemini Model</label
              >
              <select
                id="gemini-model"
                bind:value={geminiModel}
                class="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 text-xs outline-none cursor-pointer"
              >
                {#each geminiModels as model}
                  <option value={model.id}>{model.label}</option>
                {/each}
              </select>
            </div>
          {/if}

          <div class="grid grid-cols-2 gap-3 pt-2">
            <div class="flex flex-col space-y-1.5">
              <label
                for="detection-model"
                class="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1"
                >Detection</label
              >
              <select
                id="detection-model"
                bind:value={detectionModel}
                class="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 text-xs outline-none cursor-pointer"
              >
                {#each detectionModels as model}
                  <option value={model.id}>{model.label}</option>
                {/each}
              </select>
            </div>
            <div class="flex flex-col space-y-1.5">
              <label
                for="updates"
                class="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1"
                >Auto-Update</label
              >
              <div class="h-full flex items-center px-2">
                <label class="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    bind:checked={autoUpdateModel}
                    class="sr-only peer"
                  />
                  <div
                    class="w-9 h-5 bg-zinc-300 dark:bg-zinc-700 rounded-full peer peer-checked:bg-blue-500 transition-all after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4"
                  ></div>
                </label>
              </div>
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
                >Performance Overlay</span
              >
              <div class="relative flex items-center">
                <input
                  type="checkbox"
                  bind:checked={performanceOverlay}
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

            <label
              class="flex items-center justify-between cursor-pointer group"
            >
              <span
                class="text-sm font-medium group-hover:text-blue-500 transition-colors"
                >Data Sharing</span
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
        </div>
      {/if}
    </div>
  {/if}
</main>
