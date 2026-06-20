import type { MetadataRoute } from "next";
import { DEFAULT_DESCRIPTION, SITE_NAME } from "@/lib/seo";
import { getSiteUrl } from "@/lib/siteUrl";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#185fa5",
    lang: "en",
    icons: [
      {
        src: "/nagarik-palika-logo.png",
        sizes: "188x88",
        type: "image/png",
      },
    ],
  };
}
