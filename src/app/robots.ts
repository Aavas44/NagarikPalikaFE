import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/siteUrl";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/admin/",
        "/login",
        "/account",
        "/account/",
        "/advocate",
        "/advocate/",
        "/auth",
        "/auth/",
        "/consult/payment",
        "/consult/payment/",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
