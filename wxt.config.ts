import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

// See https://wxt.dev/api/config.html
export default defineConfig({
  vite: () => ({
    plugins: [tailwindcss()],
    build: {
      minify: "terser",
    },
  }),

  manifest: {
    name: "ComicTL",
    description: "Manga Translator Extension",
    permissions: [
      "activeTab",
      "scripting",
      "offscreen",
      "storage",
      "contextMenus",
    ],
    host_permissions: ["<all_urls>"],
    web_accessible_resources: [
      {
        resources: ["/offscreen.html", "/content-scripts/*"],
        matches: ["<all_urls>"],
      },
    ],
    content_security_policy: {
      extension_pages:
        "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
    },
  },

  srcDir: "src",
  modules: ["@wxt-dev/module-svelte"],
  webExt: {
    binaries: {
      firefox: "/usr/bin/firefox",
    },
  },
});
