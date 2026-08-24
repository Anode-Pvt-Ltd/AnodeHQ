import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Anode — Electronics Design & Engineering",
    short_name: "Anode",
    description:
      "End-to-end electronics design: circuit and schematic design, high-speed PCB layout, embedded firmware, prototyping, test and manufacturing support.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#206779",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
