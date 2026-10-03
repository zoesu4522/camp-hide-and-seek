import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "躲貓貓小人｜Camp Hide & Seek",
    short_name: "躲貓貓小人",
    description: "26 位玩家一起在營區裡尋找藏起來的 8 個小人！",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#07182B",
    theme_color: "#07182B",
    lang: "zh-Hant-TW",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
