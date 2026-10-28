import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Camille Allen Dolls & Sculptures",
    short_name: "Camille Allen",
    description: "Dolls and sculptures created by Camille Allen",
    start_url: "/",
    display: "browser",
    background_color: "#151312",
    theme_color: "#cc867c",
    icons: [
      { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
