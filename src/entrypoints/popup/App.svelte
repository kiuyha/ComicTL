<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import {
    Zap,
    BookOpen,
    SettingsIcon,
    Cpu,
    Info,
    Check,
    LoaderCircle,
    Sparkles,
    ArrowRightLeft,
    ChevronDown,
    Search,
    EyeOff,
    Eye,
    Upload,
    X,
    TriangleAlert,
    Download,
    Play,
    FileCode,
    Trash2,
    Plus,
  } from "lucide-svelte";
  import { DefaultConfig } from "@/lib/configs";
  import { untrack } from "svelte";
  import { openSetupTab } from "@/lib/utils";
  import { COMMUNITY_RULES, getSiteRule } from "@/lib/adapters";

  let {
    hostname,
    title,
    path,
  }: {
    hostname: string;
    title: string;
    path: string;
  } = $props();

  let seriesName = "Unknown Series";
  let ruleId = $state("");
  let activeTab = $state("home");
  let shareData = $state(true);
  let geminiKey = $state("");
  let showKey = $state(false);
  let geminiModel = $state(DefaultConfig.geminiModels[0].id);
  let currentMode = $state(DefaultConfig.currentMode);
  let detectionModel = $state(DefaultConfig.detectionModels[0].id);
  let ocrMinConfidence = $state(DefaultConfig.ocrMinConfidence);
  let sourceLang = $state(DefaultConfig.sourceLang);
  let targetLang = $state(DefaultConfig.targetLang);
  let activeDropdown = $state<"source" | "target" | null>(null);
  let searchQuery = $state("");
  let detectionAutoUpdate = $state(true);
  let detectionMinConfidence = $state(0.5);
  let seriesContext = $state<SeriesContext>({
    seriesName: "",
    summary: "",
    dictionary: "",
    lastChapterId: null,
    lastPageIndex: null,
    recentHistory: [],
    translatedCount: 0,
  });
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
  let prevDetectionModel = untrack(() => detectionModel);
  let prevSourceLang = untrack(() => sourceLang);
  let prevMode = untrack(() => currentMode);
  let isFetchingDetection = $state(false);
  let isFetchingOCR = $state(false);
  let cachedLlms = $state<string[]>([]);
  let llmModel = $state(DefaultConfig.llmModels[0].id);
  let llmTemperature = $state(DefaultConfig.llmTemperature);
  let customRules = $state<SiteRule[]>([]);
  let editingRule = $state<SiteRule | null>(null);
  let testResult = $state<any>(null);
  let isTesting = $state(false);
  let isGeneratingAI = $state(false);

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
    ({ ruleId, seriesName } = await getSiteRule(
      undefined,
      hostname,
      title,
      path,
    ));

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
      "local:cached-llms",
      "sync:llm-model",
      "sync:llm-temperature",
    ]);

    const saved = Object.fromEntries(items.map((i) => [i.key, i.value]));

    shareData = saved["sync:share-data"] ?? shareData;
    detectionAutoUpdate =
      saved["sync:detection-auto-update"] ?? detectionAutoUpdate;
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
    cachedLlms = Array.isArray(saved["local:cached-llms"])
      ? saved["local:cached-llms"]
      : [];
    llmModel = saved["sync:llm-model"] ?? llmModel;
    llmTemperature = saved["sync:llm-temperature"] ?? llmTemperature;
    customRules = saved["sync:custom-site-rules"] ?? customRules;
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
        { key: "sync:share-data", value: shareData },
        { key: "sync:detection-auto-update", value: detectionAutoUpdate },
        { key: "sync:detection-min-confidence", value: detectionMinConfidence },
        { key: "sync:ocr-min-confidence", value: ocrMinConfidence },
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
        { key: "sync:llm-model", value: llmModel },
        { key: "sync:llm-temperature", value: llmTemperature },
        { key: "sync:custom-site-rules", value: $state.snapshot(customRules) },
      ]);
    }, 150);
  }

  $effect(() => {
    if (loadingSettings) return;
    [
      shareData,
      detectionAutoUpdate,
      detectionMinConfidence,
      ocrMinConfidence,
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
      llmModel,
      llmTemperature,
      customRules.length,
    ];
    debouncedSave();

    if (detectionModel !== prevDetectionModel) {
      prevDetectionModel = detectionModel;
      isFetchingDetection = true;

      browser.runtime
        .sendMessage({
          type: "PREFETCH_MODEL",
          data: {
            type: "detection",
            data: detectionModel,
          },
        })
        .finally(() => (isFetchingDetection = false));
    }

    const switchedToLocal = currentMode !== prevMode && currentMode === "local";
    const currentLangGroup =
      DefaultConfig.ocrLangGroupMap[sourceLang] ?? "latin";
    const prevLangGroup =
      DefaultConfig.ocrLangGroupMap[prevSourceLang] ?? "latin";
    const langGroupChangedInLocal =
      currentLangGroup !== prevLangGroup && currentMode === "local";

    if (
      switchedToLocal ||
      (langGroupChangedInLocal && sourceLang !== "Auto-Detect")
    ) {
      prevSourceLang = sourceLang;
      prevMode = currentMode;
      isFetchingOCR = true;

      browser.runtime
        .sendMessage({
          type: "PREFETCH_MODEL",
          data: {
            type: "ocr",
            data: currentLangGroup,
          },
        })
        .finally(() => (isFetchingOCR = false));
    } else {
      prevSourceLang = sourceLang;
      prevMode = currentMode;
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
        const res = await fetch(
          `${import.meta.env.WXT_GITHUB_REPO}/releases/latest`,
          {
            method: "HEAD",
          },
        );

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

  function addRule() {
    editingRule = {
      id: crypto.randomUUID(),
      domain: hostname,
      seriesName: {
        regex: "",
        source: "title",
      },
      chapterId: {
        regex: "",
        source: "path",
      },
      pageIndex: {
        regex: "",
        source: "path",
      },
    };
  }

  function saveRule() {
    const idx = customRules.findIndex((r) => r.id === editingRule!.id);
    if (idx >= 0) customRules[idx] = editingRule!;
    else customRules.push(editingRule!);
    editingRule = null;
    testResult = null;
  }

  async function testRule() {
    isTesting = true;
    testResult = null;
    try {
      const tabs = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tabs[0]?.id)
        testResult = await browser.tabs.sendMessage(tabs[0].id, {
          type: "TEST_REGEX_RULE",
          data: { rule: editingRule },
        });
    } catch (err: any) {
      testResult = { error: "Failed to test rule on active tab." };
    }
    isTesting = false;
  }

  function shareRuleToGitHub(rule: SiteRule) {
    // Format the rule nicely for GitHub
    const ruleSnippet = JSON.stringify(
      {
        ...rule,
        id: rule.domain.replace(/[^a-zA-Z0-9]/g, ""),
      },
      null,
      2,
    );

    const title = encodeURIComponent(`[Site Rule] Support for ${rule.domain}`);
    const body = encodeURIComponent(
      `Please add this custom rule to \`COMMUNITY_RULES\`:\n\n\`\`\`json\n${ruleSnippet}\n\`\`\``,
    );

    window.open(
      `${import.meta.env.WXT_GITHUB_REPO}/issues/new?title=${title}&body=${body}&labels=enhancement`,
      "_blank",
    );
  }

  function generateRegexWithAI() {
    isGeneratingAI = true;
    browser.runtime
      .sendMessage({
        type: "MAKE_SITE_RULE_AI",
        data: {
          title,
          path,
        },
        config: {
          currentMode,
          geminiKey,
          geminiModel,
          llmModel,
          llmTemperature,
        },
      })
      .then((res: AIGeneratedRule | { error: string }) => {
        if ("error" in res) {
          alert(res.error);
        } else {
          editingRule = {
            ...(editingRule || {
              id: crypto.randomUUID(),
              domain: hostname,
            }),
            ...res,
          };
        }

        isGeneratingAI = false;
      });
  }
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

    <div class="grow grid">
      {#key activeTab}
        <div
          in:fly={{ y: 10, duration: 300, delay: 150 }}
          out:fade={{ duration: 150 }}
          class="col-start-1 row-start-1 space-y-5 flex flex-col h-full"
        >
          {#if latestVersion?.version && latestVersion.version !== latestVersion.currentVersion}
            <div
              class="flex items-center gap-3 p-2 mb-3 text-sm bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-200 rounded-xl"
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

          {#if ruleId === "fallback"}
            <div
              class="mt-2 flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-700 dark:text-amber-400"
            >
              <TriangleAlert size={16} class="shrink-0 mt-0.5" />
              <div class="flex-1 text-xs">
                <p class="font-bold">Unrecognized Site</p>
                <p class="mt-0.5 opacity-90 leading-snug">
                  Using fallback parsers. If the chapter or series name looks
                  wrong, add a custom rule in Settings.
                </p>
              </div>
            </div>
          {/if}
          {#if activeTab === "home"}
            <div
              class="bg-zinc-100 dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800"
            >
              <div class="flex justify-between items-center mb-2">
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
                {#if !cachedLlms.includes(llmModel)}
                  <div
                    class="flex flex-col gap-2 p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-xl"
                  >
                    <div class="flex gap-2 text-red-600 dark:text-red-500">
                      <TriangleAlert size={14} class="shrink-0 mt-0.5" />
                      <p class="text-xs leading-relaxed">
                        <strong class="font-bold">Model not cached.</strong> You
                        must download the selected LLM to use Local mode. If you
                        proceed, it will attempt to download automatically on first
                        use.
                      </p>
                    </div>
                    <button
                      onclick={() => openSetupTab(llmModel)}
                      class="flex items-center justify-center gap-2 w-full py-1.5 mt-1 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/60 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                    >
                      <Download size={14} />
                      Download Now
                    </button>
                  </div>
                {:else}
                  <div
                    class="flex gap-2 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-xl text-amber-600 dark:text-amber-500"
                  >
                    <Info size={14} class="shrink-0 mt-0.5" />
                    <p class="text-xs leading-relaxed">
                      Local mode active. Detection and translation will run on
                      your {activeDevice.toUpperCase()}.
                    </p>
                  </div>
                {/if}
              {:else if currentMode === "cloud"}
                <div
                  class="flex gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/30 rounded-xl text-emerald-600 dark:text-emerald-500"
                >
                  <Sparkles size={14} class="shrink-0 mt-0.5" />
                  <p class="text-xs leading-relaxed">
                    Cloud mode active. Using Gemini API for improved
                    translation. Detection runs on your {activeDevice.toUpperCase()}.
                  </p>
                </div>
              {/if}
            </div>

            <div class="space-y-2">
              <span
                class="text-sm font-bold uppercase tracking-wider text-zinc-500 ml-1"
              >
                Language Pair
              </span>

              <div
                class="relative flex items-center justify-between p-2 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 w-full shadow-sm"
                onclick={(e) => e.stopPropagation()}
                role="presentation"
              >
                <button
                  onclick={() => openDropdown("source")}
                  class="flex-1 flex items-center justify-center gap-2 p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors text-sm font-semibold"
                >
                  {#if isFetchingOCR}
                    <LoaderCircle
                      size={14}
                      class="animate-spin text-blue-500"
                    />
                  {/if}
                  {sourceLang}
                  <ChevronDown size={14} class="opacity-50" />
                </button>

                <button
                  onclick={swapLanguages}
                  class="p-2 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors mx-1 cursor-pointer"
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
                          class="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer
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
                        <div
                          class="px-3 py-4 text-center text-sm text-zinc-500"
                        >
                          No languages found
                        </div>
                      {/if}
                    </div>
                  </div>
                {/if}
              </div>
            </div>

            <!-- Helper Tip to replace the Translate button -->
            <div
              class="mt-auto pt-4 flex flex-col items-center justify-center text-center gap-2 text-zinc-500 dark:text-zinc-400"
            >
              <div
                class="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-full border border-zinc-200 dark:border-zinc-700"
              >
                <BookOpen size={16} />
              </div>
              <p class="text-xs max-w-62.5 leading-relaxed">
                Right-click any manga image on a webpage and select <strong
                  class="text-zinc-700 dark:text-zinc-300"
                  >Translate Image</strong
                > to begin.
              </p>
            </div>
          {/if}

          {#if activeTab === "context"}
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
          {/if}

          {#if activeTab === "settings"}
            <!-- DETECTION SETTINGS -->
            <div>
              <span
                class="text-sm font-bold uppercase tracking-widest text-zinc-500 ml-1"
              >
                Detection Model
              </span>
              <div
                class="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 mt-2 space-y-4"
              >
                <div class="flex flex-col space-y-1.5">
                  <div class="flex items-center justify-between">
                    <label
                      for="detection-model"
                      class="text-[10px] font-bold uppercase tracking-widest text-zinc-500"
                    >
                      Model Selection
                    </label>
                    {#if isFetchingDetection}
                      <LoaderCircle
                        size={12}
                        class="animate-spin text-blue-500"
                      />
                    {/if}
                  </div>
                  <select
                    id="detection-model"
                    bind:value={detectionModel}
                    class="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 text-sm outline-none cursor-pointer shadow-sm"
                  >
                    {#each DefaultConfig.detectionModels as model}
                      <option value={model.id}>{model.label}</option>
                    {/each}
                  </select>
                </div>

                <div class="grid grid-cols-[1fr_auto] gap-6 items-center pt-1">
                  <!-- Confidence Slider -->
                  <div class="flex flex-col space-y-2">
                    <div class="flex justify-between items-center">
                      <label
                        for="detection-min-confidence"
                        class="text-[10px] font-bold uppercase tracking-widest text-zinc-500"
                        >Min Confidence</label
                      >
                      <span class="text-[10px] font-mono text-zinc-500"
                        >{Math.round(detectionMinConfidence * 100)}%</span
                      >
                    </div>
                    <input
                      id="detection-min-confidence"
                      type="range"
                      min="0.1"
                      max="1"
                      step="0.05"
                      bind:value={detectionMinConfidence}
                      class="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>

                  <!-- Auto Update -->
                  <div class="flex flex-col items-end space-y-2">
                    <span
                      class="text-[10px] font-bold uppercase tracking-widest text-zinc-500"
                      >Auto-Update</span
                    >
                    <label
                      class="relative inline-flex items-center cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        bind:checked={detectionAutoUpdate}
                        class="sr-only peer"
                      />
                      <div
                        class="w-9 h-5 bg-zinc-200 dark:bg-zinc-700 rounded-full peer peer-checked:bg-blue-500 transition-all after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4"
                      ></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <!-- TEXT RECOGNITION (OCR) SETTINGS -->
            <div>
              <span
                class="text-sm font-bold uppercase tracking-widest text-zinc-500 ml-1"
              >
                Text Recognition (OCR)
              </span>
              <div
                class="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 mt-2"
              >
                <div class="flex flex-col space-y-2">
                  <div class="flex justify-between items-center">
                    <label
                      for="ocr-min-confidence"
                      class="text-[10px] font-bold uppercase tracking-widest text-zinc-500"
                    >
                      Min Confidence
                    </label>
                    <span class="text-[10px] font-mono text-zinc-500">
                      {Math.round(ocrMinConfidence * 100)}%
                    </span>
                  </div>
                  <input
                    id="ocr-min-confidence"
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.05"
                    bind:value={ocrMinConfidence}
                    class="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <p
                    class="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1.5 leading-snug"
                  >
                    Lower confidence reads more text but may include background
                    noise or drawing artifacts.
                  </p>

                  <div
                    class="flex gap-1.5 mt-1 p-2 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-lg text-amber-700 dark:text-amber-400"
                  >
                    <Info size={12} class="shrink-0 mt-0.5" />
                    <p class="text-[10px] leading-snug">
                      <strong>Local Mode Only:</strong> Cloud mode ignores this and
                      sends images with drawn bounding boxes directly to Gemini.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <!-- TRANSLATION AI SETTINGS -->
            <div>
              <span
                class="text-sm font-bold uppercase tracking-widest text-zinc-500 ml-1"
              >
                Translation AI
              </span>
              <div
                class="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 mt-2 space-y-5"
              >
                <!-- Local LLM -->
                <div class="space-y-1.5">
                  <label
                    for="llm-model"
                    class="text-[10px] font-bold uppercase tracking-widest text-zinc-500"
                  >
                    Local WebLLM
                  </label>
                  <div class="flex gap-2">
                    <select
                      id="llm-model"
                      bind:value={llmModel}
                      class="flex-1 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 text-sm outline-none cursor-pointer shadow-sm"
                    >
                      {#each DefaultConfig.llmModels as model}
                        <option value={model.id}>{model.label}</option>
                      {/each}
                    </select>
                    <button
                      onclick={() => openSetupTab(llmModel)}
                      class="px-4 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 rounded-lg transition-colors flex items-center justify-center cursor-pointer shadow-sm"
                      title="Download or Update Model"
                    >
                      <Download size={18} />
                    </button>
                  </div>
                </div>

                <!-- Gemini -->
                <div class="grid grid-cols-2 gap-3">
                  <div class="space-y-1.5">
                    <label
                      for="key"
                      class="text-[10px] font-bold uppercase tracking-widest text-zinc-500"
                    >
                      Gemini API Key
                    </label>
                    <div class="relative">
                      <input
                        id="key"
                        type={showKey ? "text" : "password"}
                        bind:value={geminiKey}
                        placeholder="AIzaSy..."
                        class="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 pr-10 text-sm focus:ring-1 focus:ring-blue-500 outline-none transition-all shadow-sm"
                      />
                      <button
                        type="button"
                        onclick={() => (showKey = !showKey)}
                        class="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors focus:outline-none rounded-lg"
                      >
                        {#if showKey}<EyeOff size={16} />{:else}<Eye
                            size={16}
                          />{/if}
                      </button>
                    </div>
                  </div>

                  <div class="space-y-1.5">
                    <label
                      for="gemini-model"
                      class="text-[10px] font-bold uppercase tracking-widest text-zinc-500"
                    >
                      Gemini Model
                    </label>
                    <select
                      id="gemini-model"
                      bind:value={geminiModel}
                      class="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 text-sm outline-none cursor-pointer shadow-sm"
                    >
                      {#each DefaultConfig.geminiModels as model}
                        <option value={model.id}>{model.label}</option>
                      {/each}
                    </select>
                  </div>
                </div>

                <!-- Shared Temperature -->
                <div class="pt-2 border-t border-zinc-200 dark:border-zinc-800">
                  <div class="flex justify-between items-center mb-2">
                    <label
                      for="llm-temperature"
                      class="text-[10px] font-bold uppercase tracking-widest text-zinc-500"
                    >
                      Shared Temperature
                    </label>
                    <span class="text-[10px] font-mono font-bold text-blue-500">
                      {llmTemperature.toFixed(1)}
                    </span>
                  </div>
                  <input
                    id="llm-temperature"
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    bind:value={llmTemperature}
                    class="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <div
                    class="flex justify-between text-[10px] text-zinc-400 font-medium mt-1"
                  >
                    <span>Precise</span>
                    <span>Creative</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- TYPOGRAPHY SETTINGS -->
            <div>
              <span
                class="text-sm font-bold uppercase tracking-widest text-zinc-500 ml-1"
              >
                Typography
              </span>
              <div
                class="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 mt-2 space-y-4"
              >
                <!-- Bundled font picker -->
                <div class="flex flex-col space-y-2">
                  <label
                    for="bundle-font"
                    class="text-[10px] font-bold uppercase tracking-widest text-zinc-500"
                  >
                    Bubble Font
                  </label>
                  <div class="grid grid-cols-2 gap-2">
                    {#each DefaultConfig.bundleFonts as font}
                      <button
                        onclick={() => (textFont = font.id)}
                        class="px-3 py-2 rounded-lg border text-sm transition-all cursor-pointer text-left shadow-sm
                        {textFont === font.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                          : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400'}"
                        style="font-family: {font.stack}"
                      >
                        {font.label}
                      </button>
                    {/each}
                  </div>
                </div>

                <!-- Custom fonts list -->
                {#if customFonts.length > 0}
                  <div class="flex flex-col space-y-1.5">
                    <label
                      for="custom-fonts"
                      class="text-[10px] font-bold uppercase tracking-widest text-zinc-500"
                    >
                      Custom Fonts
                    </label>
                    <div class="space-y-1.5">
                      {#each customFonts as font}
                        <div
                          class="flex items-center justify-between px-3 py-2 rounded-lg border cursor-pointer transition-all shadow-sm
                          {textFont === font.name
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                            : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950'}"
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
                            class="text-zinc-400 hover:text-red-500 transition-colors ml-2 cursor-pointer p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            aria-label="Delete font"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      {/each}
                    </div>
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
                  class="flex flex-col items-center justify-center gap-1.5 w-full py-4 px-3 rounded-lg border-2 border-dashed
                  transition-colors cursor-pointer bg-white dark:bg-zinc-950
                  {isDraggingOver
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-500'
                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-blue-400 hover:text-blue-500'}"
                >
                  {#if fontUploading}
                    <LoaderCircle size={18} class="animate-spin" />
                    <span class="text-sm font-medium">Uploading...</span>
                  {:else}
                    <Upload size={18} />
                    <span class="text-sm font-medium"
                      >Drag & Drop Font Here</span
                    >
                    <span class="text-[10px] opacity-60"
                      >(.ttf, .otf, .woff)</span
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

            <!-- CUSTOM SITE PARSING RULES -->
            <div>
              <span
                class="text-sm font-bold uppercase tracking-widest text-zinc-500 ml-1"
              >
                Custom Site Parsing Rules
              </span>
              <div
                class="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 mt-2 space-y-4"
              >
                {#if editingRule}
                  <!-- DOMAIN INPUT WITH "USE CURRENT" BUTTON -->
                  <div class="space-y-1.5">
                    <label
                      for="domain"
                      class="text-[10px] font-bold uppercase tracking-widest text-zinc-500"
                    >
                      Domain
                    </label>
                    <input
                      type="text"
                      bind:value={editingRule.domain}
                      placeholder="e.g. mangadex.org"
                      class="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 text-xs outline-none shadow-sm"
                    />
                  </div>

                  <!-- AI GENERATE BUTTON (Place this right before the Title/Path inputs) -->
                  <button
                    onclick={generateRegexWithAI}
                    disabled={isGeneratingAI}
                    class="cursor-pointer w-full flex items-center justify-center gap-2 py-2 my-3 bg-linear-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white rounded-lg text-xs font-bold shadow-sm transition-all disabled:opacity-50"
                  >
                    {#if isGeneratingAI}
                      <span class="animate-spin">🌀</span> Generating...
                    {:else}
                      ✨ Auto-Generate Rules with AI
                    {/if}
                  </button>
                  <!-- The Rule Editor -->
                  <div class="space-y-3">
                    <div class="flex justify-between items-center mb-2">
                      <span
                        class="text-xs font-bold uppercase tracking-widest text-zinc-500"
                        >Edit Rule</span
                      >
                      <button
                        onclick={() => {
                          editingRule = null;
                          testResult = null;
                        }}
                        class="text-xs text-zinc-500 hover:text-red-500 cursor-pointer"
                        >Cancel</button
                      >
                    </div>

                    <div class="space-y-1.5">
                      <label
                        for="series-name-rule"
                        class="text-[10px] font-bold uppercase tracking-widest text-zinc-500"
                        >Series Name</label
                      >
                      <div class="flex gap-2">
                        <select
                          id="series-name-rule"
                          bind:value={editingRule.seriesName.source}
                          class="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 text-xs outline-none cursor-pointer"
                        >
                          <option value="title">Title</option><option
                            value="path">Path</option
                          >
                        </select>
                        <input
                          type="text"
                          bind:value={editingRule.seriesName.regex}
                          placeholder="Regex..."
                          class="flex-1 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 text-xs outline-none font-mono shadow-sm"
                        />
                      </div>
                    </div>

                    <div class="space-y-1.5">
                      <label
                        for="chapter-id-rule"
                        class="text-[10px] font-bold uppercase tracking-widest text-zinc-500"
                        >Chapter ID</label
                      >
                      <div class="flex gap-2">
                        <select
                          bind:value={editingRule.chapterId.source}
                          class="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 text-xs outline-none cursor-pointer"
                        >
                          <option value="title">Title</option><option
                            value="path">Path</option
                          >
                        </select>
                        <input
                          id="chapter-id-rule"
                          type="text"
                          bind:value={editingRule.chapterId.regex}
                          placeholder="Regex..."
                          class="flex-1 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 text-xs outline-none font-mono shadow-sm"
                        />
                      </div>
                    </div>

                    <div class="space-y-1.5">
                      <label
                        for="page-index-rule"
                        class="text-[10px] font-bold uppercase tracking-widest text-zinc-500"
                        >Page Index</label
                      >
                      <div class="flex gap-2">
                        <select
                          bind:value={editingRule.pageIndex.source}
                          class="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 text-xs outline-none cursor-pointer"
                        >
                          <option value="title">Title</option><option
                            value="path">Path</option
                          >
                        </select>
                        <input
                          id="page-index-rule"
                          type="text"
                          bind:value={editingRule.pageIndex.regex}
                          placeholder="Regex..."
                          class="flex-1 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 text-xs outline-none font-mono shadow-sm"
                        />
                      </div>
                    </div>

                    <!-- Live Tester -->
                    <div
                      class="mt-4 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 rounded-lg"
                    >
                      <div class="flex justify-between items-center mb-2">
                        <span
                          class="text-xs font-bold text-blue-700 dark:text-blue-400"
                          >Live Test on Current Tab</span
                        >
                        <button
                          onclick={testRule}
                          disabled={isTesting}
                          class="flex items-center gap-1 px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-[10px] font-bold uppercase tracking-wider cursor-pointer disabled:opacity-50"
                        >
                          <Play size={10} /> Test
                        </button>
                      </div>

                      {#if testResult}
                        <div
                          class="space-y-2 mt-2 pt-2 border-t border-blue-200 dark:border-blue-800/50"
                        >
                          {#if testResult.error}
                            <p class="text-xs text-red-500">
                              {testResult.error}
                            </p>
                          {:else}
                            <div
                              class="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-[10px]"
                            >
                              <span class="text-zinc-500 font-bold uppercase"
                                >Series:</span
                              >
                              <span
                                class="font-mono text-zinc-800 dark:text-zinc-200 truncate"
                                >{testResult.context.seriesName}</span
                              >
                              <span class="text-zinc-500 font-bold uppercase"
                                >Chapter:</span
                              >
                              <span
                                class="font-mono text-zinc-800 dark:text-zinc-200 truncate"
                                >{testResult.context.chapterId}</span
                              >
                              <span class="text-zinc-500 font-bold uppercase"
                                >Page:</span
                              >
                              <span
                                class="font-mono text-zinc-800 dark:text-zinc-200 truncate"
                                >{testResult.context.pageIndex}</span
                              >
                            </div>
                          {/if}
                        </div>
                      {/if}
                    </div>

                    <button
                      onclick={saveRule}
                      class="w-full py-2 bg-zinc-800 hover:bg-zinc-700 dark:bg-zinc-200 dark:hover:bg-zinc-300 text-white dark:text-zinc-900 rounded-lg text-xs font-bold transition-colors cursor-pointer mt-2"
                    >
                      Save Rule
                    </button>

                    {#if COMMUNITY_RULES.some((r) => r.domain === editingRule?.domain) && editingRule.seriesName.regex && editingRule.chapterId.regex && editingRule.pageIndex.regex}
                      <button
                        onclick={() => shareRuleToGitHub(editingRule!)}
                        class="px-3 py-2 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                        title="Submit this rule to the official repository"
                      >
                        Share Rule
                      </button>
                    {/if}
                  </div>
                {:else}
                  <!-- Rule List View -->
                  <div class="space-y-2">
                    {#each customRules as rule}
                      <div
                        class="overflow-y-scroll max-h-75 flex items-center justify-between p-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm"
                      >
                        <div class="flex items-center gap-2 overflow-hidden">
                          <FileCode size={14} class="text-blue-500 shrink-0" />
                          <span class="text-xs font-mono truncate"
                            >{rule.domain}</span
                          >
                        </div>
                        <div class="flex gap-1 shrink-0">
                          <button
                            onclick={() => (editingRule = { ...rule })}
                            class="text-[10px] px-2 py-1 rounded bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 cursor-pointer transition-colors"
                            >Edit</button
                          >
                          <button
                            onclick={() =>
                              (customRules = customRules.filter(
                                (r) => r.id !== rule.id,
                              ))}
                            class="p-1 text-zinc-400 hover:text-red-500 cursor-pointer transition-colors"
                            ><Trash2 size={12} /></button
                          >
                        </div>
                      </div>
                    {/each}

                    {#if customRules.length === 0}
                      <div
                        class="text-center py-3 text-xs text-zinc-500 italic"
                      >
                        No custom rules added.
                      </div>
                    {/if}

                    <button
                      onclick={addRule}
                      class="w-full flex justify-center items-center gap-1 py-2 border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-blue-400 dark:hover:border-blue-500 text-zinc-500 hover:text-blue-500 rounded-lg text-xs font-bold transition-colors cursor-pointer mt-2"
                    >
                      <Plus size={14} /> Add Custom Rule
                    </button>
                  </div>
                {/if}
              </div>
            </div>

            <!-- FOOTER OPTIONS -->
            <div class="pt-2 pb-1">
              <label
                class="flex items-center justify-between cursor-pointer group px-1"
              >
                <span
                  class="text-sm font-medium text-zinc-700 dark:text-zinc-300 group-hover:text-blue-500 transition-colors"
                >
                  Allow anonymous data sharing
                </span>
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
                    size={14}
                    class="absolute text-white scale-0 peer-checked:scale-100 transition-transform left-0.5"
                  />
                </div>
              </label>
            </div>

            <div class="text-center pt-2">
              <span
                class="text-xs font-bold tracking-wide text-zinc-400 dark:text-zinc-600"
              >
                ComicTL v{latestVersion.currentVersion}
              </span>
            </div>
          {/if}
        </div>
      {/key}
    </div>
  {/if}
</main>
