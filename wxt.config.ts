import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    name: "ComicTL",
  },
  srcDir: "src",
  modules: ["@wxt-dev/module-svelte"],
  webExt: {
    binaries: {
      firefox: "/usr/bin/firefox",
    },
  },
});
