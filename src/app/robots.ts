import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/utils";

export default function robots(): MetadataRoute.Robots {
  const isProduction = process.env.VERCEL_ENV ? process.env.VERCEL_ENV === "production" : true;
  return {
    rules: isProduction
      ? { userAgent: "*", allow: "/", disallow: ["/admin", "/account", "/cart", "/checkout", "/login", "/api/"] }
      : { userAgent: "*", disallow: "/" },
    sitemap: appUrl("/sitemap.xml"),
  };
}
