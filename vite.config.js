import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Deployed as a GitHub Pages *project* site at /sakura-trip/, so assets and the
// PWA scope must be served from that subpath (not the domain root).
const base = "/sakura-trip/";

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon-192.png", "icon-512.png", "apple-touch-icon.png"],
      manifest: {
        name: "櫻旅 — 日本旅遊",
        short_name: "櫻旅",
        // id/start_url/scope live under the Pages subpath. start_url has no
        // ?trip param on purpose; the app restores the last trip from
        // localStorage (F-01), so launching from the home screen no longer
        // mints a fresh empty trip the way v1 did.
        id: base,
        start_url: base,
        scope: base,
        theme_color: "#fb7185",
        background_color: "#fff1f2",
        display: "standalone",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
    }),
  ],
});
