import { mount } from "svelte";
import "@/assets/app.css";
import App from "./App.svelte";
import { getAdapter } from "@/lib/adapters";
import { openSetupTab } from "@/lib/utils";

const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
const hostname = tab.url ? new URL(tab.url).hostname : "";

if (await storage.getItem("local:is-first-run", { fallback: true })) {
  openSetupTab();
}

const app = mount(App, {
  target: document.getElementById("app")!,
  props: {
    seriesName:
      getAdapter(hostname).seriesName(tab.title ?? "") ?? "Unknown Series",
  },
});

export default app;
